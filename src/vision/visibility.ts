import type { Segment } from '../world/wallEdges';

export interface ViewParams {
  /** Eye position, world px. */
  x: number;
  y: number;
  /** Facing, radians. */
  angle: number;
  /** Cone full angle, radians. */
  fov: number;
  /** Cone range, px. */
  range: number;
  /** Radius of the 360-degree awareness ring, px. */
  proximity: number;
}

const TAU = Math.PI * 2;
/** Spec: rays at each wall endpoint angle and +-0.0001 rad, so light slips past corners without gaps. */
const EPS = 1e-4;
/** Extra rays every 2 degrees keep the range-limited arcs round (max chord error ~0.06 px at 420 px). */
const ARC_STEP = (2 * Math.PI) / 180;
/** Light spills this far onto a wall face so its rim is fully lit. */
const WALL_PAD = 2;

/** Angle in [-PI, PI). */
const wrap = (a: number): number => a - TAU * Math.floor((a + Math.PI) / TAU);

const nearBuffer: Segment[] = [];

/**
 * Visibility polygon of an eye with a forward cone and a proximity ring, as a flat
 * [x0, y0, x1, y1, ...] list written into `out`. The polygon is star-shaped around the eye:
 * one vertex per ray, sorted by angle, each cut short by the nearest wall or by the range
 * (`range` inside the cone, `proximity` outside it).
 */
export function computeVisibility(segments: readonly Segment[], view: ViewParams, out: number[] = []): number[] {
  const { x, y, angle, fov, range, proximity } = view;
  const rangeSq = range * range;
  const half = fov / 2;

  // Only walls that can touch the lit area matter.
  nearBuffer.length = 0;
  for (const s of segments) if (distSqToSegment(x, y, s) <= rangeSq) nearBuffer.push(s);

  const raw: number[] = [];
  for (const s of nearBuffer) {
    for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > rangeSq) continue;
      const a = Math.atan2(dy, dx);
      raw.push(wrap(a - EPS), wrap(a), wrap(a + EPS));
    }
  }
  for (let a = -Math.PI; a < Math.PI; a += ARC_STEP) raw.push(a);
  // The range steps from `range` to `proximity` at the cone edges: a ray on each side.
  for (const edge of [angle - half, angle + half]) raw.push(wrap(edge - EPS), wrap(edge + EPS));

  const angles = Float64Array.from(raw).sort();

  out.length = 0;
  for (const a of angles) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const reach = Math.abs(wrap(a - angle)) <= half ? range : Math.min(range, proximity);
    let hit = reach;
    for (const s of nearBuffer) {
      const t = rayHit(x, y, dx, dy, s);
      if (t < hit) hit = t;
    }
    const r = hit < reach ? Math.min(hit + WALL_PAD, reach) : reach;
    out.push(x + dx * r, y + dy * r);
  }
  return out;
}

/** Even-odd test of (px, py) against a flat polygon. */
export function pointInPolygon(poly: readonly number[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i];
    const yi = poly[i + 1];
    const xj = poly[j];
    const yj = poly[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance along the ray (ox, oy) + t * (dx, dy) to segment `s`, or Infinity. */
function rayHit(ox: number, oy: number, dx: number, dy: number, s: Segment): number {
  const sx = s.x2 - s.x1;
  const sy = s.y2 - s.y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return Infinity; // parallel
  const ax = s.x1 - ox;
  const ay = s.y1 - oy;
  const t = (ax * sy - ay * sx) / denom;
  const u = (ax * dy - ay * dx) / denom;
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

function distSqToSegment(px: number, py: number, s: Segment): number {
  const sx = s.x2 - s.x1;
  const sy = s.y2 - s.y1;
  const lenSq = sx * sx + sy * sy;
  const u = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * sx + (py - s.y1) * sy) / lenSq));
  const dx = px - (s.x1 + u * sx);
  const dy = py - (s.y1 + u * sy);
  return dx * dx + dy * dy;
}
