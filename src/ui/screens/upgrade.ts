import { ABILITY_UPGRADES } from '../../characters/upgrades';
import { button, el } from '../dom';
import type { UiContext } from '../UI';

export function upgradeScreen(ctx: UiContext): HTMLElement {
  const choices = el('div', 'evolution-choices');
  for (const [index, upgrade] of ctx.run.upgradeOptions.entries()) {
    const choice = button('', () => {
      if (ctx.run.chooseUpgrade(upgrade.id)) ctx.close();
    }, 'evolution-choice');
    choice.dataset.upgrade = upgrade.id;
    choice.append(el('span', 'evolution-number', `0${index + 1} / ${upgrade.character ? 'EVOLUCIÓN EXCLUSIVA' : 'MEJORA ACUMULABLE'}`),
      el('span', 'evolution-glyph', upgrade.glyph), el('strong', '', upgrade.name), el('p', '', upgrade.description), el('span', 'evolution-pick', 'ELEGIR ↗'));
    if (index === 0) choice.setAttribute('data-autofocus', '');
    choices.append(choice);
  }
  const owned = ctx.run.snapshot().upgrades;
  return el('div', 'panel evolution-panel',
    el('span', 'roster-kicker', `PISO ${ctx.run.snapshot().floor} / EVOLUCIÓN DE CAMPO`),
    el('h2', 'roster-title', 'Elige cómo vas a sobrevivir'),
    el('p', 'evolution-intro', 'Una elección por piso. Las mejoras se combinan durante esta incursión.'), choices,
    el('p', 'evolution-owned', owned.length ? `TU CONFIGURACIÓN · ${owned.map(id => ABILITY_UPGRADES.find(u => u.id === id)?.name).join(' · ')}` : 'La partida está en pausa hasta que elijas una mejora.'),
  );
}
