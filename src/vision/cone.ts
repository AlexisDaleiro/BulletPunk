const TAU = Math.PI * 2;
const forwardPoints: { angle: number; x: number; y: number }[] = [];

/** Extract only the forward fan from the actual occluded visibility polygon. No new sight rays. */
export function visionFan(polygon: readonly number[], x: number, y: number, facing: number, fov: number, out: number[] = []): number[] {
  out.length = 0;
  forwardPoints.length = 0;
  for (let i = 0; i < polygon.length; i += 2) {
    const dx = polygon[i] - x, dy = polygon[i + 1] - y;
    const raw = Math.atan2(dy, dx) - facing;
    const angle = raw - TAU * Math.floor((raw + Math.PI) / TAU);
    if (Math.abs(angle) <= fov / 2 + 1e-7) forwardPoints.push({ angle, x: polygon[i], y: polygon[i + 1] });
  }
  if (forwardPoints.length < 2) return out;
  forwardPoints.sort((a, b) => a.angle - b.angle);
  out.push(x, y);
  for (const p of forwardPoints) out.push(p.x, p.y);
  return out;
}
