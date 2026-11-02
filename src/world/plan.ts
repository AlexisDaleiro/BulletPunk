// Pure data the generator emits next to the tilemap. Nothing here touches Pixi: the renderer and
// `populate` consume it, and the tests check it. `.ts` extensions are needed by Node's test runner.
import type { KeyColor } from '../types';

export type DecorKind =
  | 'STAIN' | 'SCORCH' | 'PATCH' | 'STRIPES' | 'MARKS' | 'CABLE' | 'PIPE' | 'DEBRIS' | 'PUDDLE'
  | 'PAD' | 'BED' | 'BEDROLL' | 'WRECK' | 'LEAK' | 'CRACK' | 'SIGN' | 'VENT' | 'SEAM' | 'LOG' | 'DRAG';

/** Non-colliding scenery. Position and size are world px; `rot` is radians; `variant` picks the look. */
export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  variant: number;
  color?: number;
}

/** A ceiling lamp or glowing device: a soft additive pool of light. */
export interface Light {
  x: number;
  y: number;
  r: number;
  color: number;
  alpha: number;
  flicker: boolean;
}

export type ChestFamily = 'SUPPLY' | 'SPECIAL';
/** SUPPLY caches hold ammo, repairs or credits; SPECIAL cases hold gear (weapons, implants). */
export type ChestCategory = 'AMMO' | 'MED' | 'CREDITS' | 'GEAR';

export interface ChestSpawn {
  id: string;
  tx: number;
  ty: number;
  family: ChestFamily;
  category: ChestCategory;
  /** Rarity 1-3: shapes the case and the quality of the contents. */
  tier: 1 | 2 | 3;
  /** Seeds the contents, so a floor always rolls the same loot for the same equipment. */
  seed: number;
  roomId: string;
}

export interface TerminalSpawn {
  id: string;
  tx: number;
  ty: number;
  roomId: string;
}

export type HazardKind = 'SHOCK' | 'TOXIC' | 'LASER';

export interface HazardSpawn {
  id: string;
  kind: HazardKind;
  /** Top-left tile and size in tiles. A laser is a 1-tile-thick strip; its emitters stand in the walls at both ends. */
  tx: number;
  ty: number;
  w: number;
  h: number;
  roomId: string;
}

export interface ShutterPlan {
  id: string;
  tiles: { x: number; y: number }[];
  /** The vault this shutter seals. */
  roomId: string;
}

/** The look of a secret entrance. Each leaves its own tells on the wall and on the floor in front of it. */
export type SecretVariant = 'PANEL' | 'VENT' | 'CABINET' | 'SEAM';
/** The little story a secret room tells. */
export type SecretStory = 'CAMP' | 'CACHE' | 'MARKET' | 'ARCHIVE';

export interface SecretPlan {
  id: string;
  variant: SecretVariant;
  story: SecretStory;
  /** The SECRET_WALL tile. */
  wall: { x: number; y: number };
  /** Floor tile of the host room in front of the wall: where the player stands to push it. */
  approach: { x: number; y: number };
  /** Unit step from the approach tile into the wall. */
  dir: { dx: number; dy: number };
  /** The hidden room behind the wall. */
  roomId: string;
  hostRoomId: string;
}

export interface Post {
  tx: number;
  ty: number;
}

/** Everything the generator wants placed in the world besides tiles. */
export class Plan {
  decor: Decor[] = [];
  lights: Light[] = [];
  chests: ChestSpawn[] = [];
  terminals: TerminalSpawn[] = [];
  hazards: HazardSpawn[] = [];
  shutters: ShutterPlan[] = [];
  secrets: SecretPlan[] = [];
  medics: { tx: number; ty: number; roomId: string }[] = [];
  /** Defensive spots per room id; bots start there before random floor tiles. */
  posts: Record<string, Post[]> = {};
  /** Floor being generated; layouts scale hazards and loot with it. */
  floor = 1;
  /** Tiles taken by a side pocket (interior, walls, approach): other layouts keep out. Index = y * width + x. */
  claimed = new Set<number>();
  private serial = 0;

  nextId(prefix: string): string {
    return `${prefix}-${this.serial++}`;
  }

  /** Lengths of every list, so a failed room layout can undo what it added. */
  mark(): number[] {
    return [this.decor.length, this.lights.length, this.chests.length, this.terminals.length, this.hazards.length, this.medics.length];
  }

  rollback(m: number[]): void {
    this.decor.length = m[0];
    this.lights.length = m[1];
    this.chests.length = m[2];
    this.terminals.length = m[3];
    this.hazards.length = m[4];
    this.medics.length = m[5];
  }

  addPost(roomId: string, tx: number, ty: number): void {
    (this.posts[roomId] ??= []).push({ tx, ty });
  }
}

/** Which case tier a locked vault door guards: red opens a tier-2 case, blue a tier-3. */
export const VAULT_TIER: Record<KeyColor, 1 | 2 | 3> = { red: 2, blue: 3, gold: 3 };
