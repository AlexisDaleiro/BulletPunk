import { CHARACTERS, getCharacter } from '../../characters/characters';
import { WEAPONS } from '../../combat/weapons';
import { button, el } from '../dom';
import { operativePreview } from '../preview';
import type { UiContext } from '../UI';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export function characterScreen(ctx: UiContext): HTMLElement {
  const { profile } = ctx;
  const cards = el('div', 'cards');
  const buttons = new Map<string, HTMLButtonElement>();
  const deploy = button('', () => {
    ctx.close();
    ctx.run.startRun(getCharacter(profile.value.lastCharacter).id, ctx.takeSeed());
  }, 'primary');
  const selected = el('span', 'selection-label');

  const refresh = (): void => {
    const def = getCharacter(profile.value.lastCharacter);
    for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === def.id));
    deploy.textContent = `DESPLEGAR A ${def.name} →`;
    selected.textContent = `${def.name} / ${def.role}`;
  };

  for (const def of CHARACTERS) {
    const preview = operativePreview(ctx.renderer, def);
    preview.className = 'card-preview';
    const card = el(
      'button',
      'card',
      el('span', 'card-role', `0${CHARACTERS.indexOf(def) + 1} / ${def.role}`),
      preview,
      el('strong', 'card-name', def.name),
      el('span', 'card-desc', def.description),
      el('span', 'card-stat', `VIDA ${def.hp} · ESCUDO ${def.shield} · VEL ${Math.round(def.moveSpeed * 100)}%`),
      el('span', 'card-stat', WEAPONS[def.weapon].name),
      el('span', 'card-ability', def.ability.name),
      el('span', 'card-ability-desc', def.ability.description),
      el('span', 'card-timing', `${def.ability.duration} s activa / ${def.ability.cooldown} s recarga`),
      el('span', 'card-perk', `${def.passive.name}: ${def.passive.description}`),
      el('span', 'card-weakness', def.weakness),
    );
    card.type = 'button';
    card.style.setProperty('--c', hex(def.color));
    card.addEventListener('click', () => {
      profile.setLastCharacter(def.id);
      refresh();
    });
    buttons.set(def.id, card);
    cards.append(card);
  }
  refresh();
  buttons.get(getCharacter(profile.value.lastCharacter).id)?.setAttribute('data-autofocus', '');

  return el('div', 'panel operative-select',
    el('div', 'roster-header', el('span', 'roster-kicker', 'BULLETPUNK / PROTOCOLO DE DESPLIEGUE'), el('h2', 'roster-title', 'Elige tu operativo'), el('p', 'roster-subtitle', 'Tres formas de entrar. Una salida.')),
    cards,
    el('div', 'roster-footer', button('VOLVER', ctx.back), selected, deploy),
    el('p', 'roster-controls', 'WASD mover · Ratón apuntar · F habilidad · Espacio dash · Q cambiar arma'),
  );
}
