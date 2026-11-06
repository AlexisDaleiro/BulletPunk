import type { KV } from '../core/storage.ts';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings, type Settings } from './Settings.ts';

/** The live settings. `update` sanitizes, saves and tells subscribers, so options apply instantly. */
export class SettingsStore {
  /** An explicit preset selection also resets any temporary automatic downgrade. */
  qualitySelection = 0;
  private current: Settings;
  private readonly listeners = new Set<(s: Readonly<Settings>) => void>();
  private readonly storage: KV | null | undefined;

  constructor(storage?: KV | null) {
    this.storage = storage;
    this.current = loadSettings(storage);
  }

  get value(): Readonly<Settings> {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    if ('quality' in patch) this.qualitySelection++;
    this.set(sanitizeSettings({ ...this.current, ...patch }));
  }

  reset(): void {
    this.qualitySelection++;
    this.set({ ...DEFAULT_SETTINGS });
  }

  /** Returns the unsubscribe function. */
  subscribe(listener: (s: Readonly<Settings>) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private set(next: Settings): void {
    this.current = next;
    saveSettings(next, this.storage);
    for (const listener of this.listeners) listener(next);
  }
}
