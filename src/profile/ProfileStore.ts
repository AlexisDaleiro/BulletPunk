import type { KV } from '../core/storage.ts';
import { clearProfile, defaultProfile, loadProfile, recordRun, saveProfile, validateName, type NameResult, type Profile, type RunSummary } from './Profile.ts';

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
