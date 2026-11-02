// One layout per room kind: hand-designed arrangements driven by the room's size and doorways.
// Each builder only places obstacles on tiles `ok()` allows (clear of doorways), then
// `applyLayout` proves the room is still one walkable space or falls back to scattered cover.
// `.ts` extensions: Node's test runner.
import { REWARDS, TILE_SIZE, WORLD } from '../config.ts';
import type { RoomKind, Sector } from '../types';
import type { ChestCategory, HazardKind } from './plan.ts';
import {
  applyLayout, axes, centerOf, CONTAINER_VERTICAL, decor, decorPx, freeTiles, idx, light, MV, ok, post, put, reserve, reserveAround,
  scatter, touchesSolid, type Ctx,
} from './layoutKit.ts';

const T = TILE_SIZE;
const LAMP: Record<Sector, number> = { MILITARY: 0xffc98a, URBAN: 0x9fc4ff, LAB: 0x9fe8c0 };
/** Neon is for signs and devices; these are the only saturated colors scenery may use. */
const SIGN_COLORS = [0xff4fa3, 0x35e8ff, 0xffd23f];

const lamp = (c: Ctx): number => LAMP[c.room.sector];
const pick = <V>(c: Ctx, items: readonly V[]): V => items[c.rng.int(0, items.length - 1)];

/** Number of non-solid tiles around (x, y): hazards only go where there is room to walk around them. */
function openAround(c: Ctx, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!c.map.isSolid(x + dx, y + dy)) n++;
  return n;
}

/** A w x h patch of floor hazard on open ground. Returns false when no spot fits. */
function hazardPatch(c: Ctx, kind: HazardKind, w: number, h: number): boolean {
  for (const p of freeTiles(c)) {
    let fits = true;
    for (let dy = 0; dy < h && fits; dy++) for (let dx = 0; dx < w && fits; dx++) fits = ok(c, p.x + dx, p.y + dy) && openAround(c, p.x + dx, p.y + dy) >= 9;
    if (!fits) continue;
    c.plan.hazards.push({ id: c.plan.nextId('hz'), kind, tx: p.x, ty: p.y, w, h, roomId: c.room.id });
    reserve(c, p.x, p.y, w, h);
    if (kind === 'TOXIC') decor(c, 'PUDDLE', p.x, p.y, w, h, 1);
    return true;
  }
  return false;
}

/** A row of machines along one edge: segments of 1-3 tiles of random models, with gaps between. */
function machineRow(c: Ctx, v: number, models: readonly number[], uFrom = 1, maxLen = 3): void {
  const a = axes(c.room);
  let u = uFrom;
  while (u <= a.long - 3) {
    const len = Math.min(c.rng.int(1, maxLen), a.long - 1 - u);
    const model = pick(c, models);
    for (let k = 0; k < len; k++) {
      const p = a.at(u + k, v);
      put(c, p.x, p.y, 'MACHINE', model);
    }
    u += len + c.rng.int(1, 2);
  }
}

/** Single-tile machines of random models on open floor (broken lab equipment, market carts). */
function scatterMachines(c: Ctx, models: readonly number[], count: number): void {
  let placed = 0;
  for (const p of freeTiles(c)) {
    if (placed >= count) break;
    if (openAround(c, p.x, p.y) < 8) continue;
    if (put(c, p.x, p.y, 'MACHINE', pick(c, models))) placed++;
  }
}

function cable(c: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  decorPx(c, 'CABLE', (x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), 3, 0, Math.atan2(y2 - y1, x2 - x1));
}

function grime(c: Ctx, stains: number, marks = 0): void {
  for (const p of freeTiles(c).slice(0, stains)) decor(c, 'STAIN', p.x - 0.5, p.y - 0.5, 1.6, 1.2, c.rng.int(0, 3));
  for (const p of freeTiles(c).slice(0, marks)) decor(c, 'MARKS', p.x, p.y, 1.4, 0.5, c.rng.int(0, 2), c.rng.next() * Math.PI);
}

// --- military ---------------------------------------------------------------------------------

