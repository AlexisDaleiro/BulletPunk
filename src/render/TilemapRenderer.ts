import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COLORS, KEY_INFO, TILE_SIZE } from '../config';
import type { TileType } from '../types';
import type { Dungeon } from '../world/DungeonGenerator';
import type { Door } from '../world/locks';
import type { Decor } from '../world/plan';
import type { TileMap } from '../world/TileMap';
import { drawTileObject, shade, WALL_PAL, type ObjCtx } from './tileObjects';
import { sectorAtmosphere } from './sectorAtmosphere';
import { LiveScenery, type CombatSource } from './LiveScenery';
import {districtMarkings} from './districtMarkings';
import {visualQuality} from './visualQuality';

const T = TILE_SIZE;
const AMBER = 0xffe600;
const SECTOR_INDEX = { MILITARY: 0, URBAN: 1, LAB: 2 } as const;

/** Floor material per sector: [base, plate A, plate B, seam, highlight]. */
const FLOOR_PAL = [
  [0x1b2127, 0x242c33, 0x1f272d, 0x0d1216, 0x3d4a52],
  [0x1c2026, 0x272c35, 0x21262d, 0x0f1217, 0x404854],
  [0x1b2a2b, 0x263b3d, 0x203335, 0x0e1b1c, 0x4f7270],
] as const;

/** Tiles drawn as separate objects (they can change or be destroyed). Everything else non-void is floor or wall. */
const DYNAMIC = new Set<TileType>([
  'COVER', 'CRATE', 'BARREL', 'CONTAINER', 'MACHINE', 'DOOR_LOCKED', 'DOOR_UNLOCKED', 'SHUTTER', 'SECRET_WALL', 'WEAK_WALL', 'RUBBLE', 'EXIT_ELEVATOR',
]);
/** Tiles that read as wall for shadows and neighbouring faces. */
const WALLISH = new Set<TileType>(['WALL', 'SECRET_WALL', 'WEAK_WALL', 'SHUTTER', 'DOOR_LOCKED']);

/** Deterministic per-tile noise, so decoration does not change between rebuilds. */
const hash = (tx: number, ty: number): number => (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;

let glow: Texture | null = null;
/** One soft white disc, tinted per lamp: every light on the floor shares this texture. */
function glowTexture(): Texture {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glow = Texture.from(c);
  return glow;
}

interface Grids {
  zone: Int16Array;
  sector: Uint8Array;
}

/** Which room and sector every tile belongs to; walls and corridors inherit the nearest room's. */
function computeGrids(d: Dungeon): Grids {
  const { map } = d;
  const zone = new Int16Array(map.width * map.height).fill(-1);
  const sector = new Uint8Array(map.width * map.height).fill(255);
  const queue: number[] = [];
  d.rooms.forEach((r, i) => {
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        zone[y * map.width + x] = i;
        sector[y * map.width + x] = SECTOR_INDEX[r.sector];
      }
    }
  });
  for (let i = 0; i < sector.length; i++) if (sector[i] !== 255) queue.push(i);
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % map.width;
    const y = (i - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const j = ny * map.width + nx;
      if (sector[j] !== 255 || map.get(nx, ny) === 'VOID') continue;
      sector[j] = sector[i];
      queue.push(j);
    }
  }
  for (let i = 0; i < sector.length; i++) if (sector[i] === 255) sector[i] = 0;
  return { zone, sector };
}

const floorish = (t: TileType): boolean => t !== 'VOID' && t !== 'WALL';

