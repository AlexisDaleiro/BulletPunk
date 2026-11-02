import { readJson, removeKey, writeJson, type KV } from '../core/storage.ts';
import { DEFAULT_CHARACTER_ID } from '../characters/characters.ts';

export const PROFILE_KEY = 'bulletpunk.profile';
export const PROFILE_VERSION = 1;
export const NAME_MAX = 16;
const NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;
const ID_PATTERN = /^[A-Z][A-Z0-9_]{0,23}$/;

export interface ProfileStats {
  runs: number;
  bestFloor: number;
  totalTimeSec: number;
  maxCredits: number;
  kills: number;
}

export interface Profile {
  version: number;
  name: string;
  /** The operative JUGAR starts with. */
  lastCharacter: string;
  stats: ProfileStats;
  /** Runs started per character id; the most played one is the favorite. */
  runsByCharacter: Record<string, number>;
}

/** What one finished or abandoned run adds to the profile. */
export interface RunSummary {
  characterId: string;
  floor: number;
  credits: number;
  timeSec: number;
  kills: number;
}

export function defaultProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    name: 'OPERATIVE',
    lastCharacter: DEFAULT_CHARACTER_ID,
    stats: { runs: 0, bestFloor: 0, totalTimeSec: 0, maxCredits: 0, kills: 0 },
    runsByCharacter: {},
  };
}

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateName(raw: string): NameResult {
  const name = raw.trim().replace(/ {2,}/g, ' ');
  if (name.length === 0) return { ok: false, error: 'NAME CANNOT BE EMPTY' };
  if (name.length > NAME_MAX) return { ok: false, error: `MAX ${NAME_MAX} CHARACTERS` };
  if (!NAME_PATTERN.test(name)) return { ok: false, error: 'LETTERS, NUMBERS, SPACE, _ AND - ONLY' };
  return { ok: true, name };
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function sanitizeProfile(raw: unknown): Profile {
  const base = defaultProfile();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === 'string' ? validateName(r.name) : null;
  if (name?.ok) base.name = name.name;
  if (typeof r.lastCharacter === 'string' && ID_PATTERN.test(r.lastCharacter)) base.lastCharacter = r.lastCharacter;

  const s = typeof r.stats === 'object' && r.stats !== null ? (r.stats as Record<string, unknown>) : {};
  base.stats = {
    runs: Math.floor(count(s.runs)),
    bestFloor: Math.floor(count(s.bestFloor)),
    totalTimeSec: count(s.totalTimeSec),
    maxCredits: Math.floor(count(s.maxCredits)),
    kills: Math.floor(count(s.kills)),
  };

  if (typeof r.runsByCharacter === 'object' && r.runsByCharacter !== null) {
    for (const [id, n] of Object.entries(r.runsByCharacter)) {
      if (ID_PATTERN.test(id) && Math.floor(count(n)) > 0) base.runsByCharacter[id] = Math.floor(count(n));
    }
  }
  return base;
}

/** Folds one run into the profile and returns the new profile; the input is not modified. */
export function recordRun(profile: Profile, run: RunSummary): Profile {
  const { stats } = profile;
  return {
    ...profile,
    stats: {
      runs: stats.runs + 1,
      bestFloor: Math.max(stats.bestFloor, Math.floor(count(run.floor))),
      totalTimeSec: stats.totalTimeSec + count(run.timeSec),
      maxCredits: Math.max(stats.maxCredits, Math.floor(count(run.credits))),
      kills: stats.kills + Math.floor(count(run.kills)),
    },
    runsByCharacter: { ...profile.runsByCharacter, [run.characterId]: (profile.runsByCharacter[run.characterId] ?? 0) + 1 },
  };
}

/** Most played operative; ties go to the one reached first. Null before any run. */
export function favoriteCharacter(profile: Profile): string | null {
  let best: string | null = null;
  let bestRuns = 0;
  for (const [id, n] of Object.entries(profile.runsByCharacter)) {
    if (n > bestRuns) {
      best = id;
      bestRuns = n;
    }
  }
  return best;
}

export function loadProfile(storage?: KV | null): Profile {
  return sanitizeProfile(readJson(PROFILE_KEY, storage));
}

export function saveProfile(profile: Profile, storage?: KV | null): boolean {
  return writeJson(PROFILE_KEY, profile, storage);
}

export function clearProfile(storage?: KV | null): void {
  removeKey(PROFILE_KEY, storage);
}
