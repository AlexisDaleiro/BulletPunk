import { readJson, writeJson, type KV } from '../core/storage.ts';

export const SETTINGS_KEY = 'bulletpunk.settings';
/** Bump when a field changes meaning. `sanitizeSettings` keeps every field it still understands. */
export const SETTINGS_VERSION = 1;

/** Canvas resolution presets: the cap on devicePixelRatio. */
export const PIXEL_RATIOS = [1, 1.5, 2] as const;
export type PixelRatio = (typeof PIXEL_RATIOS)[number];

export interface Settings {
  version: number;
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
  pixelRatio: PixelRatio;
  showFps: boolean;
  /** Read once when the renderer starts, so a change needs a reload. */
  antialias: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  version: SETTINGS_VERSION,
  volume: 0.5,
  muted: false,
  pixelRatio: 2,
  showFps: false,
  antialias: true,
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Turns anything read from storage (corrupt, old, hand-edited) into a valid Settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const volume = typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : DEFAULT_SETTINGS.volume;
  let pixelRatio: PixelRatio = DEFAULT_SETTINGS.pixelRatio;
  if (typeof r.pixelRatio === 'number' && Number.isFinite(r.pixelRatio)) {
    const wanted = r.pixelRatio;
    pixelRatio = PIXEL_RATIOS.reduce((best, p) => (Math.abs(p - wanted) < Math.abs(best - wanted) ? p : best));
  }
  return {
    version: SETTINGS_VERSION,
    volume,
    muted: bool(r.muted, DEFAULT_SETTINGS.muted),
    pixelRatio,
    showFps: bool(r.showFps, DEFAULT_SETTINGS.showFps),
    antialias: bool(r.antialias, DEFAULT_SETTINGS.antialias),
  };
}

export function loadSettings(storage?: KV | null): Settings {
  return sanitizeSettings(readJson(SETTINGS_KEY, storage));
}

export function saveSettings(settings: Settings, storage?: KV | null): boolean {
  return writeJson(SETTINGS_KEY, settings, storage);
}
