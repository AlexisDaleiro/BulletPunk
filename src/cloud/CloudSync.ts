import { browserStorage, readJson, writeJson, type KV } from '../core/storage.ts';
import { createId } from '../core/id.ts';
import { sanitizeProfile, type Profile } from '../profile/Profile.ts';
import type { ProfileStore } from '../profile/ProfileStore.ts';
import type { SettingsStore } from '../settings/SettingsStore.ts';
import { applyPatch, CloudError, type CloudBackend, type CloudProfile, type PendingOperation, type ProfilePatch, type RunReport } from './contracts.ts';

export type SyncStatus = 'guest' | 'loading' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
interface SavedState { envelope: CloudProfile | null; pending: PendingOperation[]; lastSaved: string | null; activeReport?: RunReport | null }
const stateKey = (owner: string): string => `bulletpunk.account.${owner}.sync`;

/** Durable, account-scoped outbox. Stale responses may never change the newly selected account. */
export class CloudSync {
  owner: string | null = null;
  status: SyncStatus = 'guest';
  ready = true;
  error = '';
  lastSaved: string | null = null;
  localDurable = true;
  private epoch = 0;
  private backend: CloudBackend | null = null;
  private envelope: CloudProfile | null = null;
  private pending: PendingOperation[] = [];
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private settingsSuppressed = false;
  private activeReport: RunReport | null = null;
  private sendingId: string | null = null;
  private externalBusy = false;
  private lastSound = '';
  private readonly storage: KV | null;
  private readonly profile: ProfileStore;
  private readonly settings: SettingsStore;
  private readonly listeners = new Set<() => void>();

  constructor(profile: ProfileStore, settings: SettingsStore, storage: KV | null = browserStorage()) {
    this.profile = profile; this.settings = settings; this.storage = storage;
    profile.onMutation = patch => this.queuePatch(patch);
    this.lastSound = JSON.stringify(this.sound());
    settings.subscribe(() => {
      const sound = this.sound(), key = JSON.stringify(sound);
      if (key === this.lastSound) return;
      this.lastSound = key;
      if (!this.settingsSuppressed && this.owner && this.ready) this.queuePatch({ preferences: sound });
    });
  }

