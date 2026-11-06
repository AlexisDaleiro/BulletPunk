import type { Graphics } from 'pixi.js';
import { COLORS, TILE_SIZE } from '../config';
import type { TileType } from '../types';
import { CONTAINER_VERTICAL, MV } from '../world/layoutKit';
import type { TileMap } from '../world/TileMap';

const T = TILE_SIZE;
const AMBER = 0xffe600;

export interface ObjCtx {
  map: TileMap;
  tx: number;
  ty: number;
  tile: TileType;
  variant: number;
  /** 0 military, 1 urban, 2 lab. */
  sector: number;
  /** Stable per-tile noise. */
  h: number;
  /** Glow color of a locked door. */
  doorColor?: number;
  /** 0..1 remaining health of a destructible. */
  health: number;
}

/** Multiplies each channel: <1 darkens, >1 lightens. */
export const shade = (c: number, f: number): number => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
};

/** Wall material per sector: [cap, face, highlight]. */
export const WALL_PAL = [
  [0x2c363c, 0x1b2429, 0x62727a],
  [0x2d313a, 0x1d2027, 0x586175],
  [0x2a4144, 0x1a2c2f, 0x77a09c],
] as const;

const CONTAINER_PAINT = [0x7a4034, 0x2f5f68, 0x8a7a3e, 0x3d4966];

const sameKind = (o: ObjCtx, dx: number, dy: number): boolean => o.map.get(o.tx + dx, o.ty + dy) === o.tile && o.map.variant(o.tx + dx, o.ty + dy) === o.variant;

/** Soft footprint under an obstacle: the cheap contact shadow that gives it weight. */
function footprint(g: Graphics, x: number, y: number, w: number, h: number, r = 4): void {
  g.roundRect(x - 2, y + 1, w + 5, h + 5, r).fill({ color: 0x000000, alpha: 0.34 });
  g.roundRect(x - 1, y + 3, w + 3, h + 2, r).fill({color:0x000000,alpha:.18});
}

/** A wall-like block (secret wall, weak wall, shutter frame) matching the sector's walls. */
function wallBlock(g: Graphics, o: ObjCtx): void {
  const [cap, face, hi] = WALL_PAL[o.sector];
  const px = o.tx * T;
  const py = o.ty * T;
  g.rect(px, py, T, T).fill(cap);
  g.rect(px, py + T - 14, T, 14).fill(face);
  g.rect(px, py + T - 14, T, 1.5).fill({ color: hi, alpha: 0.5 });
  g.rect(px, py, T, 1.5).fill({ color: hi, alpha: 0.7 });
}

export function drawTileObject(g: Graphics, o: ObjCtx): void {
  const px = o.tx * T;
  const py = o.ty * T;
  switch (o.tile) {
    case 'COVER':
      cover(g, px, py, o);
      break;
    case 'CRATE':
      crate(g, px, py, o);
      break;
    case 'BARREL':
      barrel(g, px, py, o);
      break;
    case 'CONTAINER':
      container(g, px, py, o);
      break;
    case 'MACHINE':
      machine(g, px, py, o);
      break;
    case 'DOOR_LOCKED':
      lockedDoor(g, px, py, o);
      break;
    case 'DOOR_UNLOCKED':
      g.rect(px + 2, py + 2, 5, T - 4).fill(0x3a444a).rect(px + T - 7, py + 2, 5, T - 4).fill(0x3a444a);
      g.rect(px + 2, py + 2, T - 4, 3).fill({ color: COLORS.cyan, alpha: 0.35 });
      break;
    case 'SHUTTER':
      shutter(g, px, py, o);
      break;
    case 'SECRET_WALL':
      secretWall(g, px, py, o);
      break;
    case 'WEAK_WALL':
      weakWall(g, px, py, o);
      break;
    case 'RUBBLE':
      for (let i = 0; i < 7; i++) {
        const rx = px + 6 + ((o.h >> (i * 2)) % 34);
        const ry = py + 6 + ((o.h >> (i * 2 + 3)) % 34);
        g.poly([rx, ry, rx + 6 + (i % 3) * 2, ry + 2, rx + 3, ry + 7]).fill({ color: i % 2 ? 0x59605f : 0x3c4244, alpha: 0.95 });
      }
      break;
    case 'EXIT_ELEVATOR':
      elevator(g, px, py);
      break;
    default:
      break;
  }
}

