import { readJson, writeJson, type KV } from '../core/storage.ts';

export const SETTINGS_KEY = 'bulletpunk.settings';
/** Bump when a field changes meaning. `sanitizeSettings` keeps every field it still understands. */
export const SETTINGS_VERSION = 1;

/** Canvas resolution presets: the cap on devicePixelRatio. */
export const PIXEL_RATIOS = [1, 1.5, 2] as const;
export type PixelRatio = (typeof PIXEL_RATIOS)[number];
export const QUALITY_PRESETS = ['FLUID', 'BALANCED', 'CINEMATIC'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];
export const TOUCH_ACTIONS = ['swap', 'reload', 'interact', 'dash', 'ability'] as const;
export type TouchAction = (typeof TOUCH_ACTIONS)[number];
export interface TouchPoint {
  x: number;
  y: number;
}
export interface TouchSettings {
  touchScale: number;
  touchOpacity: number;
  touchLeftHanded: boolean;
  aimDeadzone: number;
  touchPositions: Partial<Record<TouchAction, TouchPoint>>;
}

export interface Settings extends TouchSettings {
  version: number;
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
  pixelRatio: PixelRatio;
  showFps: boolean;
  /** Read once when the renderer starts, so a change needs a reload. */
  antialias: boolean;
  quality: QualityPreset;
  adaptiveQuality: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  version: SETTINGS_VERSION,
  volume: 0.5,
  muted: false,
  pixelRatio: 2,
  showFps: false,
  antialias: true,
  quality: 'BALANCED',
  adaptiveQuality: true,
  touchScale: 1,
  touchOpacity: 0.85,
  touchLeftHanded: false,
  aimDeadzone: 10,
  touchPositions: {},
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Turns anything read from storage (corrupt, old, hand-edited) into a valid Settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const volume =
    typeof r.volume === 'number' && Number.isFinite(r.volume)
      ? Math.min(1, Math.max(0, r.volume))
      : DEFAULT_SETTINGS.volume;
  let pixelRatio: PixelRatio = DEFAULT_SETTINGS.pixelRatio;
  if (typeof r.pixelRatio === 'number' && Number.isFinite(r.pixelRatio)) {
    const wanted = r.pixelRatio;
    pixelRatio = PIXEL_RATIOS.reduce((best, p) => (Math.abs(p - wanted) < Math.abs(best - wanted) ? p : best));
  }
  const clamp = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const positions: TouchSettings['touchPositions'] = {};
  if (r.touchPositions && typeof r.touchPositions === 'object')
    for (const action of TOUCH_ACTIONS) {
      const point = (r.touchPositions as Record<string, unknown>)[action];
      if (point && typeof point === 'object') {
        const p = point as Record<string, unknown>;
        if (typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y))
          positions[action] = { x: clamp(p.x, 0.5, 0, 1), y: clamp(p.y, 0.5, 0, 1) };
      }
    }
  return {
    version: SETTINGS_VERSION,
    volume,
    muted: bool(r.muted, DEFAULT_SETTINGS.muted),
    pixelRatio,
    showFps: bool(r.showFps, DEFAULT_SETTINGS.showFps),
    antialias: bool(r.antialias, DEFAULT_SETTINGS.antialias),
    quality: QUALITY_PRESETS.includes(r.quality as QualityPreset)
      ? (r.quality as QualityPreset)
      : DEFAULT_SETTINGS.quality,
    adaptiveQuality: bool(r.adaptiveQuality, true),
    touchScale: clamp(r.touchScale, 1, 0.85, 1.4),
    touchOpacity: clamp(r.touchOpacity, 0.85, 0.35, 1),
    touchLeftHanded: bool(r.touchLeftHanded, false),
    aimDeadzone: clamp(r.aimDeadzone, 10, 3, 24),
    touchPositions: positions,
  };
}

export function loadSettings(storage?: KV | null): Settings {
  return sanitizeSettings(readJson(SETTINGS_KEY, storage));
}

export function saveSettings(settings: Settings, storage?: KV | null): boolean {
  return writeJson(SETTINGS_KEY, settings, storage);
}
