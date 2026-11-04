import type { CharacterDef } from '../characters/characters.ts';

export type CosmeticKind = 'skin' | 'weapon' | 'frame' | 'pose';
export interface CosmeticLook { skin: string; weapon: string; frame: string; pose: string }
export interface CosmeticProgress { kills: number; floor: number; runs: number }
export interface CosmeticItem {
  id: string; kind: CosmeticKind; name: string; description: string;
  metric: keyof CosmeticProgress; target: number;
}
export const DEFAULT_LOOK: CosmeticLook = { skin: 'FIELD', weapon: 'FACTORY', frame: 'STANDARD', pose: 'PORTRAIT' };
export const COSMETICS: readonly CosmeticItem[] = [
  { id: 'FIELD', kind: 'skin', name: 'Equipo de campo', description: 'Los colores originales del operativo.', metric: 'kills', target: 0 },
  { id: 'NEON', kind: 'skin', name: 'Espectro', description: 'Armadura azul petróleo y circuitos de jade.', metric: 'kills', target: 5 },
  { id: 'EMBER', kind: 'skin', name: 'Ceniza', description: 'Blindaje de cobre, grafito y luces ámbar.', metric: 'floor', target: 2 },
  { id: 'FACTORY', kind: 'weapon', name: 'De fábrica', description: 'Acabado original de cada arma.', metric: 'kills', target: 0 },
  { id: 'COPPER', kind: 'weapon', name: 'Cobre cepillado', description: 'Cuerpo cobrizo con detalles de latón.', metric: 'runs', target: 1 },
  { id: 'ION', kind: 'weapon', name: 'Ionizado', description: 'Carcasa oscura y conductores luminosos.', metric: 'kills', target: 10 },
  { id: 'STANDARD', kind: 'frame', name: 'Identificación', description: 'Marco de servicio.', metric: 'kills', target: 0 },
  { id: 'CIRCUIT', kind: 'frame', name: 'Circuito', description: 'Doble marco de telemetría turquesa.', metric: 'kills', target: 15 },
  { id: 'ELITE', kind: 'frame', name: 'Laurel de élite', description: 'Remaches y emblema de rango dorados.', metric: 'floor', target: 3 },
  { id: 'PORTRAIT', kind: 'pose', name: 'Retrato', description: 'El retrato de presentación.', metric: 'kills', target: 0 },
  { id: 'COMBAT', kind: 'pose', name: 'En combate', description: 'Una ilustración alternativa con una pose de acción.', metric: 'kills', target: 8 },
];
export const DEFAULT_UNLOCKS = COSMETICS.filter(c => c.target === 0).map(c => c.id);

export interface CosmeticCollection { unlocked: string[]; equipped: Record<string, CosmeticLook> }
export const defaultCollection = (): CosmeticCollection => ({ unlocked: [...DEFAULT_UNLOCKS], equipped: {} });

export function awardCosmetics(collection: CosmeticCollection, progress: CosmeticProgress): CosmeticCollection {
  const unlocked = new Set(collection.unlocked);
  for (const item of COSMETICS) if (progress[item.metric] >= item.target) unlocked.add(item.id);
  return { unlocked: [...unlocked], equipped: { ...collection.equipped } };
}

export function sanitizeCollection(raw: unknown): CosmeticCollection {
  const result = defaultCollection();
  if (!raw || typeof raw !== 'object') return result;
  const data = raw as Record<string, unknown>;
  if (Array.isArray(data.unlocked)) for (const id of data.unlocked) {
    if (typeof id === 'string' && COSMETICS.some(c => c.id === id) && !result.unlocked.includes(id)) result.unlocked.push(id);
  }
  if (data.equipped && typeof data.equipped === 'object') for (const [id, value] of Object.entries(data.equipped)) {
    if (!['NIX', 'BRASA', 'VECTOR', 'SUTURA', 'VOLT', 'MORSA'].includes(id) || !value || typeof value !== 'object') continue;
    const look = { ...DEFAULT_LOOK };
    for (const kind of Object.keys(look) as CosmeticKind[]) {
      const chosen = (value as Record<string, unknown>)[kind];
      if (COSMETICS.some(c => c.id === chosen && c.kind === kind) && result.unlocked.includes(chosen as string)) look[kind] = chosen as string;
    }
    result.equipped[id] = look;
  }
  return result;
}

export function appearanceFor(def: CharacterDef, look: CosmeticLook): CharacterDef {
  const palette = look.skin === 'NEON' ? { cloth: 0x142738, armor: 0x395e70, light: 0xc5f8df, metal: 0x80c6cc }
    : look.skin === 'EMBER' ? { cloth: 0x302927, armor: 0x715648, light: 0xf4d1a0, metal: 0x9c8872 } : { ...def.palette };
  return { ...def, look: { ...look }, palette, color: look.skin === 'NEON' ? 0x68e4c5 : look.skin === 'EMBER' ? 0xffb064 : def.color,
    ability: { ...def.ability }, passive: { ...def.passive, modifiers: { ...def.passive.modifiers } } };
}

export function unlockText(item: CosmeticItem): string {
  return item.target === 0 ? 'DISPONIBLE' : item.metric === 'floor' ? `ALCANZA EL PISO ${item.target}`
    : item.metric === 'kills' ? `${item.target} ENEMIGOS ELIMINADOS` : `${item.target} INCURSIÓN COMPLETADA O TERMINADA`;
}