function cover(g: Graphics, px: number, py: number, o: ObjCtx): void {
  footprint(g, px + 4, py + 12, T - 8, T - 22, 5);
  g.roundRect(px + 4, py + 10, T - 8, T - 20, 4).fill(0x5b6361).stroke({ color: 0x20282a, width: 1.5 });
  g.rect(px + 7, py + 13, T - 14, 6).fill(0x7a8481);
  g.rect(px + 7, py + 21, T - 14, T - 34).fill(0x454d4c);
  for (const x of [px + 8, px + T - 16]) g.poly([x, py + 22, x + 8, py + 22, x + 4, py + T - 14, x - 4, py + T - 14]).fill({ color: AMBER, alpha: 0.5 });
  if (o.h % 5 === 0) g.rect(px + 18, py + 24, 12, 2).fill(0x2b3232);
}

function crate(g: Graphics, px: number, py: number, o: ObjCtx): void {
  footprint(g, px + 7, py + 8, T - 14, T - 14, 3);
  const tone = [0x6b5a3e, 0x5d6458, 0x4f5f63][o.h % 3];
  g.roundRect(px + 7, py + 7, T - 14, T - 14, 3).fill(tone).stroke({ color: shade(tone, 0.45), width: 1.5 });
  g.rect(px + 7, py + 7, T - 14, 5).fill(shade(tone, 1.3));
  g.moveTo(px + 11, py + 14).lineTo(px + T - 11, py + T - 11).moveTo(px + T - 11, py + 14).lineTo(px + 11, py + T - 11).stroke({ color: shade(tone, 0.6), width: 2 });
  g.rect(px + T / 2 - 3, py + T / 2 - 2, 6, 4).fill(shade(tone, 0.5));
  if (o.health < 0.7) g.moveTo(px + 12, py + 10).lineTo(px + 22, py + 22).lineTo(px + 17, py + 30).stroke({ color: 0x111111, width: 1.5, alpha: 0.9 });
  if (o.health < 0.4) g.moveTo(px + T - 12, py + 12).lineTo(px + T - 24, py + 26).lineTo(px + T - 16, py + 36).stroke({ color: 0x111111, width: 1.5, alpha: 0.9 });
}

function barrel(g: Graphics, px: number, py: number, o: ObjCtx): void {
  const cx = px + T / 2;
  const cy = py + T / 2;
  g.ellipse(cx + 2, cy + 4, 17, 15).fill({ color: 0x000000, alpha: 0.34 });
  g.circle(cx, cy, 15).fill(0x7c2f26).stroke({ color: 0x2b0f0c, width: 1.5 });
  g.circle(cx, cy, 11).fill(0x93392d);
  g.rect(cx - 15, cy - 3, 30, 6).fill({ color: AMBER, alpha: 0.55 });
  g.circle(cx, cy, 5).fill(0x4b1913).stroke({ color: 0xc9a23a, width: 1 });
  g.moveTo(cx - 3, cy + 2).lineTo(cx, cy - 3).lineTo(cx + 3, cy + 2).stroke({ color: 0xd7b04a, width: 1.5 });
  if (o.health < 0.6) g.moveTo(cx - 10, cy - 8).lineTo(cx - 3, cy - 1).stroke({ color: 0x120706, width: 1.5 });
}

function container(g: Graphics, px: number, py: number, o: ObjCtx): void {
  const paint = CONTAINER_PAINT[o.variant & 3];
  const vertical = (o.variant & CONTAINER_VERTICAL) !== 0;
  const l = sameKind(o, -1, 0) ? 0 : 2;
  const r = sameKind(o, 1, 0) ? 0 : 2;
  const t = sameKind(o, 0, -1) ? 0 : 2;
  const b = sameKind(o, 0, 1) ? 0 : 2;
  const x = px + l;
  const y = py + t;
  const w = T - l - r;
  const h = T - t - b;
  if (!sameKind(o, 0, 1)) footprint(g, x, y + 2, w, h, 3);
  g.rect(x, y, w, h).fill(paint);
  // Corrugation runs along the container's length.
  const ribs = vertical ? w : h;
  for (let i = 4; i < ribs; i += 6) {
    if (vertical) g.rect(x + i, y, 2, h).fill({ color: shade(paint, 0.7), alpha: 0.8 });
    else g.rect(x, y + i, w, 2).fill({ color: shade(paint, 0.7), alpha: 0.8 });
  }
  g.rect(x, y, w, 3).fill({ color: shade(paint, 1.5), alpha: 0.7 });
  g.rect(x, y + h - 4, w, 4).fill({ color: 0x000000, alpha: 0.35 });
  g.rect(x, y, w, h).stroke({ color: shade(paint, 0.4), width: 1.5 });
  // Door ends with locking bars where the container stops.
  const capsAlong = vertical ? [!sameKind(o, 0, -1), !sameKind(o, 0, 1)] : [!sameKind(o, -1, 0), !sameKind(o, 1, 0)];
  capsAlong.forEach((cap, i) => {
    if (!cap) return;
    for (const k of [0.3, 0.7]) {
      if (vertical) g.rect(x + w * k - 1, i ? y + h - 12 : y + 3, 2.5, 9).fill(0xb7b4a6);
      else g.rect(i ? x + w - 12 : x + 3, y + h * k - 1, 9, 2.5).fill(0xb7b4a6);
    }
  });
}

