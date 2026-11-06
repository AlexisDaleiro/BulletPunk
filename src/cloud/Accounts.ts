import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { browserStorage, readJson, writeJson } from '../core/storage.ts';
import type { ProfileStore } from '../profile/ProfileStore.ts';
import type { SettingsStore } from '../settings/SettingsStore.ts';
import { CloudSync } from './CloudSync.ts';
import { SupabaseBackend } from './SupabaseBackend.ts';
import { createId } from '../core/id.ts';

export class Accounts {
  readonly configured: boolean;
  readonly emailEnabled = import.meta.env.VITE_AUTH_EMAIL_ENABLED === 'true';
  readonly sync: CloudSync;
  client: SupabaseClient | null = null;
  private readonly url: string;
  private readonly key: string;
  userId: string | null = null;
  email = '';
  recovering = false;
  initializing = true;
  beforeIdentityChange: (() => void | Promise<void>) | null = null;
  onProgressReset: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private authEpoch = 0;
  private readonly profile: ProfileStore;

  constructor(profile: ProfileStore, settings: SettingsStore) {
    this.profile = profile;
    this.sync = new CloudSync(profile, settings);
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    this.url = url ?? ''; this.key = key ?? '';
    this.configured = !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && !!key && !key.startsWith('sb_secret_');
    let observedOwner: string | null = null, observedGeneration = 0;
    this.sync.subscribe(() => {
      const reset = observedOwner === this.sync.owner && this.sync.owner !== null && observedGeneration !== this.sync.generation;
      observedOwner = this.sync.owner; observedGeneration = this.sync.generation;
      if (reset) this.onProgressReset?.();
      this.notify();
    });
    window.addEventListener('online', () => { void this.sync.retry(); });
    window.addEventListener('pagehide', () => { void this.sync.flush(); });
    window.setInterval(() => { if (this.userId && this.sync.status === 'offline' && navigator.onLine) void this.sync.retry(); }, 15000);
  }

  get canPlay(): boolean { return !this.initializing && (!this.userId || (this.sync.ready && this.sync.status !== 'conflict' && this.sync.status !== 'error')); }
  get isGuest(): boolean { return this.userId === null; }
  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => void this.listeners.delete(fn); }

  async init(): Promise<void> {
    if (!this.configured) { this.initializing = false; this.notify(); return; }
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.url, this.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') this.recovering = true;
      // Never await another Supabase request within the SDK's auth callback/lock.
      window.setTimeout(() => { void this.acceptSession(session); }, 0);
    });
    const { data, error } = await this.client.auth.getSession();
    if (error) { this.initializing = false; this.notify(); return; }
    await this.acceptSession(data.session);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.requireClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(authMessage(error.message));
    await this.acceptSession(data.session);
  }
  async signUp(email: string, password: string): Promise<boolean> {
    if (!this.emailEnabled) throw new Error('El registro por correo todavía está pendiente de habilitación. Podés jugar como invitado.');
    const { data, error } = await this.requireClient().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: this.redirectUrl() } });
    if (error) throw new Error(authMessage(error.message));
    if (data.session) await this.acceptSession(data.session);
    return !!data.session;
  }
  async recover(email: string): Promise<void> {
    if (!this.emailEnabled) throw new Error('La recuperación por correo todavía está pendiente de habilitación.');
    const url = new URL(this.redirectUrl()); url.searchParams.set('account', 'recovery');
    const { error } = await this.requireClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: url.href });
    if (error) throw new Error(authMessage(error.message));
  }
  async changePassword(password: string): Promise<void> {
    if (!this.recovering || !this.userId) throw new Error('Abrí el enlace de recuperación que recibiste por correo.');
    const { error } = await this.requireClient().auth.updateUser({ password });
    if (error) throw new Error(authMessage(error.message));
    this.recovering = false; this.notify();
    const url = new URL(location.href); url.searchParams.delete('account'); url.hash = ''; history.replaceState(null, '', url.href);
  }
  async signOut(): Promise<void> {
    await this.beforeIdentityChange?.();
    await this.sync.flush();
    const { error } = await this.requireClient().auth.signOut({ scope: 'local' });
    if (error) throw new Error(authMessage(error.message));
    await this.acceptSession(null);
  }
  async importGuest(): Promise<void> {
    const storage = browserStorage();
    let legacyId = readJson('bulletpunk.legacy.id', storage);
    if (typeof legacyId !== 'string') { legacyId = createId(); if (!writeJson('bulletpunk.legacy.id', legacyId, storage)) throw new Error('El navegador no permite guardar la identificación de esta importación.'); }
    await this.sync.importGuest(this.profile.guestProfile(), legacyId as string);
  }
  async deleteAccount(): Promise<void> {
    if (!this.userId) return;
    await this.beforeIdentityChange?.();
    const owner = this.userId;
    const { data, error } = await this.requireClient().functions.invoke('delete-account', { body: { owner } });
    if (error || !data?.deleted) throw new Error('No se pudo eliminar la cuenta. Reintentá con conexión.');
    await this.requireClient().auth.signOut({ scope: 'local' });
    // Remove only this account's cache; its outbox must never resurrect deleted data.
    const storage = browserStorage();
    storage?.removeItem(`bulletpunk.account.${owner}.profile`);
    storage?.removeItem(`bulletpunk.account.${owner}.sync`);
    await this.acceptSession(null);
  }

  private async acceptSession(session: Session | null): Promise<void> {
    const id = session?.user.id ?? null;
    if (id === this.userId && !this.initializing) { this.email = session?.user.email ?? ''; this.notify(); return; }
    const epoch = ++this.authEpoch;
    await this.beforeIdentityChange?.();
    if(epoch!==this.authEpoch)return;
    if (id && this.isGuest) this.sync.rememberGuestSound();
    this.userId = id; this.email = session?.user.email ?? ''; this.initializing = false;
    if (id && this.client) {
      const promise = this.sync.connect(id, new SupabaseBackend(this.client, id));
      this.notify(); await promise;
    } else { this.recovering = false; this.sync.disconnect(); }
    if (epoch === this.authEpoch) this.notify();
  }
  private redirectUrl(): string { return new URL(import.meta.env.BASE_URL, location.href).href.split('?')[0].split('#')[0]; }
  private requireClient(): SupabaseClient { if (!this.client) throw new Error('El servicio de cuentas todavía no está configurado. Podés jugar como invitado.'); return this.client; }
  private notify(): void { for (const fn of this.listeners) fn(); }
}

function authMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login')) return 'El correo o la contraseña no son correctos.';
  if (text.includes('email not confirmed')) return 'Confirmá tu correo antes de entrar.';
  if (text.includes('rate limit') || text.includes('too many')) return 'Demasiados intentos. Esperá un momento antes de reintentar.';
  if (text.includes('password')) return 'Usá una contraseña de al menos 8 caracteres.';
  if (text.includes('email')) return 'No se pudo completar el acceso por correo. Revisá la dirección o reintentá más tarde.';
  return 'No se pudo contactar con el servicio de cuentas. Revisá la conexión y reintentá.';
}
