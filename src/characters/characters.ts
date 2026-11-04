import type { WeaponId } from '../combat/weapons.ts';
import type { CyberwarePassive } from '../types.ts';
import type { CosmeticLook } from '../profile/cosmetics.ts';

export type CharacterId = 'NIX' | 'BRASA' | 'VECTOR' | 'SUTURA' | 'VOLT' | 'MORSA';
export interface AbilityDef {
  kind: 'GHOST_STEP' | 'OVERLOAD' | 'OPTICAL_SWEEP' | 'REPAIR' | 'EMP_PULSE' | 'ANCHOR';
  name: string;
  description: string;
  duration: number;
  cooldown: number;
  speedMult?: number;
  movementNoiseMult?: number;
  shieldAmount?: number;
  visionMult?: number;
  healPerSecond?: number;
  pulseRadius?: number;
  damageTakenMult?: number;
  damageMult?: number;
}

export interface CharacterDef {
  look?: CosmeticLook;
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
  {
    id: 'SUTURA', name: 'SUTURA', role: 'SUPERVIVENCIA', color: 0xf298b0,
    palette: { cloth: 0x344345, armor: 0xb5beb2, light: 0xf2ecda, metal: 0x809d97 },
    description: 'Mantén el pulso. Vuelve a la pelea.', weakness: 'Protección moderada · curación gradual',
    hp: 95, shield: 40, moveSpeed: 1, weapon: 'PULSE_CARBINE',
    passive: { id: 'BIOCELL', name: 'BIOCELDA', description: 'Regenera 1.5 de escudo por segundo.', cost: 0, modifiers: { shieldRegenRate: 1.5 } },
    ability: { kind: 'REPAIR', name: 'REPARACIÓN BIÓTICA', description: 'Recupera hasta 30 de vida durante 3 s. Puedes seguir moviéndote y disparando.', duration: 3, cooldown: 18, healPerSecond: 10 },
  },
  {
    id: 'VOLT', name: 'VOLT', role: 'CONTROL', color: 0x8bc6fb,
    palette: { cloth: 0x29394b, armor: 0xb59e53, light: 0xf2dc8e, metal: 0x869cab },
    description: 'Interrumpe su respuesta. Abre una ventana.', weakness: 'Poca vida · pulso de corto alcance',
    hp: 80, shield: 45, moveSpeed: 1.12, weapon: 'ARC_SMG',
    passive: { id: 'QUICK_SERVOS', name: 'SERVOS RÁPIDOS', description: '+8% cadencia de disparo.', cost: 0, modifiers: { fireRateMult: 1.08 } },
    ability: { kind: 'EMP_PULSE', name: 'PULSO DE INTERFERENCIA', description: 'Detiene el movimiento y los disparos de enemigos a 170 px durante 2 s. Las paredes bloquean el pulso.', duration: 2, cooldown: 16, pulseRadius: 170 },
  },
  {
    id: 'MORSA', name: 'MORSA', role: 'FUEGO DE APOYO', color: 0xb4cc7b,
    palette: { cloth: 0x354130, armor: 0x74825c, light: 0xd7d9ad, metal: 0x9aa68d },
    description: 'Sostén la posición. Mantén la presión.', weakness: 'Lento · recarga prolongada',
    hp: 130, shield: 50, moveSpeed: 0.8, weapon: 'BELT_LMG',
    passive: { id: 'LOAD_FRAME', name: 'ARNÉS PESADO', description: '130 de vida base y cargador de 44 disparos.', cost: 0, modifiers: {} },
    ability: { kind: 'ANCHOR', name: 'ANCLAJE', description: 'Durante 4 s recibe un 45% menos de daño y causa un 20% más. Se mueve un 35% más lento.', duration: 4, cooldown: 17, damageTakenMult: 0.55, damageMult: 1.2, speedMult: 0.65 },
  },
];

export const DEFAULT_CHARACTER_ID = 'NIX';
const LEGACY_IDS: Record<string, CharacterId> = { VANGUARD: 'NIX', GHOST: 'NIX', BREACHER: 'BRASA' };

export const findCharacter = (id: string): CharacterDef | undefined => CHARACTERS.find((c) => c.id === (LEGACY_IDS[id] ?? id));

/** Unknown ids (old save, edited storage) fall back to the default operative. */
export function getCharacter(id: string): CharacterDef {
  return findCharacter(id) ?? CHARACTERS[0];
}