function machine(g: Graphics, px: number, py: number, o: ObjCtx): void {
  const m = o.variant;
  const l = sameKind(o, -1, 0) ? 0 : 3;
  const r = sameKind(o, 1, 0) ? 0 : 3;
  const t = sameKind(o, 0, -1) ? 0 : 3;
  const b = sameKind(o, 0, 1) ? 0 : 3;
  const x = px + l;
  const y = py + t;
  const w = T - l - r;
  const h = T - t - b;

  if (m === MV.PILLAR) {
    g.circle(px + T / 2 + 2, py + T / 2 + 3, 17).fill({ color: 0x000000, alpha: 0.34 });
    g.circle(px + T / 2, py + T / 2, 16).fill(0x4b4f55).stroke({ color: 0x1b1d21, width: 2 });
    g.circle(px + T / 2, py + T / 2, 10).fill(0x60656d);
    g.rect(px + T / 2 - 16, py + T / 2 - 2, 32, 4).fill({ color: AMBER, alpha: 0.35 });
    return;
  }

  footprint(g, x, y + 2, w, h, 4);
  const groups: Record<number, [number, number]> = {
    [MV.PRESS]: [0x3d4a52, 0xd0a23a], [MV.LATHE]: [0x45524e, 0xc9d1c8], [MV.GENERATOR]: [0x4a4440, 0xe0743b],
    [MV.BENCH]: [0x4d4a43, 0x9a8f6a], [MV.ISLAND]: [0x4e5358, 0xd0a23a],
    [MV.TANK]: [0x31494a, 0x7fe0c0], [MV.SCANNER]: [0x3a4b52, 0x8fd2f0], [MV.LAB_CONSOLE]: [0x354447, 0x7fe0c0], [MV.CENTRIFUGE]: [0x3c4a4d, 0xb7e6dc],
    [MV.KIOSK]: [0x4a3d4d, 0xff4fa3], [MV.NOODLE]: [0x4d4036, 0xffb347], [MV.SHOPFRONT]: [0x34393f, 0x35e8ff], [MV.SEATS]: [0x3e4650, 0x7f8a99],
    [MV.SHELF]: [0x4a4a42, 0xc2b27a], [MV.MED_UNIT]: [0x4b565a, 0xe8f6f8], [MV.RACK]: [0x2a3138, 0x4fdc8a], [MV.CONSOLE]: [0x2f353d, 0x6fb4ff],
    [MV.DEPOSIT]: [0x44484d, 0xbfc5cc], [MV.BUNK]: [0x433f39, 0x9aa38f],
  };
  const [body, accent] = groups[m] ?? [0x41484e, 0xbfc5cc];
  g.roundRect(x, y, w, h, 3).fill(body).stroke({ color: shade(body, 0.4), width: 1.5 });
  g.rect(x + 1, y + 1, w - 2, 4).fill({ color: shade(body, 1.6), alpha: 0.8 });
  g.rect(x + 1, y + h - 6, w - 2, 5).fill({ color: 0x000000, alpha: 0.3 });

  if (m === MV.RACK) {
    for (let i = 0; i < 4; i++) {
      g.rect(x + 4, y + 7 + i * 8, w - 8, 5).fill(0x151a1f);
      g.rect(x + 6 + ((o.h + i) % 3) * 6, y + 8.5 + i * 8, 2.5, 2.5).fill({ color: i % 2 ? accent : 0xffb347, alpha: 0.95 });
    }
  } else if (m === MV.SHELF) {
    for (let i = 0; i < 3; i++) g.rect(x + 4, y + 6 + i * 11, w - 8, 3).fill(0x2a2a25);
    for (let i = 0; i < 3; i++) g.rect(x + 5 + ((o.h + i * 7) % Math.max(1, w - 16)), y + 9 + i * 11, 7, 6).fill(i % 2 ? 0x7d6a45 : 0x5b6e6a);
  } else if (m === MV.CONSOLE || m === MV.LAB_CONSOLE) {
    g.rect(x + 5, y + 8, w - 10, h - 20).fill(0x0c1418);
    g.rect(x + 7, y + 10, w - 14, h - 24).fill({ color: accent, alpha: 0.35 });
    g.rect(x + 5, y + h - 11, w - 10, 3).fill(0x1d252b);
  } else if (m === MV.TANK || m === MV.CENTRIFUGE) {
    g.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 6).fill({ color: accent, alpha: 0.18 }).stroke({ color: accent, width: 1.5, alpha: 0.7 });
    g.moveTo(x + w / 2 - 8, y + h / 2 - 8).lineTo(x + w / 2 + 8, y + h / 2 + 8).stroke({ color: 0xcfe8e2, width: 1, alpha: 0.5 });
  } else if (m === MV.KIOSK || m === MV.NOODLE || m === MV.SHOPFRONT) {
    // A closed stall: striped awning above a shuttered counter.
    for (let i = 0; i < Math.floor(w / 8); i++) g.rect(x + i * 8, y + 4, 4, 10).fill({ color: accent, alpha: 0.45 });
    g.rect(x + 4, y + 18, w - 8, h - 26).fill(0x161a20);
    for (let i = 0; i < 3; i++) g.rect(x + 4, y + 20 + i * 5, w - 8, 1.5).fill({ color: 0x4a5058, alpha: 0.8 });
  } else if (m === MV.BENCH || m === MV.ISLAND || m === MV.PRESS || m === MV.LATHE || m === MV.GENERATOR) {
    g.rect(x + 6, y + 9, w - 12, h - 20).stroke({ color: accent, width: 1.2, alpha: 0.75 });
    if (m === MV.GENERATOR) g.circle(x + w / 2, y + h / 2, 7).fill({ color: accent, alpha: 0.5 });
    if (m === MV.PRESS) g.rect(x + w / 2 - 4, y + 9, 8, h - 20).fill(shade(body, 1.4));
    if (m === MV.ISLAND) for (let i = 0; i < 3; i++) g.rect(x + 8 + i * 9, y + 14, 5, 10).fill(0x2a2a2a);
  } else {
    g.rect(x + 6, y + 9, w - 12, 4).fill({ color: accent, alpha: 0.5 });
  }
}