function depot(c: Ctx): void {
  const a = axes(c.room);
  for (let v = 2; v + 1 <= a.short - 3; v += 4) {
    for (let u = 2; u <= a.long - 4; ) {
      const len = Math.min(c.rng.int(2, 4), a.long - 2 - u);
      if (len < 2) break;
      const variant = c.rng.int(0, 3) | (a.horiz ? 0 : CONTAINER_VERTICAL);
      for (let k = 0; k < len; k++) for (let t = 0; t < 2; t++) put(c, a.at(u + k, v + t).x, a.at(u + k, v + t).y, 'CONTAINER', variant);
      u += len + c.rng.int(1, 2);
    }
  }
  scatter(c, 'CRATE', c.rng.int(2, 4));
  scatter(c, 'BARREL', c.rng.int(1, 2));
  // Painted walking lanes along both walls.
  const long = a.long - 2;
  const r = c.room;
  if (a.horiz) {
    decorPx(c, 'STRIPES', (r.x + 1 + long / 2) * T, (r.y + 1.94) * T, long * T, 5, 1);
    decorPx(c, 'STRIPES', (r.x + 1 + long / 2) * T, (r.y + r.height - 1.94) * T, long * T, 5, 1);
  } else {
    decorPx(c, 'STRIPES', (r.x + 1.94) * T, (r.y + 1 + long / 2) * T, 5, long * T, 1);
    decorPx(c, 'STRIPES', (r.x + r.width - 1.94) * T, (r.y + 1 + long / 2) * T, 5, long * T, 1);
  }
  for (const p of freeTiles(c).slice(0, 3)) light(c, p.x, p.y, 150, lamp(c), 0.2, c.rng.chance(0.25));
  grime(c, 3, 2);
}

function workshop(c: Ctx): void {
  const a = axes(c.room);
  machineRow(c, 0, [MV.PRESS, MV.LATHE, MV.GENERATOR]);
  if (a.short >= 8 && c.rng.chance(0.6)) machineRow(c, a.short - 1, [MV.LATHE, MV.GENERATOR, MV.PRESS]);
  const cu = Math.floor(a.long / 2);
  const cv = Math.floor(a.short / 2);
  const island = [-1, 0, 1].map((k) => a.at(cu + k, cv));
  for (const p of island) put(c, p.x, p.y, 'MACHINE', MV.ISLAND);
  const mid = island[1];
  decorPx(c, 'STRIPES', (mid.x + 0.5) * T, (mid.y + 0.5) * T, (a.horiz ? 5 : 3) * T, (a.horiz ? 3 : 5) * T, 2);
  const west = a.at(1, 0);
  cable(c, (west.x + 0.5) * T, (west.y + 0.5) * T, (mid.x + 0.5) * T, (mid.y + 0.5) * T);
  scatter(c, 'CRATE', c.rng.int(1, 2));
  scatter(c, 'BARREL', 1);
  if (c.rng.chance(WORLD.hazardChance(c.plan.floor))) hazardPatch(c, 'SHOCK', 2, 1);
  light(c, mid.x, mid.y, 170, 0xffc27a, 0.26, c.rng.chance(0.35));
  for (const p of freeTiles(c).slice(0, 2)) light(c, p.x, p.y, 120, lamp(c), 0.16);
  grime(c, 4, 2);
}

function security(c: Ctx): void {
  const room = c.room;
  const o = c.openings[0];
  const dir = !o ? { dx: 0, dy: 1 } : o.y < room.y ? { dx: 0, dy: 1 } : o.y >= room.y + room.height ? { dx: 0, dy: -1 } : o.x < room.x ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
  const sideways = dir.dx !== 0;
  const span = sideways ? room.height : room.width;
  const depthMax = sideways ? room.width : room.height;
  const lat0 = sideways ? room.y : room.x;
  const at = (lat: number, depth: number): { x: number; y: number } =>
    dir.dy === 1 ? { x: lat, y: room.y + depth } : dir.dy === -1 ? { x: lat, y: room.y + room.height - 1 - depth } : dir.dx === 1 ? { x: room.x + depth, y: lat } : { x: room.x + room.width - 1 - depth, y: lat };
  const mid = lat0 + Math.floor(span / 2);
  const line = Math.min(3, depthMax - 4);
  for (let lat = lat0 + 1; lat <= lat0 + span - 2; lat++) {
    if (lat === mid || lat === mid - 1) continue; // the gap everyone has to pass through
    const p = at(lat, line);
    put(c, p.x, p.y, 'COVER');
  }
  for (const lat of [lat0 + 1, lat0 + span - 2, lat0 + 2, lat0 + span - 3]) {
    const p = at(lat, line + 1);
    post(c, p.x, p.y);
  }
  if (depthMax >= 9) {
    for (const lat of [mid - 2, mid + 1]) {
      const p = at(lat, line + 3);
      put(c, p.x, p.y, 'CRATE');
    }
  }
  const back = at(mid, depthMax - 1);
  for (const k of [-1, 0, 1]) {
    const p = at(mid + k, depthMax - 1);
    put(c, p.x, p.y, 'MACHINE', MV.CONSOLE);
  }
  const near = at(mid, 1);
  decorPx(c, 'STRIPES', (near.x + 0.5) * T, (near.y + 0.5) * T, (sideways ? 2 : span - 2) * T, (sideways ? span - 2 : 2) * T, 2);
  light(c, back.x, back.y, 160, 0xcfe3ff, 0.2);
  const warn = at(mid + 2, line + 1);
  light(c, warn.x, warn.y, 130, 0xff6a5a, 0.12, true);
  grime(c, 2, 2);
}