/** Floor plates of mixed sizes, bevelled and bolted, so the floor reads as material rather than a grid. */
function drawFloor(map: TileMap, grids: Grids): Container {
  const fill = new Graphics();
  const seams = new Graphics();
  const hi = new Graphics();
  const dots = new Graphics();
  const wear = new Graphics();
  const used = new Uint8Array(map.width * map.height);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const i = ty * map.width + tx;
      if (used[i] || !floorish(map.get(tx, ty))) continue;
      const sec = grids.sector[i];
      const h = hash(tx, ty);
      const r = h % 10;
      let [pw, ph] = sec === 0 ? (r < 3 ? [2, 2] : r < 5 ? [3, 2] : r < 7 ? [2, 1] : r < 8 ? [1, 2] : [1, 1]) : sec === 1 ? (r < 3 ? [2, 1] : r < 5 ? [1, 2] : r < 6 ? [2, 2] : [1, 1]) : r < 2 ? [2, 1] : [1, 1];
      const fits = (w: number, hh: number): boolean => {
        for (let y = 0; y < hh; y++) {
          for (let x = 0; x < w; x++) {
            const j = (ty + y) * map.width + tx + x;
            if (!map.inBounds(tx + x, ty + y) || used[j] || !floorish(map.get(tx + x, ty + y)) || grids.zone[j] !== grids.zone[i]) return false;
          }
        }
        return true;
      };
      while (!fits(pw, ph)) {
        if (pw > 1) pw--;
        else ph--;
        if (pw === 1 && ph === 1) break;
      }
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) used[(ty + y) * map.width + tx + x] = 1;
      const [base, a, b, , hl] = FLOOR_PAL[sec];
      const px = tx * T;
      const py = ty * T;
      const w = pw * T;
      const hgt = ph * T;
      const pick = (h >> 4) % 3;
      const tone = pick === 0 ? b : pick === 1 ? a : shade(a, 0.9 + ((h >> 8) % 5) * 0.03);
      fill.rect(px, py, w, hgt).fill(base).rect(px + 0.5, py + 0.5, w - 1, hgt - 1).fill(tone);
      seams.rect(px, py, w, hgt);
      hi.moveTo(px + 1.5, py + hgt - 1.5).lineTo(px + 1.5, py + 1.5).lineTo(px + w - 1.5, py + 1.5);
      if (sec === 0 && pw * ph >= 2) {
        for (const [dx, dy] of [[5, 5], [w - 5, 5], [5, hgt - 5], [w - 5, hgt - 5]]) dots.circle(px + dx, py + dy, 1.1);
        if (h % 4 === 0) for (let k = 0; k < 4; k++) wear.moveTo(px + 8 + k * 9, py + hgt - 8).lineTo(px + 16 + k * 9, py + 8);
      } else if (sec === 1 && h % 6 === 0) {
        fill.rect(px + 4, py + 4, w - 8, hgt - 8).fill({ color: hl, alpha: 0.07 });
      } else if (sec === 2) {
        if (pw === 1 && ph === 1) wear.moveTo(px + T / 2, py).lineTo(px + T / 2, py + T).moveTo(px, py + T / 2).lineTo(px + T, py + T / 2);
        if (h % 9 === 0) wear.moveTo(px + 6, py + 8).lineTo(px + 20, py + 22).lineTo(px + 17, py + 34).lineTo(px + 34, py + 44);
      }
    }
  }
  seams.stroke({ width: 1, color: 0x0b0f12, alpha: 0.85 });
  hi.stroke({ width: 1, color: 0x6f808a, alpha: 0.28 });
  dots.fill({ color: 0x6e7a80, alpha: 0.7 });
  wear.stroke({ width: 1, color: 0x0b1012, alpha: 0.3 });
  const root = new Container();
  root.addChild(fill, seams, hi, dots, wear);
  return root;
}