function lockedDoor(g: Graphics, px: number, py: number, o: ObjCtx): void {
  const color = o.doorColor ?? AMBER;
  g.rect(px, py, T, T).fill(0x232b30);
  g.rect(px + 3, py + 3, T - 6, T - 6).fill(0x161d21).stroke({ color: 0x59656a, width: 2 });
  g.rect(px + 7, py + T / 2 - 4, T - 14, 8).fill({ color, alpha: 0.9 });
  g.rect(px + 7, py + T / 2 - 4, T - 14, 8).stroke({ color: shade(color, 0.5), width: 1 });
  g.circle(px + T / 2, py + 9, 3.5).fill(color);
  g.circle(px + T / 2, py + T - 9, 3.5).fill(color);
  for (let i = 0; i < 4; i++) g.rect(px + 9 + i * 9, py + 6, 5, 3).fill({ color: 0x59656a, alpha: 0.8 });
}

function shutter(g: Graphics, px: number, py: number, o: ObjCtx): void {
  wallBlock(g, o);
  g.rect(px + 4, py + 4, T - 8, T - 8).fill(0x3b3a33).stroke({ color: 0x14130f, width: 1.5 });
  for (let i = 0; i < 6; i++) g.rect(px + 4, py + 7 + i * 6.5, T - 8, 2).fill({ color: 0x15150f, alpha: 0.8 });
  for (let i = 0; i < 4; i++) g.poly([px + 6 + i * 10, py + T - 7, px + 12 + i * 10, py + T - 7, px + 16 + i * 10, py + T - 12, px + 10 + i * 10, py + T - 12]).fill({ color: AMBER, alpha: 0.8 });
  g.circle(px + T - 9, py + 9, 3).fill(0xff3b3b);
}