function extraction(c: Ctx): void {
  const ctr = centerOf(c.room);
  reserveAround(c, ctr.x, ctr.y, 1);
  decor(c, 'PAD', ctr.x - 1, ctr.y - 1, 3, 3, 1);
  decor(c, 'STRIPES', ctr.x - 2, ctr.y - 2, 5, 5, 2);
  for (const [dx, dy] of [[-3, -2], [3, 2], [-3, 2], [3, -2]]) put(c, ctr.x + dx, ctr.y + dy, 'COVER');
  for (const [dx, dy] of [[-2, -3], [2, 3]]) {
    put(c, ctr.x + dx, ctr.y + dy, 'COVER');
    post(c, ctr.x + dx + (dx < 0 ? 1 : -1), ctr.y + dy);
  }
  scatter(c, 'BARREL', 1);
  light(c, ctr.x, ctr.y, 190, 0xffd68a, 0.3);
  grime(c, 2, 1);
}

// --- urban ------------------------------------------------------------------------------------

function market(c: Ctx): void {
  const a = axes(c.room);
  const stalls = [MV.KIOSK, MV.NOODLE, MV.SHOPFRONT];
  for (const v of a.short >= 9 ? [0, a.short - 1] : [0]) {
    let u = 1;
    while (u <= a.long - 3) {
      const len = Math.min(2, a.long - 1 - u);
      const model = pick(c, stalls);
      let placed = 0;
      for (let k = 0; k < len; k++) if (put(c, a.at(u + k, v).x, a.at(u + k, v).y, 'MACHINE', model)) placed++;
      if (placed > 0) {
        const wall = a.at(u + (len - 1) / 2, v === 0 ? -1 : a.short);
        const neon = pick(c, SIGN_COLORS);
        decorPx(c, 'SIGN', (wall.x + 0.5) * T, (wall.y + 0.5) * T, len * T * 0.8, 14, c.rng.int(0, 2), a.horiz ? 0 : Math.PI / 2, neon);
        const lit = a.at(u, v === 0 ? 1 : a.short - 2);
        light(c, lit.x, lit.y, 110, neon, 0.1, c.rng.chance(0.2));
      }
      u += len + c.rng.int(1, 3);
    }
  }
  const mid = a.at(Math.floor(a.long / 2), Math.floor(a.short / 2));
  for (const k of [0, 1]) put(c, a.horiz ? mid.x + k : mid.x, a.horiz ? mid.y : mid.y + k, 'MACHINE', MV.SEATS);
  if (a.short >= 7) {
    // Two free-standing carts in the lane, leaving room to walk around them.
    for (const u of [Math.floor(a.long / 4), Math.floor((a.long * 3) / 4)]) {
      for (const k of [0, 1]) put(c, a.horiz ? a.at(u + k, Math.floor(a.short / 2) - 1).x : a.at(u, Math.floor(a.short / 2) - 1).x + 0, a.horiz ? a.at(u + k, Math.floor(a.short / 2) - 1).y : a.at(u + k, Math.floor(a.short / 2) - 1).y, 'MACHINE', pick(c, stalls));
    }
  }
  scatter(c, 'CRATE', c.rng.int(1, 3));
  for (const p of freeTiles(c).slice(0, 3)) decor(c, 'PUDDLE', p.x - 0.4, p.y - 0.3, 1.8, 1.2, 0);
  grime(c, 2, 1);
}

