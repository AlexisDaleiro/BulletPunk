import { createRng } from '../core/rng.ts';
import type { CharacterComponent } from '../ecs/components.ts';
import type { CharacterId } from './characters.ts';

export interface AbilityUpgrade {
  id: string; name: string; description: string; glyph: string;
  character?: CharacterId;
  repeatable?: boolean;
}
export const ABILITY_UPGRADES: readonly AbilityUpgrade[] = [
  { id: 'LONG_CYCLE', name: 'Tiempo prestado', description: '+25% de duración de habilidad, hasta 15 s. Acumulable.', glyph: '◷', repeatable: true },
  { id: 'QUICK_RECYCLE', name: 'Circuito recursivo', description: '−15% de recarga de habilidad, hasta un mínimo de 3 s. Acumulable.', glyph: '⟳', repeatable: true },
  { id: 'SECOND_WIND', name: 'Segundo aliento', description: 'Activar la habilidad recupera 12 de vida, hasta 60 por activación. Acumulable.', glyph: '✚', repeatable: true },
  { id: 'BALLISTICS', name: 'Especialización balística', description: '+5% de daño de disparos durante esta incursión. Acumulable.', glyph: '⌁', repeatable: true },
  { id: 'STRUCTURAL', name: 'Núcleo vital', description: '+10 de vida máxima y recupera esa cantidad. Acumulable durante esta incursión.', glyph: '✚', repeatable: true },
  { id: 'ENERGY_RESERVE', name: 'Reserva de energía', description: '+10 de escudo máximo y recupera esa cantidad. Acumulable durante esta incursión.', glyph: '⬡', repeatable: true },
  { id: 'NIX_ECHO', character: 'NIX', name: 'Eco señuelo', description: 'Paso Fantasma deja una silueta sonora en el punto de activación que atrae patrullas.', glyph: '◈' },
  { id: 'NIX_PHASE', character: 'NIX', name: 'Disparo espectral', description: 'Disparar ya no interrumpe Paso Fantasma.', glyph: '⌁' },
  { id: 'BRASA_NOVA', character: 'BRASA', name: 'Descarga de ruptura', description: 'Activar la sobrecarga inflige 24 de daño a enemigos cercanos con línea de visión.', glyph: '✹' },
  { id: 'BRASA_PLATES', character: 'BRASA', name: 'Placas superpuestas', description: '+40 de escudo temporal al activar la sobrecarga.', glyph: '⬡' },
  { id: 'VECTOR_FOCUS', character: 'VECTOR', name: 'Ventana letal', description: 'Durante el barrido, tus disparos infligen +35% de daño.', glyph: '⌖' },
  { id: 'VECTOR_JAM', character: 'VECTOR', name: 'Lectura invasiva', description: 'Activar el barrido interrumpe 1 s a enemigos visibles en un radio de 230 px.', glyph: '◎' },
  { id: 'SUTURA_BARRIER', character: 'SUTURA', name: 'Drones de barrera', description: 'Los drones regeneran también 8 de escudo por segundo mientras reparan.', glyph: '⬡' },
  { id: 'SUTURA_SURGE', character: 'SUTURA', name: 'Adrenalina biótica', description: 'Durante la reparación, +30% de velocidad y +15% de daño.', glyph: '↗' },
  { id: 'VOLT_ARC', character: 'VOLT', name: 'Arco de retorno', description: 'El pulso de interferencia también inflige 26 de daño.', glyph: 'ϟ' },
  { id: 'VOLT_REACH', character: 'VOLT', name: 'Resonancia', description: '+45% de alcance del pulso y +1 s de interrupción.', glyph: '◉' },
  { id: 'MORSA_FORTRESS', character: 'MORSA', name: 'Fortaleza móvil', description: 'Durante Anclaje recibís un 60% menos de daño y conservás tu velocidad normal.', glyph: '▣' },
  { id: 'MORSA_FEED', character: 'MORSA', name: 'Cinta de emergencia', description: 'Activar Anclaje llena el cargador del arma actual consumiendo su reserva.', glyph: '≋' },
];

export function upgradeChoices(c: CharacterComponent, seed: number, evolutionLevel: number): AbilityUpgrade[] {
  const owned = c.upgrades ?? [];
  const available = ABILITY_UPGRADES.filter(u => (!u.character || u.character === c.def.id) && (u.repeatable || !owned.includes(u.id))
    && (u.id !== 'LONG_CYCLE' || c.def.ability.duration < 15)
    && (u.id !== 'QUICK_RECYCLE' || c.def.ability.cooldown > 3)
    && (u.id !== 'SECOND_WIND' || (c.augments?.activationHeal ?? 0) < 60));
  const rng = createRng(seed ^ Math.imul(evolutionLevel, 7919));
  const special = available.filter(u => u.character);
  const choices: AbilityUpgrade[] = [];
  if (special.length) choices.push(special[rng.int(0, special.length - 1)]);
  const pool = available.filter(u => !choices.includes(u));
  while (choices.length < 3 && pool.length) choices.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return choices;
}

/** Mutates only the run-owned ability copy. Caller validates that this upgrade was offered. */
export function applyAbilityUpgrade(c: CharacterComponent, id: string): boolean {
  const item = ABILITY_UPGRADES.find(u => u.id === id);
  if (!item || (item.character && item.character !== c.def.id) || (!item.repeatable && c.upgrades?.includes(id))) return false;
  c.upgrades ??= [];
  c.augments ??= {};
  // Clone even if a caller supplied a catalog character instead of a run character.
  c.def = { ...c.def, ability: { ...c.def.ability } };
  const a = c.def.ability;
  switch (id) {
    case 'LONG_CYCLE': a.duration = Math.min(15, a.duration * 1.25); break;
    case 'QUICK_RECYCLE': a.cooldown = Math.max(3, a.cooldown * .85); break;
    case 'SECOND_WIND': c.augments.activationHeal = Math.min(60, (c.augments.activationHeal ?? 0) + 12); break;
    case 'BALLISTICS': c.augments.damageMult = (c.augments.damageMult ?? 1) * 1.05; break;
    case 'STRUCTURAL': c.augments.maxHp = (c.augments.maxHp ?? 0) + 10; break;
    case 'ENERGY_RESERVE': c.augments.maxShield = (c.augments.maxShield ?? 0) + 10; break;
    case 'NIX_ECHO': c.augments.decoy = true; break;
    case 'NIX_PHASE': c.augments.ghostFire = true; break;
    case 'BRASA_NOVA': c.augments.novaDamage = 24; break;
    case 'BRASA_PLATES': a.shieldAmount = (a.shieldAmount ?? 0) + 40; break;
    case 'VECTOR_FOCUS': a.damageMult = 1.35; break;
    case 'VECTOR_JAM': c.augments.scanJam = true; break;
    case 'SUTURA_BARRIER': c.augments.repairShield = 8; break;
    case 'SUTURA_SURGE': a.speedMult = 1.3; a.damageMult = 1.15; break;
    case 'VOLT_ARC': c.augments.pulseDamage = 26; break;
    case 'VOLT_REACH': a.pulseRadius = (a.pulseRadius ?? 170) * 1.45; a.duration += 1; break;
    case 'MORSA_FORTRESS': a.damageTakenMult = .4; a.speedMult = 1; break;
    case 'MORSA_FEED': c.augments.refill = true; break;
  }
  c.upgrades.push(id);
  c.cooldownRemaining = Math.min(c.cooldownRemaining, a.cooldown);
  return true;
}
