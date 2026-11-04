import type { KV } from '../core/storage.ts';
import { clearProfile, defaultProfile, loadProfile, recordRun, saveProfile, validateName, type NameResult, type Profile, type RunSummary } from './Profile.ts';
import { awardCosmetics, COSMETICS, DEFAULT_LOOK, type CosmeticKind, type CosmeticLook, type CosmeticProgress } from './cosmetics.ts';

/** The live profile. Every change is saved at once, so nothing is lost if the page closes mid-run. */
export class ProfileStore {
  private current: Profile;
  private readonly storage: KV | null | undefined;

  constructor(storage?: KV | null) {
    this.storage = storage;
    this.current = loadProfile(storage);
  }

  get value(): Readonly<Profile> {
    return this.current;
  }

  /** Adds a finished or abandoned run to the stats. */
  record(run: RunSummary): void {
    this.set(recordRun(this.current, run));
  }

  setName(raw: string): NameResult {
    const result = validateName(raw);
    if (result.ok) this.set({ ...this.current, name: result.name });
    return result;
  }

  setLastCharacter(id: string): void {
    if (id !== this.current.lastCharacter) this.set({ ...this.current, lastCharacter: id });
  }

  lookFor(id: string): CosmeticLook { return { ...DEFAULT_LOOK, ...this.current.cosmetics.equipped[id] }; }

  equip(id: string, kind: CosmeticKind, cosmeticId: string): boolean {
    if (!['NIX', 'BRASA', 'VECTOR', 'SUTURA', 'VOLT', 'MORSA'].includes(id)
      || !COSMETICS.some(c => c.id === cosmeticId && c.kind === kind) || !this.current.cosmetics.unlocked.includes(cosmeticId)) return false;
    const cosmetics = this.current.cosmetics;
    this.set({ ...this.current, cosmetics: { ...cosmetics, equipped: { ...cosmetics.equipped, [id]: { ...this.lookFor(id), [kind]: cosmeticId } } } });
    return true;
  }

  checkUnlocks(progress: CosmeticProgress): string[] {
    const cosmetics = awardCosmetics(this.current.cosmetics, progress);
    const added = cosmetics.unlocked.filter(id => !this.current.cosmetics.unlocked.includes(id));
    if (added.length) this.set({ ...this.current, cosmetics });
    return added;
  }

  /** Erases everything, name included. */
  clear(): void {
    clearProfile(this.storage);
    this.current = defaultProfile();
  }

  private set(next: Profile): void {
    this.current = next;
    saveProfile(next, this.storage);
  }
}