function service(c: Ctx): void {
  const a = axes(c.room);
  // Pipes along both walls and a pillar every few tiles, alternating sides: a corridor with rhythm.
  const wallPx = (v: number): number => (a.horiz ? c.room.y + v + 0.5 : c.room.x + v + 0.5) * T;
  const lenPx = (a.long - 1) * T;
  const midPx = (a.horiz ? c.room.x : c.room.y) * T + (a.long * T) / 2;
  for (const v of [-1, a.short]) {
    if (a.horiz) decorPx(c, 'PIPE', midPx, wallPx(v), lenPx, 9, c.rng.int(0, 2));
    else decorPx(c, 'PIPE', wallPx(v), midPx, 9, lenPx, c.rng.int(0, 2));
  }
  for (let u = 3, side = 0; u <= a.long - 4; u += c.rng.int(3, 4), side ^= 1) {
    const p = a.at(u, side ? 0 : a.short - 1);
    put(c, p.x, p.y, 'MACHINE', MV.PILLAR);
  }
  const m = Math.floor(a.long / 2);
  for (const v of [1, a.short - 2]) {
    const p = a.at(m + (v === 1 ? 0 : 1), v);
    put(c, p.x, p.y, 'COVER');
  }
  scatter(c, 'CRATE', 1);
  scatter(c, 'BARREL', 1);
  if (a.short <= 5 && c.rng.chance(WORLD.tripwireChance(c.plan.floor))) {
    // A tripwire across the corridor: crossing it sets off the alarm. Emitters sit in the walls.
    const u = Math.max(3, Math.min(a.long - 4, m + c.rng.int(-2, 2)));
    const first = a.at(u, 0);
    const clear = Array.from({ length: a.short }, (_, v) => a.at(u, v)).every((p) => ok(c, p.x, p.y));
    if (clear) {
      c.plan.hazards.push({ id: c.plan.nextId('hz'), kind: 'LASER', tx: first.x, ty: first.y, w: a.horiz ? 1 : a.short, h: a.horiz ? a.short : 1, roomId: c.room.id });
      for (let v = 0; v < a.short; v++) reserve(c, a.at(u, v).x, a.at(u, v).y);
    }
  }
  const row = Math.floor(a.short / 2);
  for (let u = 2; u <= a.long - 3; u += 4) light(c, a.at(u, row).x, a.at(u, row).y, 120, 0xcfe0ff, 0.14, c.rng.chance(0.3));
  grime(c, 2, 2);
}

// --- abandoned lab ----------------------------------------------------------------------------

function lab(c: Ctx): void {
  const a = axes(c.room);
  const cuts = a.long >= 12 ? [Math.floor(a.long / 3), Math.floor((a.long * 2) / 3)] : [Math.floor(a.long / 2)];
  for (const cut of cuts) {
    const gap = c.rng.int(1, Math.max(1, a.short - 3));
    for (let v = 0; v < a.short; v++) {
      if (v === gap || v === gap + 1) continue;
      const p = a.at(cut, v);
      put(c, p.x, p.y, 'WALL', 1);
    }
  }
  machineRow(c, 0, [MV.TANK, MV.SCANNER, MV.LAB_CONSOLE, MV.CENTRIFUGE], 1, 2);
  if (a.short >= 7) machineRow(c, a.short - 1, [MV.LAB_CONSOLE, MV.SCANNER, MV.TANK], 1, 2);
  if (c.rng.chance(WORLD.hazardChance(c.plan.floor) + 0.15)) hazardPatch(c, 'TOXIC', 2, 2);
  scatterMachines(c, [MV.TANK, MV.CENTRIFUGE, MV.SCANNER], c.rng.int(2, 4));
  scatter(c, 'CRATE', 1);
  for (const p of freeTiles(c).slice(0, 4)) decor(c, 'DEBRIS', p.x, p.y, 1.1, 1.1, c.rng.int(0, 2));
  for (const p of freeTiles(c).slice(0, 2)) decor(c, 'CRACK', p.x - 0.5, p.y - 0.5, 1.6, 1.6, c.rng.int(0, 1));
  for (const p of freeTiles(c).slice(0, 3)) light(c, p.x, p.y, 120, lamp(c), 0.14, c.rng.chance(0.6));
  grime(c, 4, 0);
}

