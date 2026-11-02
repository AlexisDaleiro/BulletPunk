import type { WeaponId } from '../combat/weapons.ts';
import type { CyberwarePassive } from '../types.ts';

export type CharacterId = 'NIX' | 'BRASA' | 'VECTOR';
export interface AbilityDef {
  kind: 'GHOST_STEP' | 'OVERLOAD' | 'OPTICAL_SWEEP';
  name: string;
  description: string;
  duration: number;
  cooldown: number;
  speedMult?: number;
  movementNoiseMult?: number;
  shieldAmount?: number;
  visionMult?: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  color: number;
  palette: { cloth: number; armor: number; light: number; metal: number };
  description: string;
  weakness: string;
  hp: number;
  shield: number;
  moveSpeed: number;
  weapon: WeaponId;
  passive: CyberwarePassive;
  ability: AbilityDef;
}

/** Prototype tuning; temporary abilities never overwrite implant stats. */
export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'NIX', name: 'NIX', role: 'INFILTRACIÓN', color: 0x63cbbb,
    palette: { cloth: 0x202f35, armor: 0x3f5359, light: 0xd8e4df, metal: 0x64797c },
    description: 'Entra por el flanco. Golpea y desaparece.',
    weakness: 'Armadura ligera · alcance corto',
    hp: 85, shield: 35, moveSpeed: 1.08, weapon: 'HUSH_SMG',
    passive: { id: 'SOFT_SOLES', name: 'HUELLA REDUCIDA', description: 'Pasos un 30% más silenciosos.', cost: 0, modifiers: { movementNoiseMult: 0.7 } },
    ability: { kind: 'GHOST_STEP', name: 'PASO FANTASMA', description: '+25% velocidad y −85% ruido de pasos durante 3 s. Disparar cancela el efecto.', duration: 3, cooldown: 11, speedMult: 1.25, movementNoiseMult: 0.15 },
  },
  {
    id: 'BRASA', name: 'BRASA', role: 'ASALTO', color: 0xe5a05a,
    palette: { cloth: 0x342c29, armor: 0x65564a, light: 0xd9c2a4, metal: 0x8e8171 },
    description: 'Rompe la primera línea. Aguanta la respuesta.',
    weakness: 'Desplazamiento lento · disparos ruidosos',
    hp: 110, shield: 75, moveSpeed: 0.84, weapon: 'BREACH_SHOTGUN',
    // The reinforced frame is represented directly by the shield and movement values above.
    passive: { id: 'REINFORCED_CORE', name: 'NÚCLEO REFORZADO', description: '75 de escudo base. Movimiento un 16% más lento.', cost: 0, modifiers: {} },
    ability: { kind: 'OVERLOAD', name: 'SOBRECARGA DEFENSIVA', description: 'Absorbe hasta 60 de daño durante 4 s. El escudo temporal se consume primero.', duration: 4, cooldown: 16, shieldAmount: 60 },
  },
  {
    id: 'VECTOR', name: 'VECTOR', role: 'RECONOCIMIENTO', color: 0xb8a1dc,
    palette: { cloth: 0x20373f, armor: 0x536870, light: 0xe0dfcd, metal: 0x87989b },
    description: 'Lee el terreno. Resuelve con un solo disparo.',
    weakness: 'Cadencia baja · vulnerable de cerca',
    hp: 90, shield: 45, moveSpeed: 0.96, weapon: 'LANCE_RIFLE',
    passive: { id: 'TELEMETRY', name: 'TELEMETRÍA', description: '+10% alcance de visión.', cost: 0, modifiers: { visionRangeMult: 1.1 } },
    ability: { kind: 'OPTICAL_SWEEP', name: 'BARRIDO ÓPTICO', description: '+45% alcance de visión frontal durante 4 s. Los obstáculos siguen bloqueando la vista.', duration: 4, cooldown: 14, visionMult: 1.45 },
  },
];

export const DEFAULT_CHARACTER_ID = 'NIX';
const LEGACY_IDS: Record<string, CharacterId> = { VANGUARD: 'NIX', GHOST: 'NIX', BREACHER: 'BRASA' };

export const findCharacter = (id: string): CharacterDef | undefined => CHARACTERS.find((c) => c.id === (LEGACY_IDS[id] ?? id));

/** Unknown ids (old save, edited storage) fall back to the default operative. */
export function getCharacter(id: string): CharacterDef {
  return findCharacter(id) ?? CHARACTERS[0];
}
