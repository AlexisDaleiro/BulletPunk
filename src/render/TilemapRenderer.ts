import { Container, Graphics } from 'pixi.js';
import { COLORS, TILE_SIZE } from '../config';
import type { TileMap } from '../world/TileMap';

const T = TILE_SIZE;
const FLOOR_FILL = 0x0a1119;
const WALL_FILL = 0x151e2a;
const SEAM = 0x0f4a5c;
const AMBER = 0xffe600;

/** Deterministic per-tile noise, so decoration does not change between rebuilds. */
const hash = (tx: number, ty: number): number => (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;

const NEIGHBOURS = [
  { dx: 0, dy: -1, face: (px: number, py: number) => [px, py, px + T, py] },
  { dx: 0, dy: 1, face: (px: number, py: number) => [px, py + T, px + T, py + T] },
  { dx: -1, dy: 0, face: (px: number, py: number) => [px, py, px, py + T] },
  { dx: 1, dy: 0, face: (px: number, py: number) => [px + T, py, px + T, py + T] },
] as const;

/**
 * Draws the whole map once as vector graphics: gridded floor with circuit seams, bulkhead walls
 * with a neon rim and hazard stripes, striped barricades, colored locked doors, cracked secret
 * walls and the elevator pad. Only walls touching open floor are drawn. `doorColors` maps a tile
 * index (ty * width + tx) to the glow color of the locked door standing there.
 */
export function buildTilemapGraphics(map: TileMap, doorColors: ReadonlyMap<number, number> = new Map()): Container {
  const floor = new Graphics();
  const grid = new Graphics();
  const seams = new Graphics();
  const props = new Graphics();
  const walls = new Graphics();
  const rim = new Graphics();
  const hazard = new Graphics();
  const doors = new Graphics();
  const cracks = new Graphics();
  const cover = new Graphics();

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.get(tx, ty);
      const px = tx * T;
      const py = ty * T;

      if (tile === 'VOID') continue;
      if (tile === 'WALL' || tile === 'SECRET_WALL' || tile === 'DOOR_LOCKED') {
        walls.rect(px, py, T, T);
        const h = hash(tx, ty);
        for (const n of NEIGHBOURS) {
          if (map.isSolid(tx + n.dx, ty + n.dy)) continue;
          const [x1, y1, x2, y2] = n.face(px, py);
          rim.moveTo(x1, y1).lineTo(x2, y2);
          if (tile === 'WALL' && h % 11 === 0 && n.dy === 1) {
            for (let i = 0; i < 3; i++) {
              hazard.moveTo(px + i * 16, py + T).lineTo(px + i * 16 + 16, py + T - 16);
            }
          }
        }
        if (tile === 'DOOR_LOCKED') {
          const color = doorColors.get(ty * map.width + tx) ?? AMBER;
          doors.rect(px + 5, py + 5, T - 10, T - 10).fill({ color, alpha: 0.22 }).stroke({ width: 2, color, alpha: 0.95 });
          doors.moveTo(px + 10, py + T / 2).lineTo(px + T - 10, py + T / 2).stroke({ width: 2, color, alpha: 0.95 });
        } else if (tile === 'SECRET_WALL') {
          // A zig-zag fracture through the wall: the tell that it can be blown open.
          cracks
            .moveTo(px + 10, py + 3)
            .lineTo(px + 22, py + 17)
            .lineTo(px + 14, py + 27)
            .lineTo(px + 31, py + 44);
        }
        continue;
      }

      floor.rect(px, py, T, T);
      grid.rect(px, py, T, T);
      if (hash(tx, ty) % 7 === 0) {
        seams
          .moveTo(px + T / 2, py + T / 2)
          .lineTo(px + T, py + T / 2)
          .lineTo(px + T, py + T);
      }
      if (tile === 'COVER') cover.rect(px + 6, py + 6, T - 12, T - 12);
      if (tile === 'DOOR_UNLOCKED') {
        props.rect(px + 3, py + 3, T - 6, T - 6).stroke({ width: 1.5, color: COLORS.cyan, alpha: 0.3 });
      }
      if (tile === 'EXIT_ELEVATOR') {
        const cx = px + T / 2;
        const cy = py + T / 2;
        props.circle(cx, cy, T * 0.4).stroke({ width: 2, color: AMBER, alpha: 0.9 });
        props.circle(cx, cy, T * 0.24).stroke({ width: 2, color: COLORS.cyan, alpha: 0.7 });
        props.moveTo(cx - 8, cy + 4).lineTo(cx, cy - 5).lineTo(cx + 8, cy + 4).stroke({ width: 2.5, color: AMBER, alpha: 0.9 });
      }
    }
  }

  floor.fill(FLOOR_FILL);
  grid.stroke({ width: 1, color: COLORS.grid, alpha: 0.9 });
  seams.stroke({ width: 1.5, color: SEAM, alpha: 0.7 });
  walls.fill(WALL_FILL);
  rim.stroke({ width: 2, color: COLORS.cyan, alpha: 0.55 });
  hazard.stroke({ width: 3, color: AMBER, alpha: 0.45 });
  cracks.stroke({ width: 2, color: AMBER, alpha: 0.75 });
  cover.fill(0x1d2a38).stroke({ width: 2, color: AMBER, alpha: 0.7 });
  for (const g of [seams, props, rim, hazard, doors, cracks]) g.blendMode = 'add';

  const root = new Container();
  root.addChild(floor, grid, seams, props, walls, rim, hazard, doors, cracks, cover);
  return root;
}

/** Owns the drawn tilemap and swaps it for a fresh drawing whenever tiles change (door opens, wall breaks). */
export class TilemapView {
  private readonly parent: Container;
  private current: Container | null = null;

  constructor(parent: Container) {
    this.parent = parent;
  }

  rebuild(map: TileMap, doorColors: ReadonlyMap<number, number>): void {
    this.current?.destroy({ children: true });
    this.current = buildTilemapGraphics(map, doorColors);
    this.parent.addChild(this.current);
  }
}