/** Walls with a lit cap, a darker front face and per-sector markings; shadows fall on the floor beside them. */
function drawWalls(map: TileMap, grids: Grids): Container {
  const shadow = new Graphics();
  const mass = new Graphics();
  const detail = new Graphics();
  const lines = new Graphics();
  const amber = new Graphics();
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.get(tx, ty);
      const px = tx * T;
      const py = ty * T;
      const i = ty * map.width + tx;
      const sec = grids.sector[i];
      const h = hash(tx, ty);

      if (floorish(tile)) {
        if (WALLISH.has(map.get(tx, ty - 1))) shadow.rect(px, py, T, 7).fill({ color: 0x000000, alpha: 0.4 }).rect(px, py + 7, T, 5).fill({ color: 0x000000, alpha: 0.17 });
        if (WALLISH.has(map.get(tx - 1, ty))) shadow.rect(px, py, 6, T).fill({ color: 0x000000, alpha: 0.3 });
        if (WALLISH.has(map.get(tx + 1, ty))) shadow.rect(px + T - 3, py, 3, T).fill({ color: 0x000000, alpha: 0.18 });
        if (WALLISH.has(map.get(tx, ty + 1))) shadow.rect(px, py + T - 3, T, 3).fill({ color: 0x000000, alpha: 0.2 });
        continue;
      }
      if (tile !== 'WALL') continue;
      let visible = false;
      for (let dy = -1; dy <= 1 && !visible; dy++) for (let dx = -1; dx <= 1; dx++) if (floorish(map.get(tx + dx, ty + dy))) visible = true;
      if (!visible) continue;

      const [cap, face, rim] = WALL_PAL[sec];
      mass.rect(px, py, T, T).fill(shade(cap, 0.93 + (h % 7) * 0.015));
      if (floorish(map.get(tx, ty + 1))) {
        // Front face: darker, with seams that do not line up tile to tile.
        mass.rect(px, py + T - 15, T, 15).fill(face);
        lines.moveTo(px, py + T - 15).lineTo(px + T, py + T - 15);
        if ((tx + (ty % 3)) % (sec === 0 ? 3 : sec === 1 ? 5 : 2) === 0) detail.rect(px + T - 1, py + T - 15, 1.5, 15).fill({ color: 0x000000, alpha: 0.5 });
        if (sec === 0) {
          for (const x of [px + 6, px + T - 7]) detail.circle(x, py + T - 8, 1).fill({ color: rim, alpha: 0.8 });
          if (((tx >> 1) + ty * 3) % 7 === 0) for (let k = 0; k < 4; k++) amber.moveTo(px + k * 13, py + T - 2).lineTo(px + k * 13 + 12, py + T - 14);
        } else if (sec === 1) {
          detail.rect(px, py + T - 9, T, 3).fill({ color: 0x6f7fb3, alpha: 0.32 });
          if (h % 19 === 0) detail.rect(px + 10, py + T - 14, 16, 7).fill({ color: 0xffd27a, alpha: 0.5 });
          if (h % 4 === 0) detail.rect(px, py + T - 5, T, 2).fill({ color: 0x0d0f13, alpha: 0.6 });
        } else {
          for (let k = 1; k < 4; k++) detail.rect(px + k * 12, py + T - 15, 1, 15).fill({ color: 0x000000, alpha: 0.22 });
          if (h % 11 === 0) lines.moveTo(px + 10, py + T - 14).lineTo(px + 16, py + T - 7).lineTo(px + 12, py + T - 1);
        }
      }
      if (floorish(map.get(tx, ty - 1))) mass.rect(px, py, T, 2.2).fill({ color: rim, alpha: 0.85 });
      if (floorish(map.get(tx - 1, ty))) mass.rect(px, py, 2, T).fill({ color: rim, alpha: 0.4 });
      if (floorish(map.get(tx + 1, ty))) mass.rect(px + T - 2, py, 2, T).fill({ color: 0x000000, alpha: 0.35 });
      if (map.variant(tx, ty) === 1) {
        // A partition between lab cells: a bulkhead with a window.
        detail.rect(px + 8, py + 9, T - 16, T - 28).fill({ color: 0x9fe8c0, alpha: 0.2 }).stroke({ color: rim, width: 1.2, alpha: 0.8 });
      }
    }
  }
  lines.stroke({ width: 1, color: 0x050809, alpha: 0.7 });
  amber.stroke({ width: 3, color: 0xb59b3a, alpha: 0.5 });
  const root = new Container();
  root.addChild(shadow, mass, detail, lines, amber);
  return root;
}

const blob = (g: Graphics, cx: number, cy: number, w: number, h: number, seed: number): void => {
  const pts: number[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const r = 0.72 + (((seed >> (k * 2)) & 3) / 3) * 0.4;
    pts.push(cx + Math.cos(a) * (w / 2) * r, cy + Math.sin(a) * (h / 2) * r);
  }
  g.poly(pts);
};