function medical(c: Ctx): void {
  const a = axes(c.room);
  const ctr = centerOf(c.room);
  reserveAround(c, ctr.x, ctr.y, 1);
  c.plan.medics.push({ tx: ctr.x, ty: ctr.y, roomId: c.room.id });
  decor(c, 'PATCH', c.room.x, c.room.y, c.room.width, c.room.height, 3);
  for (let u = 1; u <= a.long - 3; u += 3) {
    const p = a.at(u, 0);
    const q = a.horiz ? { x: p.x + 1, y: p.y } : { x: p.x, y: p.y + 1 };
    if (ok(c, p.x, p.y) && ok(c, q.x, q.y)) {
      decor(c, 'BED', p.x, p.y, a.horiz ? 2 : 1, a.horiz ? 1 : 2, c.rng.int(0, 1));
      reserve(c, p.x, p.y, a.horiz ? 2 : 1, a.horiz ? 1 : 2);
    }
  }
  const corner = a.at(a.long - 1, a.short - 1);
  put(c, corner.x, corner.y, 'MACHINE', MV.MED_UNIT);
  scatter(c, 'CRATE', 1);
  light(c, ctr.x, ctr.y, 160, 0xdff6ff, 0.22);
  light(c, a.at(1, 1).x, a.at(1, 1).y, 100, 0x9fe8c0, 0.12, true);
  grime(c, 1, 0);
}

function tech(c: Ctx): void {
  const a = axes(c.room);
  for (let u = 1; u <= a.long - 3; ) {
    const len = Math.min(c.rng.int(2, 3), a.long - 1 - u);
    for (let k = 0; k < len; k++) put(c, a.at(u + k, 0).x, a.at(u + k, 0).y, 'MACHINE', MV.RACK);
    u += len + 1;
  }
  const ctr = a.at(Math.floor(a.long / 2), Math.floor(a.short / 2));
  const second = a.horiz ? { x: ctr.x + 1, y: ctr.y } : { x: ctr.x, y: ctr.y + 1 };
  put(c, ctr.x, ctr.y, 'MACHINE', MV.CONSOLE);
  put(c, second.x, second.y, 'MACHINE', MV.CONSOLE);
  // The room's terminal sits right in front of the console, on the open side.
  const front = a.at(Math.floor(a.long / 2), Math.floor(a.short / 2) + 1);
  const spot = ok(c, front.x, front.y) ? front : freeTiles(c)[0];
  if (spot) {
    c.plan.terminals.push({ id: c.plan.nextId('term'), tx: spot.x, ty: spot.y, roomId: c.room.id });
    reserve(c, spot.x, spot.y);
  }
  for (let u = 1; u <= a.long - 2; u += 2) {
    const p = a.at(u, 0);
    cable(c, (p.x + 0.5) * T, (p.y + 1.2) * T, (ctr.x + 0.5) * T, (ctr.y + 0.5) * T);
  }
  light(c, ctr.x, ctr.y, 150, 0x6fb4ff, 0.2);
  scatter(c, 'CRATE', 1);
  grime(c, 2, 1);
}

// --- shared -----------------------------------------------------------------------------------

function supply(c: Ctx): void {
  const a = axes(c.room);
  for (const v of a.short >= 8 ? [1, a.short - 2] : [1]) {
    for (let u = 2; u <= a.long - 3; ) {
      const len = Math.min(c.rng.int(2, 3), a.long - 2 - u);
      for (let k = 0; k < len; k++) put(c, a.at(u + k, v).x, a.at(u + k, v).y, 'MACHINE', MV.SHELF);
      u += len + 1;
    }
  }
  scatter(c, 'CRATE', c.rng.int(2, 3));
  const ctr = centerOf(c.room);
  light(c, ctr.x, ctr.y, 140, lamp(c), 0.18, c.rng.chance(0.2));
  grime(c, 2, 1);
}

function vault(c: Ctx): void {
  const ctr = centerOf(c.room);
  reserveAround(c, ctr.x, ctr.y, 1);
  decor(c, 'PATCH', c.room.x, c.room.y, c.room.width, c.room.height, 0);
  const a = axes(c.room);
  for (const v of [0, a.short - 1]) for (const u of [1, a.long - 2]) put(c, a.at(u, v).x, a.at(u, v).y, 'MACHINE', MV.DEPOSIT);
  light(c, ctr.x, ctr.y, 180, 0xffe6b0, 0.28);
  grime(c, 1, 0);
}

