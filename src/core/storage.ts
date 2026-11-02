/** The slice of `Storage` the game uses; tests pass a Map-backed fake. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `localStorage`, or null when the browser blocks it (private mode, disabled site data). */
export function browserStorage(): KV | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Parsed JSON under `key`, or undefined when missing, unreadable or corrupt. */
export function readJson(key: string, storage: KV | null = browserStorage()): unknown {
  try {
    const text = storage?.getItem(key);
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

/** Returns false when the write failed (quota, blocked storage); callers keep running without persistence. */
export function writeJson(key: string, value: unknown, storage: KV | null = browserStorage()): boolean {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return storage !== null;
  } catch {
    return false;
  }
}

export function removeKey(key: string, storage: KV | null = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // nothing to clean up if storage is blocked
  }
}