/** Scenery: stains, patches, cables, signs, pads. Floor items first; pipes and signs sit on the walls. */
function drawDecor(list: readonly Decor[]): { floor: Container; wall: Container; neon: Graphics } {
  const f = new Graphics();
  const w = new Graphics();
  const neon = new Graphics();
  neon.blendMode = 'add';
  list.forEach((d, n) => {
    const seed = hash(Math.round(d.x), Math.round(d.y)) ^ n;
    const cos = Math.cos(d.rot);
    const sin = Math.sin(d.rot);
    const at = (lx: number, ly: number): [number, number] => [d.x + lx * cos - ly * sin, d.y + lx * sin + ly * cos];
    const quad = (g: Graphics, lw: number, lh: number): void => {
      g.poly([at(-lw / 2, -lh / 2), at(lw / 2, -lh / 2), at(lw / 2, lh / 2), at(-lw / 2, lh / 2)].flat());
    };
    switch (d.kind) {
      case 'STAIN':
      case 'SCORCH': {
        const tone = d.kind === 'SCORCH' ? 0x050505 : [0x06080a, 0x2b3a2a, 0x3a2b24, 0x4a2c1d][d.variant & 3];
        blob(f, d.x, d.y, d.w, d.h, seed);
        f.fill({ color: tone, alpha: d.kind === 'SCORCH' ? 0.5 : 0.34 });
        blob(f, d.x + 3, d.y + 2, d.w * 0.55, d.h * 0.5, seed >> 3);
        f.fill({ color: tone, alpha: 0.25 });
        break;
      }
      case 'PATCH': {
        const x = d.x - d.w / 2;
        const y = d.y - d.h / 2;
        const tone = [0x2a3036, 0x1a1f23, 0x3a2a30, 0x2f3d3f][d.variant & 3];
        f.rect(x + 2, y + 2, d.w - 4, d.h - 4).fill({ color: tone, alpha: 0.88 }).stroke({ color: shade(tone, 1.6), width: 1.5, alpha: 0.6 });
        if (d.variant === 0) {
          for (let k = 0; k < d.w + d.h; k += 9) f.moveTo(x + Math.min(k, d.w - 2), y + Math.max(0, k - d.w + 2)).lineTo(x + Math.max(0, k - d.h + 2), y + Math.min(k, d.h - 2)).stroke({ color: 0x4d5760, width: 1, alpha: 0.3 });
        }
        if (d.variant === 3) {
          for (let k = T; k < d.w; k += T) f.moveTo(x + k, y + 2).lineTo(x + k, y + d.h - 2).stroke({ color: 0x1b2425, width: 1, alpha: 0.7 });
          for (let k = T; k < d.h; k += T) f.moveTo(x + 2, y + k).lineTo(x + d.w - 2, y + k).stroke({ color: 0x1b2425, width: 1, alpha: 0.7 });
        }
        break;
      }
      case 'STRIPES': {
        const x = d.x - d.w / 2;
        const y = d.y - d.h / 2;
        if (d.variant === 1) f.rect(x, y, d.w, d.h).fill({ color: 0xb59b3a, alpha: 0.4 });
        else f.rect(x + 3, y + 3, d.w - 6, d.h - 6).stroke({ color: 0xb59b3a, width: 3, alpha: 0.32 });
        break;
      }
      case 'MARKS':
      case 'DRAG': {
        const lines = d.kind === 'DRAG' ? 3 : 2;
        for (let k = 0; k < lines; k++) {
          const off = (k - (lines - 1) / 2) * (d.h / lines + 3);
          const [x1, y1] = at(-d.w / 2, off);
          const [x2, y2] = at(d.w / 2, off + (d.kind === 'DRAG' ? 4 : 0));
          const [cx, cy] = at(0, off - (d.kind === 'DRAG' ? 7 : 2));
          f.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({ color: d.kind === 'DRAG' ? 0xaab4b6 : 0x0a0d0f, width: d.kind === 'DRAG' ? 1.6 : 1.4, alpha: d.kind === 'DRAG' ? 0.38 : 0.4 });
        }
        break;
      }
      case 'CABLE': {
        const [x1, y1] = at(-d.w / 2, 0);
        const [x2, y2] = at(d.w / 2, 0);
        const [cx, cy] = at(0, 10 + (seed % 9));
        f.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({ color: 0x0a0d10, width: 3.5, alpha: 0.9 });
        f.moveTo(x1, y1 - 1).quadraticCurveTo(cx, cy - 1, x2, y2 - 1).stroke({ color: 0x3a444b, width: 1, alpha: 0.7 });
        break;
      }
      case 'PIPE': {
        const horiz = d.w >= d.h;
        w.rect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h).fill(0x4d565b).stroke({ color: 0x15191c, width: 1.2 });
        if (horiz) w.moveTo(d.x - d.w / 2, d.y - d.h / 2 + 2).lineTo(d.x + d.w / 2, d.y - d.h / 2 + 2).stroke({ color: 0x8b979c, width: 1.4, alpha: 0.6 });
        else w.moveTo(d.x - d.w / 2 + 2, d.y - d.h / 2).lineTo(d.x - d.w / 2 + 2, d.y + d.h / 2).stroke({ color: 0x8b979c, width: 1.4, alpha: 0.6 });
        for (let k = 30; k < (horiz ? d.w : d.h); k += 60) {
          if (horiz) w.rect(d.x - d.w / 2 + k, d.y - d.h / 2 - 2, 4, d.h + 4).fill(0x252b2f);
          else w.rect(d.x - d.w / 2 - 2, d.y - d.h / 2 + k, d.w + 4, 4).fill(0x252b2f);
        }
        break;
      }
      case 'DEBRIS':
        for (let k = 0; k < 4; k++) {
          const [x, y] = at(((seed >> (k * 3)) % 24) - 12, ((seed >> (k * 3 + 1)) % 20) - 10);
          f.poly([x, y, x + 5, y + 2, x + 2, y + 6]).fill({ color: d.variant === 2 ? 0x8a949a : [0x59605f, 0x7fa5a0, 0x6b5a3e][d.variant % 3], alpha: 0.85 });
        }
        break;
      case 'PUDDLE':
        blob(f, d.x, d.y, d.w * 0.9, d.h * 0.85, seed);
        f.fill({ color: d.variant === 1 ? 0x3f9d4f : 0x2a4258, alpha: d.variant === 1 ? 0.42 : 0.3 });
        blob(f, d.x - d.w * 0.12, d.y - d.h * 0.1, d.w * 0.3, d.h * 0.2, seed >> 2);
        f.fill({ color: d.variant === 1 ? 0xa6ffb4 : 0x9fc4e8, alpha: 0.16 });
        break;
      case 'PAD': {
        const color = d.variant === 1 ? AMBER : COLORS.cyan;
        f.circle(d.x, d.y, d.w * 0.46).fill({ color: 0x0b1216, alpha: 0.7 }).stroke({ color, width: 2, alpha: 0.5 });
        f.circle(d.x, d.y, d.w * 0.3).stroke({ color, width: 1.5, alpha: 0.35 });
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          f.moveTo(d.x + Math.cos(a) * d.w * 0.34, d.y + Math.sin(a) * d.w * 0.34).lineTo(d.x + Math.cos(a) * d.w * 0.46, d.y + Math.sin(a) * d.w * 0.46).stroke({ color, width: 3, alpha: 0.55 });
        }
        break;
      }
      case 'BED':
        quad(f, d.w - 8, d.h - 8);
        f.fill(0x6b7f82).stroke({ color: 0x1b2425, width: 1.5 });
        quad(f, d.w * 0.28, d.h - 16);
        f.fill(0xcfdadc);
        break;
      case 'BEDROLL': {
        quad(f, d.w, d.h);
        f.fill(0x5b5240).stroke({ color: 0x241f16, width: 1.5 });
        const [bx, by] = at(-d.w / 2 + 4, 0);
        f.circle(bx, by, d.h * 0.4).fill(0x7a6e55);
        break;
      }
      case 'WRECK': {
        f.circle(d.x, d.y, 11).fill(0x3d4447).stroke({ color: 0x14181a, width: 1.5 });
        f.circle(d.x, d.y, 4).fill({ color: 0x1b2023 });
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + 0.6;
          f.moveTo(d.x + Math.cos(a) * 10, d.y + Math.sin(a) * 10).lineTo(d.x + Math.cos(a) * 20, d.y + Math.sin(a) * 18).stroke({ color: 0x2c3235, width: 2.2 });
        }
        break;
      }
      case 'LEAK': {
        const [x1, y1] = at(-d.w / 2, 0);
        const [x2, y2] = at(d.w / 2, 0);
        neon.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0xffc66b, width: d.h, alpha: 0.55 });
        break;
      }
      case 'CRACK': {
        const [a1, a2] = at(-d.w / 2, -d.h / 4);
        const [b1, b2] = at(-d.w / 6, d.h / 8);
        const [c1, c2] = at(d.w / 8, -d.h / 8);
        const [e1, e2] = at(d.w / 2, d.h / 3);
        f.moveTo(a1, a2).lineTo(b1, b2).lineTo(c1, c2).lineTo(e1, e2).stroke({ color: 0x050708, width: 1.4, alpha: 0.7 });
        break;
      }
      case 'SIGN': {
        const color = d.color ?? COLORS.cyan;
        quad(w, d.w, d.h);
        w.fill(0x0b1015).stroke({ color: 0x3b454c, width: 1.5 });
        quad(neon, d.w - 6, d.h - 6);
        neon.fill({ color, alpha: 0.5 }).stroke({ color, width: 1.5, alpha: 0.95 });
        break;
      }
      case 'LOG':
        quad(f, d.w, d.h);
        f.fill(0x0a1216).stroke({ color: 0x31434c, width: 1 });
        quad(neon, d.w - 6, d.h - 6);
        neon.fill({ color: 0x6fb4ff, alpha: 0.5 });
        break;
      default:
        break;
    }
  });
  const floor = new Container();
  floor.addChild(f);
  const wall = new Container();
  wall.addChild(w);
  return { floor, wall, neon };
}