/** The four secret entrances. Each one reads as "slightly off" in its own way. */
function secretWall(g: Graphics, px: number, py: number, o: ObjCtx): void {
  wallBlock(g, o);
  const [, face, hi] = WALL_PAL[o.sector];
  switch (o.variant) {
    case 0: // PANEL: a seam that does not line up with its neighbours, and a dark gap along one edge
      g.rect(px + 7, py + 6, T - 14, T - 24).stroke({ color: shade(face, 0.55), width: 1.5 });
      g.moveTo(px + 7, py + 6).lineTo(px + 7, py + T - 18).stroke({ color: 0x050708, width: 2.5 });
      g.rect(px + 9, py + 8, T - 18, 3).fill({ color: hi, alpha: 0.3 });
      break;
    case 1: // VENT: a grate with one screw missing and a rust trail below
      g.rect(px + 9, py + 9, T - 18, T - 26).fill(0x0e1316).stroke({ color: hi, width: 1.5, alpha: 0.7 });
      for (let i = 0; i < 4; i++) g.rect(px + 11, py + 12 + i * 4.5, T - 22, 1.8).fill({ color: hi, alpha: 0.5 });
      for (const [sx, sy] of [[11, 11], [T - 12, 11], [T - 12, T - 19]]) g.circle(px + sx, py + sy, 1.3).fill(0x8a949a);
      g.rect(px + 11, py + T - 18, 3, 12).fill({ color: 0x6b3b24, alpha: 0.6 });
      break;
    case 2: // CABINET: a locker standing a few pixels proud of the wall line
      g.rect(px + 8, py + 4, T - 14, T - 12).fill(0x3b464b).stroke({ color: 0x151b1e, width: 1.5 });
      g.rect(px + 8, py + 4, 3, T - 12).fill({ color: 0x000000, alpha: 0.45 });
      g.rect(px + T - 17, py + 16, 3, 9).fill(0xaeb5b8);
      for (let i = 0; i < 3; i++) g.rect(px + 13, py + 8 + i * 3, T - 26, 1).fill({ color: 0x000000, alpha: 0.5 });
      break;
    default: // SEAM: a cleaner outline than the dust around it, and light leaking underneath
      g.rect(px + 6, py + 5, T - 12, T - 21).stroke({ color: hi, width: 1.5, alpha: 0.85 });
      g.rect(px + 7, py + 6, T - 14, T - 23).fill({ color: hi, alpha: 0.1 });
      g.rect(px + 9, py + T - 15, T - 18, 2.5).fill({ color: 0xffc66b, alpha: 0.9 });
      break;
  }
}

function weakWall(g: Graphics, px: number, py: number, o: ObjCtx): void {
  wallBlock(g, o);
  g.moveTo(px + 12, py + 3).lineTo(px + 22, py + 16).lineTo(px + 15, py + 24).lineTo(px + 30, py + 38).stroke({ color: 0x0c1012, width: 2 });
  g.moveTo(px + 22, py + 16).lineTo(px + 33, py + 12).stroke({ color: 0x0c1012, width: 1.5 });
  for (let i = 0; i < 3; i++) g.rect(px + 6 + i * 13, py + T - 13, 8, 4).fill({ color: AMBER, alpha: 0.6 });
  if (o.health < 0.6) g.moveTo(px + 30, py + 5).lineTo(px + 24, py + 20).stroke({ color: 0x000000, width: 2 });
}

function elevator(g: Graphics, px: number, py: number): void {
  const cx = px + T / 2;
  const cy = py + T / 2;
  g.circle(cx, cy, T * 0.42).fill({ color: 0x0c1418, alpha: 0.9 }).stroke({ color: AMBER, width: 2, alpha: 0.9 });
  g.circle(cx, cy, T * 0.26).stroke({ color: COLORS.cyan, width: 2, alpha: 0.7 });
  g.moveTo(cx - 8, cy + 4).lineTo(cx, cy - 5).lineTo(cx + 8, cy + 4).stroke({ color: AMBER, width: 2.5, alpha: 0.9 });
}