function entry(c: Ctx): void {
  const ctr = centerOf(c.room);
  reserveAround(c, ctr.x, ctr.y, 1);
  decor(c, 'PAD', ctr.x - 1, ctr.y - 1, 3, 3, 0);
  scatter(c, 'CRATE', c.rng.int(2, 3));
  light(c, ctr.x, ctr.y, 170, lamp(c), 0.24);
  grime(c, 2, 1);
}

function shop(c: Ctx): void {
  const ctr = centerOf(c.room);
  reserveAround(c, ctr.x, ctr.y, 2);
  decor(c, 'PATCH', ctr.x - 2, ctr.y - 2, 5, 5, 2);
  for (const k of [-1, 1]) decorPx(c, 'SIGN', (ctr.x + 0.5 + k * 2.6) * T, (c.room.y - 0.5) * T, 90, 14, k > 0 ? 1 : 0, 0, SIGN_COLORS[k > 0 ? 1 : 0]);
  light(c, ctr.x, ctr.y, 200, 0xffd68a, 0.3);
  light(c, ctr.x - 2, ctr.y - 2, 120, 0x35e8ff, 0.12);
  scatter(c, 'CRATE', 1);
}

const none = (): void => {};

export const LAYOUTS: Record<RoomKind, (c: Ctx) => void> = {
  ENTRY: entry, DEPOT: depot, WORKSHOP: workshop, SECURITY: security, LAB: lab, MARKET: market, SERVICE: service,
  SUPPLY: supply, MEDICAL: medical, TECH: tech, VAULT: vault, SHOP: shop, EXTRACTION: extraction, SECRET: none, ANNEX: none,
};

/** The old fallback: a few barricades, never touching, off the doorways. */
function scatterCover(c: Ctx): void {
  scatter(c, 'COVER', c.rng.int(2, 3));
  scatter(c, 'CRATE', c.rng.int(1, 2));
  grime(c, 2, 1);
}

export function buildRoomLayout(c: Ctx): void {
  applyLayout(c, LAYOUTS[c.room.kind], scatterCover);
}

// --- caches and chests -------------------------------------------------------------------------

const weighted = (c: Ctx): ChestCategory => {
  const w = REWARDS.supplyWeights;
  const r = c.rng.next() * (w.AMMO + w.MED + w.CREDITS);
  return r < w.AMMO ? 'AMMO' : r < w.AMMO + w.MED ? 'MED' : 'CREDITS';
};

/** A tucked-away free tile (against a wall or an obstacle, clear of doorways) for a chest. */
export function cacheSpot(c: Ctx): { x: number; y: number } | null {
  const tiles = freeTiles(c);
  return tiles.find((p) => touchesSolid(c, p.x, p.y) && openAround(c, p.x, p.y) >= 5) ?? tiles[0] ?? null;
}

export function addChest(c: Ctx, spot: { x: number; y: number }, family: 'SUPPLY' | 'SPECIAL', tier: 1 | 2 | 3, category?: ChestCategory): void {
  c.plan.chests.push({
    id: c.plan.nextId('chest'),
    tx: spot.x,
    ty: spot.y,
    family,
    category: category ?? (family === 'SPECIAL' ? 'GEAR' : weighted(c)),
    tier,
    seed: c.rng.int(1, 0x7fffffff),
    roomId: c.room.id,
  });
  c.reserved.add(idx(c.map, spot.x, spot.y));
}

/** Supply rooms always hold caches; other rooms roll their kind's chance. Vaults get a special case. */
export function placeChests(c: Ctx, specialTier: 1 | 2 | 3 = 2): void {
  const kind = c.room.kind;
  if (kind === 'VAULT') {
    addChest(c, centerOf(c.room), 'SPECIAL', specialTier);
    return;
  }
  const guaranteed = kind === 'SUPPLY' ? c.rng.int(1, 2) : 0;
  const stray = c.rng.chance(REWARDS.cacheChance[kind] ?? 0) ? 1 : 0;
  for (let i = 0; i < Math.max(guaranteed, stray); i++) {
    const spot = cacheSpot(c);
    if (spot) addChest(c, spot, 'SUPPLY', 1, kind === 'MEDICAL' && i === 0 ? 'MED' : undefined);
  }
}
