import type { KV } from '../core/storage.ts';
import { clearProfile, defaultProfile, loadProfile, recordRun, saveProfile, validateName, type NameResult, type Profile, type RunSummary } from './Profile.ts';
import { awardCosmetics, COSMETICS, DEFAULT_LOOK, type CosmeticKind, type CosmeticLook, type CosmeticProgress } from './cosmetics.ts';
import { browserStorage, readJson, writeJson } from '../core/storage.ts';
import { sanitizeProfile } from './Profile.ts';
import type { ProfilePatch } from '../cloud/contracts.ts';

/** The local profile. Profile edits save immediately; active-run state is not persisted here. */
export class ProfileStore {
  private current: Profile;
  private readonly storage: KV | null | undefined;
  private owner: string | null = null;
  writable = true;
  onMutation: ((patch: ProfilePatch) => void) | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(storage?: KV | null) {
    this.storage = storage;
    this.current = loadProfile(storage);
  }

  get value(): Readonly<Profile> {
    return this.current;
  }

  get accountId(): string | null { return this.owner; }

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => void this.listeners.delete(listener); }

  /** Account caches never overwrite the legacy guest profile. */
  activateAccount(id: string, profile?: Profile): boolean {
    this.owner = id;
    this.writable = false;
    const cached = readJson(`bulletpunk.account.${id}.profile`, this.storage === undefined ? browserStorage() : this.storage);
    this.current = profile ?? sanitizeProfile(cached);
    this.notify();
    return cached !== undefined;
  }

  activateGuest(): void { this.owner = null; this.writable = true; this.current = loadProfile(this.storage); this.notify(); }

  acceptRemote(profile: Profile): void { this.current = sanitizeProfile(profile); this.persist(); this.notify(); }

  guestProfile(): Profile { return loadProfile(this.storage); }

  /** Adds a finished or abandoned run to the stats. */
  record(run: RunSummary): void {
    if (this.owner) return; // Server run reports own account statistics.
    this.set(recordRun(this.current, run));
  }

  setName(raw: string): NameResult {
    if (!this.writable) return { ok: false, error: 'Esperá a que se cargue tu perfil de servidor.' };
    const result = validateName(raw);
    if (result.ok) this.set({ ...this.current, name: result.name }, { name: result.name });
    return result;
  }

  setLastCharacter(id: string): void {
    if (!this.writable) return;
    if (id !== this.current.lastCharacter) this.set({ ...this.current, lastCharacter: id }, { lastCharacter: id });
  }

  lookFor(id: string): CosmeticLook { return { ...DEFAULT_LOOK, ...this.current.cosmetics.equipped[id] }; }

  equip(id: string, kind: CosmeticKind, cosmeticId: string): boolean {
    if (!this.writable) return false;
    if (!['NIX', 'BRASA', 'VECTOR', 'SUTURA', 'VOLT', 'MORSA'].includes(id)
      || !COSMETICS.some(c => c.id === cosmeticId && c.kind === kind) || !this.current.cosmetics.unlocked.includes(cosmeticId)) return false;
    const cosmetics = this.current.cosmetics;
    const look = { ...this.lookFor(id), [kind]: cosmeticId };
    this.set({ ...this.current, cosmetics: { ...cosmetics, equipped: { ...cosmetics.equipped, [id]: look } } }, { equipped: { [id]: look } });
    return true;
  }

  checkUnlocks(progress: CosmeticProgress): string[] {
    if (this.owner) return []; // Account unlocks are granted by validated server reports.
    const cosmetics = awardCosmetics(this.current.cosmetics, progress);
    const added = cosmetics.unlocked.filter(id => !this.current.cosmetics.unlocked.includes(id));
    if (added.length) this.set({ ...this.current, cosmetics });
    return added;
  }

  /** Erases everything, name included. */
  clear(): void {
    if (this.owner) return; // Account reset uses the authenticated server operation.
    clearProfile(this.storage);
    this.current = defaultProfile();
    this.notify();
  }

  private set(next: Profile, patch?: ProfilePatch): void {
    this.current = next;
    this.persist();
    if (this.owner && patch) this.onMutation?.(patch);
    this.notify();
  }

  private persist(): void {
    if (this.owner) writeJson(`bulletpunk.account.${this.owner}.profile`, this.current, this.storage === undefined ? browserStorage() : this.storage);
    else saveProfile(this.current, this.storage);
  }

  private notify(): void { for (const listener of this.listeners) listener(); }
}
