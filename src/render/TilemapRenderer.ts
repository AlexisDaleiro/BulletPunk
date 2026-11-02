import { Container, Graphics } from 'pixi.js';
import { COLORS, TILE_SIZE } from '../config';
import type { TileMap } from '../world/TileMap';

const T = TILE_SIZE;
const FLOOR_FILL = 0x172027;
const WALL_FILL = 0x2b363e;
const SEAM = 0x394a51;
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
  const surface = new Graphics();
  const contact = new Graphics();
  const wallDetail = new Graphics();
  const wear = new Graphics();

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.get(tx, ty);
      const px = tx * T;
      const py = ty * T;

      if (tile === 'VOID') continue;
      if (tile === 'WALL' || tile === 'SECRET_WALL' || tile === 'DOOR_LOCKED') {
        walls.rect(px, py, T, T);
        const h = hash(tx, ty);
        wallDetail.roundRect(px + 3, py + 3, T - 6, T - 6, 2).fill(0x303e47).stroke({ color: 0x48555b, width: 0.7, alpha: 0.65 });
        wallDetail.rect(px + 5, py + T - 8, T - 10, 4).fill(0x1b252c);
        if (h % 3 === 0) {
          for (let i = 0; i < 4; i++) wallDetail.rect(px + 12, py + 11 + i * 5, 22, 2).fill(0x182329);
        }
        for (const n of NEIGHBOURS) {
          if (map.isSolid(tx + n.dx, ty + n.dy)) continue;
          const [x1, y1, x2, y2] = n.face(px, py);
          rim.moveTo(x1, y1).lineTo(x2, y2);
          if (n.dy !== 0) contact.rect(px, n.dy < 0 ? py - 5 : py + T, T, 5);
          else contact.rect(n.dx < 0 ? px - 5 : px + T, py, 5, T);
          if (h % 13 === 0 && tile === 'WALL') {
            props.moveTo(x1 + (x2 - x1) * 0.35, y1 + (y2 - y1) * 0.35)
              .lineTo(x1 + (x2 - x1) * 0.65, y1 + (y2 - y1) * 0.65).stroke({ color: 0x83aaa8, width: 2, alpha: 0.7 });
          }
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
      const h = hash(tx, ty);
      // Broad panel groups and restrained variation replace the uniform glowing grid.
      surface.rect(px + 1, py + 1, T - 2, T - 2).fill({ color: h % 3 === 0 ? 0x26333b : 0x1d2930, alpha: 0.65 });
      if (tx % 2 === 0) grid.moveTo(px, py).lineTo(px, py + T);
      if (ty % 2 === 0) grid.moveTo(px, py).lineTo(px + T, py);
      if (h % 5 === 0) {
        for (const dx of [5, T - 5]) wear.circle(px + dx, py + 5, 0.9).fill(0x718087);
      }
      if (h % 4 === 0) {
        const ox = 8 + h % 21;
        wear.moveTo(px + ox, py + 14).lineTo(px + ox + 7, py + 12)
          .moveTo(px + ox + 2, py + 17).lineTo(px + ox + 10, py + 15).stroke({ color: 0x697779, width: 0.7, alpha: 0.22 });
      }
      if (h % 17 === 0 && tile === 'FLOOR') {
        surface.roundRect(px + 7, py + 7, T - 14, T - 14, 2).fill(0x131b21).stroke({ color: 0x455159, width: 1 });
        for (let i = 0; i < 5; i++) wear.moveTo(px + 11, py + 12 + i * 6).lineTo(px + T - 11, py + 12 + i * 6).stroke({ color: 0x57656a, width: 1, alpha: 0.45 });
      }
      if (h % 11 === 0) {
        seams
          .moveTo(px + T / 2, py + T / 2)
          .lineTo(px + T, py + T / 2)
          .lineTo(px + T, py + T);
      }
      if (tile === 'COVER') {
        contact.roundRect(px + 7, py + 10, T - 10, T - 11, 3);
        cover.roundRect(px + 5, py + 5, T - 10, T - 10, 2).fill(0x27343c).stroke({ color: 0x768079, width: 1.2 });
        cover.rect(px + 9, py + 8, T - 18, 8).fill(0x4b5a60);
        cover.rect(px + 10, py + 19, T - 20, 17).fill(0x34434a).stroke({ color: 0x172329, width: 1 });
        cover.rect(px + 10, py + 19, 5, 17).fill(0xada077);
        cover.moveTo(px + 10, py + 23).lineTo(px + 15, py + 28).moveTo(px + 10, py + 31).lineTo(px + 15, py + 36).stroke({ color: 0x3a3c32, width: 2 });
        cover.rect(px + T / 2 - 4, py + 24, 8, 3).fill(0x111a20);
      }
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
  grid.stroke({ width: 1, color: 0x0c141b, alpha: 0.55 });
  seams.stroke({ width: 1, color: SEAM, alpha: 0.4 });
  walls.fill(WALL_FILL);
  contact.fill({ color: 0x000000, alpha: 0.32 });
  rim.stroke({ width: 1.5, color: 0x789398, alpha: 0.65 });
  hazard.stroke({ width: 3, color: 0xb0a16e, alpha: 0.6 });
  cracks.stroke({ width: 2, color: AMBER, alpha: 0.75 });
  for (const g of [props, doors, cracks]) g.blendMode = 'add';

  const root = new Container();
  root.addChild(floor, surface, grid, seams, wear, contact, walls, wallDetail, rim, hazard, props, doors, cracks, cover);
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
