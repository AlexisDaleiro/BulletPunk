/** The page address with `?seed=N`, which replays a run; any query or hash on `base` is dropped. */
export function seedUrl(base: string, seed: number): string {
  return `${base.split(/[?#]/)[0]}?seed=${seed}`;
}

/** Seconds as M:SS, or H:MM:SS from one hour on. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