/**
 * Draws a whole floor once (floor plates, walls, decor, light) and keeps the destructible and
 * changeable tiles (cover, crates, barrels, doors, secrets) as individual objects that can be
 * redrawn alone. Opening a door or breaking a crate never redraws the map.
 */
export class TilemapView {
  private reflections:Sprite[]=[];
  private lightNodes:Sprite[]=[];
  private quality='';
  private live: LiveScenery | null = null;
  private readonly parent: Container;
  private root: Container | null = null;
  private readonly objects = new Map<number, Graphics>();
  private objectLayer = new Container();
  private dungeon: Dungeon | null = null;
  private grids: Grids | null = null;
  private doorColors = new Map<number, number>();
  private readonly health = new Map<number, number>();
  private flicker: { sprite: Sprite; base: number; phase: number; speed: number }[] = [];
  private time = 0;

  constructor(parent: Container) {
    this.parent = parent;
  }

  build(d: Dungeon): void {
    this.root?.destroy({ children: true });
    this.objects.clear();
    this.health.clear();
    this.flicker = [];
    this.reflections=[];this.lightNodes=[];this.quality='';
    this.dungeon = d;
    const grids = computeGrids(d);
    this.grids = grids;
    this.setDoorColors(d.doors, false);

    const decor = drawDecor(d.plan.decor);
    const lights = new Container();
    const tex = glowTexture();
    for (const l of d.plan.lights) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.position.set(l.x, l.y);
      s.width = s.height = l.r * 2;
      s.tint = l.color;
      s.alpha = l.alpha;
      s.blendMode = 'add';
      lights.addChild(s);
      this.lightNodes.push(s);
      // A narrow reflection gives the light a wet material response with no post-process pass.
      const reflection = new Sprite(tex);
      reflection.anchor.set(.5);
      reflection.position.set(l.x + l.r * .12, l.y + l.r * .32);
      reflection.width = l.r * .95;
      reflection.height = l.r * .13;
      reflection.tint = l.color;
      reflection.alpha = l.alpha * .3;
      reflection.blendMode = 'add';
      lights.addChild(reflection);
      this.reflections.push(reflection);
      if (l.flicker) this.flicker.push({ sprite: s, base: l.alpha, phase: Math.random() * 10, speed: 5 + Math.random() * 9 });
    }
    // Terminals get a small steady glow of their own.
    for (const t of d.plan.terminals) this.addGlow(lights, (t.tx + 0.5) * T, (t.ty + 0.5) * T, 70, 0x6fb4ff, 0.25);

