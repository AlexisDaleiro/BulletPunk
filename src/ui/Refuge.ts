import { getCharacter } from '../characters/characters';
import { WEAPONS, type WeaponId } from '../combat/weapons';
import { button, el } from './dom';
import { operativeSplash, SPLASH_ROOT } from './splash';
import type { UiContext } from './UI';

function weaponSymbol(type: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 45');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    type === 'PISTOL'
      ? '<path d="M24 10h60v12H55l-5 18H34l3-18H24z" fill="currentColor"/><path d="M30 15h46M57 25h10v7H53" stroke="#243134" fill="none" stroke-width="2"/>'
      : type === 'SHOTGUN'
        ? '<path d="M3 17l19-5 18 4h65v7H38l-6 16H19l3-16H3z" fill="currentColor"/><path d="M52 14v14h23V14M90 17h25v5" fill="none" stroke="currentColor" stroke-width="3"/>'
        : '<path d="M3 9l19 7h13v-5h36v5h34v7H68l-8 13H47l2-13H23L4 30z" fill="currentColor"/><path d="M40 8h22M47 4h10M76 15v9M85 15v9M29 18h15" fill="none" stroke="currentColor" stroke-width="3"/>';
  return svg;
}

export function refugeBackdrop(): HTMLElement {
  const root = el('div', 'cinematic-backdrop refuge-backdrop');
  root.setAttribute('aria-hidden', 'true');
  const art = el('div', 'cinematic-art');
  art.style.backgroundImage = `url("${SPLASH_ROOT}refuge.webp")`;
  root.append(art, el('div', 'refuge-beam'), el('div', 'cinematic-grain'));
  return root;
}
export function refugeScene(ctx: UiContext): HTMLElement {
  const def = getCharacter(ctx.profile.value.lastCharacter),
    look = ctx.profile.lookFor(def.id),
    stats = ctx.profile.value.stats;
  const room = el('section', 'refuge-scene');
  room.setAttribute('aria-label', `Refugio de ${def.name}`);
  room.dataset.skin = look.skin;
  const portrait = operativeSplash(def, 'refuge-portrait', false, look);
  const trophies = el('div', 'refuge-trophies');
  for (const [glyph, name, earned] of [
    ['◇', 'PRIMERA INCURSIÓN', stats.runs >= 1],
    ['⌁', 'DIEZ ELIMINACIONES', stats.kills >= 10],
    ['△', 'PISO TRES', stats.bestFloor >= 3],
  ] as const) {
    const trophy = el('span', earned ? 'trophy earned' : 'trophy', el('b', '', glyph), el('small', '', name));
    trophy.title = earned ? `${name} · OBTENIDO` : `${name} · PENDIENTE`;
    trophy.setAttribute('role', 'img');
    trophy.setAttribute('aria-label', trophy.title);
    trophies.append(trophy);
  }
  const weapon = WEAPONS[def.weapon];
  const weaponName = el('strong', '', weapon.name),
    symbol = el('span', 'bench-silhouette', weaponSymbol(weapon.type));
  const bench = el(
    'div',
    'refuge-workbench',
    el('span', 'menu-eyebrow', 'BANCO DE ARMAS'),
    symbol,
    weaponName,
    el(
      'small',
      '',
      look.weapon === 'FACTORY' ? 'ACABADO DE FÁBRICA' : look.weapon === 'ION' ? 'ACABADO IONIZADO' : 'COBRE CEPILLADO',
    ),
  );
  const equipment = (): void => {
    const preview = ctx.saves.savedCharacterId === def.id ? ctx.saves.preview : null;
    const current = preview ? (WEAPONS[preview.weapons[preview.activeSlot] as WeaponId] ?? weapon) : weapon;
    weaponName.textContent = current.name;
    symbol.replaceChildren(weaponSymbol(current.type));
  };
  equipment();
  ctx.cleanup(ctx.saves.subscribe(equipment));
  const character = el(
    'div',
    'refuge-operative',
    portrait,
    el(
      'div',
      '',
      el('span', 'menu-eyebrow', def.role),
      el('h2', '', def.name),
      el('p', '', def.ability.name),
      button('CAMBIAR EQUIPO ↗', () => ctx.go('character'), 'refuge-change'),
    ),
  );
  room.append(
    el('div', 'refuge-room-art'),
    el('div', 'refuge-room-light'),
    el(
      'div',
      'refuge-scene-header',
      el('span', 'menu-eyebrow', 'TU REFUGIO / SECTOR 09'),
      el('span', 'ready-tag', 'EN CASA'),
    ),
    bench,
    trophies,
    character,
  );
  return room;
}
export function checkpointCard(ctx: UiContext): HTMLElement {
  const card = el('section', 'checkpoint-card');
  card.setAttribute('aria-label', 'Resumen de la incursión guardada');
  const image = el('img', 'checkpoint-portrait'),
    name = el('strong'),
    detail = el('span'),
    health = el('span'),
    weapons = el('p'),
    bar = el('i', 'checkpoint-health-fill');
  const copy = el(
    'div',
    'checkpoint-copy',
    el('small', '', 'INCURSIÓN / GUARDADO CONFIRMADO'),
    name,
    detail,
    el('div', 'checkpoint-health', bar),
    health,
    weapons,
  );
  const sync = (): void => {
    card.hidden = !ctx.saves.hasSaved;
    const preview = ctx.saves.preview,
      def = getCharacter(ctx.saves.savedCharacterId ?? ctx.profile.value.lastCharacter);
    image.src = `${SPLASH_ROOT}${def.id.toLowerCase()}.webp`;
    image.alt = `${def.name}`;
    name.textContent = def.name;
    detail.textContent = `PISO ${ctx.saves.savedFloor} · ${ctx.saves.savedAt ? new Date(ctx.saves.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'PENDIENTE'}`;
    bar.style.width = `${preview ? Math.max(0, Math.min(100, (preview.hp / preview.maxHp) * 100)) : 0}%`;
    health.textContent = preview
      ? `${Math.ceil(preview.hp)} / ${preview.maxHp} VIDA · ${Math.ceil(preview.shield)} ESCUDO`
      : 'Recuperando equipo…';
    weapons.textContent = preview
      ? preview.weapons
          .map((id, i) => `${i === preview.activeSlot ? '▸ ' : ''}${WEAPONS[id as WeaponId]?.name ?? id}`)
          .join(' / ')
      : '';
  };
  sync();
  ctx.cleanup(ctx.saves.subscribe(sync));
  card.append(image, copy);
  return card;
}
