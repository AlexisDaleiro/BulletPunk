export interface RunExperience {
  level: number;
  xp: number;
  total: number;
  pending: number;
}

export const KILL_XP = { normal: 20, elite: 60 } as const;
export const experienceRequired = (level: number): number => 60 + 30 * Math.max(0, level - 1);
export const createExperience = (): RunExperience => ({ level: 1, xp: 0, total: 0, pending: 0 });

/** Overflow is kept, including when a single reward earns several upgrade choices. */
export function gainExperience(progress: RunExperience, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) return 0;
  const gained = Math.floor(amount);
  progress.xp += gained;
  progress.total += gained;
  while (progress.xp >= experienceRequired(progress.level)) {
    progress.xp -= experienceRequired(progress.level);
    progress.level++;
    progress.pending++;
  }
  return gained;
}
