import type { WeaponId } from '../combat/weapons.ts';
import type { CyberwarePassive } from '../types.ts';

/** A playable operative. Vitals and weapon replace the hardcoded ones in `createPlayer`. */
export interface CharacterDef {
  id: string;
  name: string;
  color: number;
  description: string;
  hp: number;
  shield: number;
  weapon: WeaponId;
  /** Innate perk, installed like an implant so `recomputeStats` keeps it. */
  passive?: CyberwarePassive;
}

/** Stays close to PLAYER_VITALS (100 hp / 50 shield): each operative trades one thing for another. */
export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'VANGUARD',
    name: 'VANGUARD',
    color: 0x00e5ff,
    description: 'Balanced field operative. Standard issue.',
    hp: 100,
    shield: 50,
    weapon: 'PLASMA_PISTOL',
  },
  {
    id: 'GHOST',
    name: 'GHOST',
    color: 0xb36bff,
    description: 'Fragile infiltrator. Quieter footsteps and shots.',
    hp: 85,
    shield: 45,
    weapon: 'PLASMA_PISTOL',
    passive: {
      id: 'LOW_SIGNATURE',
      name: 'LOW SIGNATURE',
      description: 'Your noise ripples are 15% smaller',
      cost: 0,
      modifiers: { noiseDampingMult: 0.85 },
    },
  },
  {
    id: 'BREACHER',
    name: 'BREACHER',
    color: 0x39ff88,
    description: 'Armored point man. Hits hard up close, moves slower.',
    hp: 110,
    shield: 40,
    weapon: 'NEON_SHOTGUN',
    passive: {
      id: 'HEAVY_FRAME',
      name: 'HEAVY FRAME',
      description: '-8% move speed',
      cost: 0,
      modifiers: { moveSpeedMult: 0.92 },
    },
  },
];

export const DEFAULT_CHARACTER_ID = 'VANGUARD';

export const findCharacter = (id: string): CharacterDef | undefined => CHARACTERS.find((c) => c.id === id);

/** Unknown ids (old save, edited storage) fall back to the default operative. */
export function getCharacter(id: string): CharacterDef {
  return findCharacter(id) ?? CHARACTERS[0];
}
