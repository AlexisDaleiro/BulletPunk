import { CHARACTERS } from '../../characters/characters';
import { WEAPONS } from '../../combat/weapons';
import { button, el } from '../dom';
import { operativePreview } from '../preview';
import type { UiContext } from '../UI';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export function characterScreen(ctx: UiContext): HTMLElement {
  const { profile } = ctx;
  const cards = el('div', 'cards');
  const buttons = new Map<string, HTMLButtonElement>();

  const refresh = (): void => {
    for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === profile.value.lastCharacter));
  };

  for (const def of CHARACTERS) {
    const preview = operativePreview(ctx.renderer, def.color);
    preview.className = 'card-preview';
    const card = el(
      'button',
      'card',
      preview,
      el('strong', 'card-name', def.name),
      el('span', 'card-desc', def.description),
      el('span', 'card-stat', `HP ${def.hp} · SHIELD ${def.shield}`),
      el('span', 'card-stat', WEAPONS[def.weapon].name),
      el('span', 'card-perk', def.passive ? `${def.passive.name}: ${def.passive.description}` : 'NO PERK'),
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
  buttons.get(profile.value.lastCharacter)?.setAttribute('data-autofocus', '');

  return el('div', 'panel wide', el('h2', 'heading', 'CHOOSE YOUR OPERATIVE'), cards, button('BACK', ctx.back));
}
