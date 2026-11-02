// What a chest gives. The generator fixes each chest's family, tier and seed; the contents resolve
// when it is opened, from that seed, the floor and what the player carries. Same floor + same gear
// = same loot; useless results (ammo for a pistol, repairs at full health, a gun already owned) are
// swapped for something that helps. Pure. `.ts` extensions: Node's test runner.
import type { WeaponId } from '../combat/weapons.ts';
import { REWARDS } from '../config.ts';
import { createRng, type Rng } from '../core/rng.ts';
import { IMPLANT_TIER, IMPLANTS, type ImplantId } from '../shop/implants.ts';
import type { ChestCategory } from '../world/plan.ts';

export interface Reward {
  kind: 'WEAPON' | 'IMPLANT' | 'AMMO' | 'CREDITS' | 'HEAL';
  id: string | null;
  /** WEAPON/AMMO: magazines. CREDITS: credits. HEAL: hit points restored (the shield refills too). */
  amount: number;
}

/** A snapshot of the player's equipment and condition. */
export interface LootContext {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  /** Owned weapon ids. */
  weapons: readonly string[];
  /** True when any owned weapon uses finite ammo (the pistol does not). */
  usesAmmo: boolean;
  /** Installed implant ids. */
  implants: readonly string[];
}

/** Weapons a special case can hold, by rarity. */
export const GEAR_WEAPONS: Record<1 | 2 | 3, readonly WeaponId[]> = {
  1: ['AUTO_SMG', 'NEON_SHOTGUN', 'HUSH_SMG'],
  2: ['BREACH_SHOTGUN', 'LANCE_RIFLE', 'NEON_SHOTGUN', 'AUTO_SMG'],
  3: ['HEAVY_RAILGUN', 'LANCE_RIFLE', 'BREACH_SHOTGUN'],
};

const credits = (floor: number, rng: Rng, bonus = 0): number => REWARDS.credits.base + REWARDS.credits.perFloor * floor + bonus + rng.int(0, 8);

export function rollSupply(category: ChestCategory, seed: number, floor: number, ctx: LootContext): Reward[] {
  const rng = createRng(seed);
  const hurt = ctx.hp < ctx.maxHp || ctx.shield < ctx.maxShield;
  if (category === 'AMMO' && ctx.usesAmmo) {
    return [{ kind: 'AMMO', id: null, amount: REWARDS.ammoMagazines + (floor >= 4 ? 1 : 0) }];
  }
  if (category === 'MED' && hurt) {
    return [{ kind: 'HEAL', id: null, amount: Math.ceil(ctx.maxHp * REWARDS.medFraction) }];
  }
  // Nothing useful of the promised kind: pay out credits, a little extra for the trouble.
  return [{ kind: 'CREDITS', id: null, amount: credits(floor, rng, category === 'CREDITS' ? 0 : 6) }];
}

export function rollSpecial(tier: 1 | 2 | 3, seed: number, floor: number, ctx: LootContext): Reward[] {
  const rng = createRng(seed);
  const owned = new Set(ctx.weapons);
  const installed = new Set(ctx.implants);
  const weapons = GEAR_WEAPONS[tier].filter((id) => !owned.has(id));
  const implants = (Object.keys(IMPLANTS) as ImplantId[]).filter((id) => IMPLANT_TIER[id] === tier && !installed.has(id));
  // Lower-tier leftovers keep the case worth opening when the exact tier is exhausted.
  const lesser = (Object.keys(IMPLANTS) as ImplantId[]).filter((id) => IMPLANT_TIER[id] < tier && !installed.has(id));

  const out: Reward[] = [];
  const wantWeapon = rng.chance(0.5);
  if (wantWeapon && weapons.length > 0) out.push({ kind: 'WEAPON', id: weapons[rng.int(0, weapons.length - 1)], amount: 2 });
  else if (implants.length > 0) out.push({ kind: 'IMPLANT', id: implants[rng.int(0, implants.length - 1)], amount: 1 });
  else if (weapons.length > 0) out.push({ kind: 'WEAPON', id: weapons[rng.int(0, weapons.length - 1)], amount: 2 });
  else if (lesser.length > 0) out.push({ kind: 'IMPLANT', id: lesser[rng.int(0, lesser.length - 1)], amount: 1 });
  else out.push({ kind: 'CREDITS', id: null, amount: credits(floor, rng, 40 * tier) });

  out.push({ kind: 'CREDITS', id: null, amount: REWARDS.credits.special + 6 * tier + rng.int(0, 8) });
  if (tier >= 2 && ctx.usesAmmo) out.push({ kind: 'AMMO', id: null, amount: 1 });
  return out;
}

/** Contents for any chest: supplies adapt to need, special cases to what the player lacks. */
export function rollChest(family: 'SUPPLY' | 'SPECIAL', category: ChestCategory, tier: 1 | 2 | 3, seed: number, floor: number, ctx: LootContext): Reward[] {
  return family === 'SPECIAL' ? rollSpecial(tier, seed, floor, ctx) : rollSupply(category, seed, floor, ctx);
}
