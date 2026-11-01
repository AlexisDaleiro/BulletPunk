// `.ts` extensions: Node's test runner needs them for runtime imports (type imports are erased).
import { TILE_SIZE } from '../config.ts';
import { raycastTiles } from './raycast.ts';
import type { TileMap } from './TileMap.ts';

export interface Point {
  x: number;
  y: number;
}

/** Body half-width kept clear when shortcutting, so smoothed legs are walkable for an 11 px collider. */
const CLEARANCE = 11;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * A* over tiles (4-connected), then string-pulled into few long legs.
 * Returns waypoints in world px, ending exactly at `to`; empty when `to` is unreachable.
 */
export function findPath(map: TileMap, from: Point, to: Point): Point[] {
  const T = TILE_SIZE;
  const w = map.width;
  const sx = Math.floor(from.x / T);
  const sy = Math.floor(from.y / T);
  const ex = Math.floor(to.x / T);
  const ey = Math.floor(to.y / T);
  if (map.isSolid(ex, ey) || map.isSolid(sx, sy)) return [];
  if (sx === ex && sy === ey) return [to];

  const size = w * map.height;
  const start = sy * w + sx;
  const goal = ey * w + ex;
  const g = new Float32Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const heap = new MinHeap();
  g[start] = 0;
  heap.push(start, heuristic(sx, sy, ex, ey));

  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) break;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (map.isSolid(nx, ny)) continue;
      const next = ny * w + nx;
      const cost = g[cur] + 1;
      if (cost >= g[next]) continue;
      g[next] = cost;
      parent[next] = cur;
      heap.push(next, cost + heuristic(nx, ny, ex, ey));
    }
  }
  if (parent[goal] === -1) return [];

  const tiles: Point[] = [];
  for (let i = goal; i !== start; i = parent[i]) {
    tiles.push({ x: ((i % w) + 0.5) * T, y: (Math.floor(i / w) + 0.5) * T });
  }
  tiles.push(from);
  tiles.reverse();
  tiles[tiles.length - 1] = to; // aim for the exact target, not the center of its tile
  return smooth(map, tiles);
}

const heuristic = (x: number, y: number, ex: number, ey: number): number => Math.abs(x - ex) + Math.abs(y - ey);

/** Drops every waypoint that a body-wide corridor can skip. Result excludes the start point. */
function smooth(map: TileMap, pts: Point[]): Point[] {
  const out: Point[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !walkable(map, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** Three parallel rays (center and both body edges) must all be free of solid tiles. */
function walkable(map: TileMap, a: Point, b: Point): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  const px = (-dy / len) * CLEARANCE;
  const py = (dx / len) * CLEARANCE;
  const solid = (tx: number, ty: number): boolean => map.isSolid(tx, ty);
  for (const k of [-1, 0, 1]) {
    if (raycastTiles(solid, a.x + px * k, a.y + py * k, b.x + px * k, b.y + py * k)) return false;
  }
  return true;
}

/** Binary min-heap of (node, priority). */
class MinHeap {
  private readonly nodes: number[] = [];
  private readonly prios: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, prio: number): void {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.prios.push(prio);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prios[p] <= this.prios[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop() as number;
    const lastPrio = this.prios.pop() as number;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.prios[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.nodes.length && this.prios[l] < this.prios[m]) m = l;
        if (r < this.nodes.length && this.prios[r] < this.prios[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.prios[a], this.prios[b]] = [this.prios[b], this.prios[a]];
  }
}