  get pendingCount(): number { return this.pending.length; }
  get generation(): number { return this.envelope?.generation ?? 0; }
  get canImport(): boolean { return !!this.envelope && this.envelope.revision === 0 && !this.envelope.imported && this.pending.length === 0; }
  get imported(): boolean { return this.envelope?.imported ?? false; }
  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => void this.listeners.delete(fn); }

  async connect(owner: string, backend: CloudBackend): Promise<void> {
    this.detach();
    const epoch = this.epoch;
    this.owner = owner; this.backend = backend; this.status = 'loading'; this.ready = false;
    const stored = readJson(stateKey(owner), this.storage) as SavedState | undefined;
    this.envelope = stored?.envelope && typeof stored.envelope.revision === 'number' ? stored.envelope : null;
    this.pending = Array.isArray(stored?.pending) ? stored.pending.filter(op => op && typeof op.id === 'string' && ['profile', 'run', 'import'].includes(op.kind)).slice(0, 1000) : [];
    this.activeReport = stored?.activeReport ?? null;
    // This store is starting a fresh session: close the previous page's last reported run once.
    if (this.activeReport && this.envelope) {
      this.pending.push({ id: createId(), kind: 'run', generation: this.activeReport.generation ?? this.envelope.generation,
        report: { ...this.activeReport, seq: this.activeReport.seq + 1, finished: true } });
      this.activeReport = null;
    }
    this.lastSaved = stored?.lastSaved ?? null;
    this.profile.activateAccount(owner, this.envelope ? this.visibleProfile(this.envelope.profile) : undefined);
    this.save();
    this.notify();
    try {
      const value = await backend.load();
      if (epoch !== this.epoch) return;
      if (this.pending.some(op => op.generation !== value.generation)) {
        this.profile.writable = false;
        this.envelope = value; this.ready = true; this.status = 'conflict';
        this.error = 'El progreso se reinició desde otro dispositivo. Revisá los cambios pendientes.';
        this.profile.acceptRemote(value.profile); this.save(); this.notify(); return;
      }
      this.profile.writable = true; this.accept(value); this.ready = true;
      this.status = this.pending.length ? 'saving' : 'saved'; this.notify();
      await this.flush();
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.ready = this.envelope !== null;
      this.profile.writable = this.ready;
      this.status = 'offline'; this.error = this.ready ? 'Sin conexión. Los cambios quedan pendientes en este dispositivo.' : 'No se pudo cargar tu perfil. Reintentá antes de jugar con esta cuenta.';
      this.notify();
    }
  }

  disconnect(): void {
    this.detach(); this.owner = null; this.backend = null; this.envelope = null; this.pending = [];
    this.ready = true; this.status = 'guest'; this.error = ''; this.lastSaved = null;
    this.activeReport = null;
    this.profile.activateGuest();
    const guest = readJson('bulletpunk.guest.sound', this.storage) as { volume?: number; muted?: boolean } | undefined;
    if (guest) this.applySound(guest);
    this.notify();
  }

  queuePatch(patch: ProfilePatch): void {
    if (!this.owner || !this.envelope || !this.ready) return;
    // Keep in-flight requests immutable; every operation has its own replay-safe identity.
    const existing = [...this.pending].reverse().find(op => op.kind === 'profile' && op.id !== this.sendingId && op.generation === this.envelope!.generation);
    if (existing?.kind === 'profile') {
      existing.patch = { ...existing.patch, ...structuredClone(patch), equipped: { ...existing.patch.equipped, ...patch.equipped } };
    } else this.pending.push({ id: createId(), kind: 'profile', patch: structuredClone(patch), revision: this.envelope.revision, generation: this.envelope.generation });
    this.changed();
  }

  report(report: RunReport): void {
    if (!this.owner || !this.envelope || !this.ready) return;
    const existing = [...this.pending].reverse().find(op => op.kind === 'run' && op.id !== this.sendingId && op.report.runId === report.runId);
    const operation: PendingOperation = { id: createId(), kind: 'run', report: structuredClone(report), generation: report.generation ?? this.envelope.generation };
    if (existing) this.pending[this.pending.indexOf(existing)] = operation;
    else this.pending.push(operation);
    this.activeReport = report.finished ? null : structuredClone(report);
    this.changed();
  }

  async importGuest(profile: Profile, legacyId: string): Promise<void> {
    if (!this.canImport || !this.envelope) throw new Error('La importación solo está disponible para una cuenta nueva y vacía.');
    this.pending.push({ id: createId(), kind: 'import', profile: sanitizeProfile(profile), legacyId, generation: this.envelope.generation });
    this.changed(); await this.flush();
  }

  async retry(): Promise<void> {
    if (!this.owner || !this.backend) return;
    if (!this.ready) { await this.connect(this.owner, this.backend); return; }
    this.error = ''; this.status = this.pending.length ? 'saving' : 'loading'; this.notify();
    if (!this.pending.length) {
      const epoch = this.epoch;
      try { const value = await this.backend.load(); if (epoch === this.epoch) { this.accept(value); this.status = 'saved'; this.notify(); } }
      catch { if (epoch === this.epoch) { this.status = 'offline'; this.notify(); } }
    } else await this.flush();
  }

  /** Discard only local operations after the user reviews a conflict; reports are retained unless reset. */
  async resolveConflict(useLocal: boolean): Promise<void> {
    if (!this.backend || !this.owner) return;
    const epoch = this.epoch, fresh = await this.backend.load();
    if (epoch !== this.epoch) return;
    if (useLocal && this.pending.some(op => op.generation !== fresh.generation)) throw new Error('No se pueden aplicar datos anteriores a un reinicio de progreso.');
    this.pending = this.pending.filter(op => op.generation === fresh.generation && (useLocal || op.kind === 'run'));
    this.envelope = fresh;
    this.profile.writable = true;
    for (const op of this.pending) if (op.kind === 'profile') op.revision = fresh.revision;
    this.error = ''; this.status = 'saving'; this.accept(fresh); this.notify(); await this.flush();
  }

  async reset(): Promise<void> {
    if (!this.backend || !this.envelope || !this.ready || this.pending.length) throw new Error('Sincronizá los cambios antes de reiniciar el progreso.');
    const epoch = this.epoch;
    const value = await this.backend.reset(this.envelope.revision, createId());
    if (epoch !== this.epoch) return;
    this.accept(value); this.status = 'saved'; this.notify();
  }

  flush(): Promise<void> {
    if (this.externalBusy) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const epoch = this.epoch, backend = this.backend;
    if (!backend || !this.ready || this.status === 'conflict') return Promise.resolve();
    const promise = this.sendPending(epoch, backend);
    this.inFlight = promise;
    void promise.finally(() => { if (epoch === this.epoch) this.inFlight = null; });
    return promise;
  }

  /** Serialize a checkpoint's progress transaction with this account's profile outbox. */
  async withServerProfile<T>(action: () => Promise<{ profile: CloudProfile; value: T }>): Promise<T> {
    await this.flush();
    if (this.pending.length || this.externalBusy || !this.owner || !this.ready) throw new Error('Sincronizá el perfil antes de guardar la incursión.');
    const epoch=this.epoch, before=this.envelope?.revision ?? -1;
    this.externalBusy=true;
    try {
      const result=await action();
      if (epoch!==this.epoch) throw new Error('La cuenta cambió durante el guardado.');
      if (result.profile.revision===before+1) for (const op of this.pending) if (op.kind==='profile' && op.revision===before) op.revision=result.profile.revision;
      this.accept(result.profile);this.status=this.pending.length?'saving':'saved';this.notify();return result.value;
    } finally { if (epoch===this.epoch) {this.externalBusy=false;void this.flush();} }
  }

  private async sendPending(epoch: number, backend: CloudBackend): Promise<void> {
    while (this.pending.length && epoch === this.epoch) {
      const op = this.pending[0]; this.sendingId = op.id; this.status = 'saving'; this.notify();
      const beforeRevision = this.envelope?.revision ?? -1;
      try {
        const value = await backend.apply(structuredClone(op));
        if (epoch !== this.epoch) return;
        this.pending.shift();
        // Rebase queued edits only over operations acknowledged in this outbox, never over another device.
        if (value.revision === beforeRevision + 1) {
          for (const next of this.pending) if (next.kind === 'profile' && next.revision === beforeRevision) next.revision = value.revision;
        }
        this.accept(value);
        this.sendingId = null;
      } catch (error) {
        if (epoch !== this.epoch) return;
        const kind = error instanceof CloudError ? error.code : 'network';
        this.status = kind === 'conflict' || kind === 'generation' ? 'conflict' : kind === 'rejected' ? 'error' : 'offline';
        this.error = error instanceof Error ? error.message : 'No se pudo sincronizar.';
        this.sendingId = null;
        this.save(); this.notify(); return;
      }
    }
    if (epoch === this.epoch) { this.status = 'saved'; this.error = ''; this.save(); this.notify(); }
  }

  private changed(): void {
    if (this.status !== 'conflict') this.status = 'saving';
    this.save(); this.notify();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 400);
  }
  private accept(value: CloudProfile): void {
    if (this.envelope && value.generation !== this.envelope.generation) this.activeReport = null;
    this.envelope = { ...value, profile: sanitizeProfile(value.profile) };
    this.profile.acceptRemote(this.visibleProfile(this.envelope.profile));
    const preferences = this.pending.reduce((sound, op) => op.kind === 'profile' && op.patch.preferences ? op.patch.preferences : sound, value.preferences);
    this.applySound(preferences);
    this.lastSaved = value.updatedAt; this.save();
  }
  private visibleProfile(profile: Profile): Profile {
    return this.pending.reduce((result, op) => op.kind === 'profile' ? applyPatch(result, op.patch) : result, profile);
  }
  private applySound(sound: { volume?: number; muted?: boolean }): void {
    this.settingsSuppressed = true;
    try { this.settings.update(sound); } finally { this.settingsSuppressed = false; }
  }
  private sound(): { volume: number; muted: boolean } { return { volume: this.settings.value.volume, muted: this.settings.value.muted }; }
  rememberGuestSound(): void { if (!this.owner) writeJson('bulletpunk.guest.sound', this.sound(), this.storage); }
  private save(): void {
    if (this.owner) this.localDurable = writeJson(stateKey(this.owner), { envelope: this.envelope, pending: this.pending, lastSaved: this.lastSaved, activeReport: this.activeReport }, this.storage);
  }
  private detach(): void { this.epoch++; if (this.timer) clearTimeout(this.timer); this.timer = null; this.inFlight = null; this.sendingId = null; this.externalBusy=false; }
  private notify(): void { for (const fn of this.listeners) fn(); }
}
