import { pointInPolygon, type ViewParams } from './visibility.ts';

/** Hostiles require the forward cone; the proximity ring never reveals a body behind you. */
export function hostileVisible(view: ViewParams, polygon: readonly number[], x: number, y: number): boolean {
  const dx = x - view.x, dy = y - view.y;
  if (dx * dx + dy * dy > view.range * view.range) return false;
  const offset = Math.atan2(dy, dx) - view.angle;
  if (Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset))) > view.fov / 2) return false;
  return pointInPolygon(polygon, x, y);
}