    this.objectLayer = new Container();
    this.live = new LiveScenery(d);
    this.root = new Container();
    this.root.addChild(drawFloor(d.map, grids), districtMarkings(d),sectorAtmosphere(d), decor.floor, this.live, drawWalls(d.map, grids), this.objectLayer, decor.wall, decor.neon, lights);
    this.parent.addChild(this.root);

    for (let ty = 0; ty < d.map.height; ty++) for (let tx = 0; tx < d.map.width; tx++) this.draw(tx, ty);
  }

  private addGlow(into: Container, x: number, y: number, r: number, color: number, alpha: number): void {
    const s = new Sprite(glowTexture());
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = r * 2;
    s.tint = color;
    s.alpha = alpha;
    s.blendMode = 'add';
    into.addChild(s);
  }

  /** Redraws the changed tiles and their neighbours (adjacent containers and machines merge). */
  update(changes: readonly { x: number; y: number; tile: TileType }[]): void {
    if (!this.dungeon) return;
    for (const c of changes) {
      this.health.delete(c.y * this.dungeon.map.width + c.x);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) this.draw(c.x + dx, c.y + dy);
    }
  }

  /** A destructible took a hit but stands: show the damage. */
  setHealth(tx: number, ty: number, health: number): void {
    if (!this.dungeon) return;
    this.health.set(ty * this.dungeon.map.width + tx, health);
    this.draw(tx, ty);
  }

  /** Door glow colors follow the doors that are still locked. */
  setDoorColors(doors: readonly Door[], redraw = true): void {
    this.doorColors = new Map();
    const width = this.dungeon?.map.width ?? 60;
    for (const door of doors) {
      if (door.unlocked) continue;
      for (const t of door.tiles) this.doorColors.set(t.y * width + t.x, KEY_INFO[door.color].color);
    }
    if (redraw && this.dungeon) for (const door of doors) for (const t of door.tiles) this.draw(t.x, t.y);
  }

  private draw(tx: number, ty: number): void {
    const d = this.dungeon;
    if (!d || !d.map.inBounds(tx, ty)) return;
    const map = d.map;
    const i = ty * map.width + tx;
    this.objects.get(i)?.destroy();
    this.objects.delete(i);
    const tile = map.get(tx, ty);
    if (!DYNAMIC.has(tile)) return;
    const g = new Graphics();
    const o: ObjCtx = { map, tx, ty, tile, variant: map.variant(tx, ty), sector: (this.grids as Grids).sector[i], h: hash(tx, ty), doorColor: this.doorColors.get(i), health: this.health.get(i) ?? 1 };
    drawTileObject(g, o);
    this.objects.set(i, g);
    this.objectLayer.addChild(g);
  }

  /** Broken lamps stutter. */
  tick(dt: number, combat: readonly CombatSource[] = []): void {
    if(this.quality!==visualQuality.preset){
      this.quality=visualQuality.preset;
      this.lightNodes.forEach((node,i)=>node.visible=i<visualQuality.budget.lights);
      this.reflections.forEach((node,i)=>node.visible=visualQuality.budget.reflections&&i<visualQuality.budget.lights);
    }
    this.time += dt;
    this.live?.tick(dt, combat);
    for (const f of this.flicker) {
      const wave = Math.sin(this.time * f.speed + f.phase) * Math.sin(this.time * f.speed * 0.37 + f.phase);
      f.sprite.alpha = f.base * (wave > 0.5 ? 1 : wave > -0.1 ? 0.55 : 0.12);
    }
  }
}
