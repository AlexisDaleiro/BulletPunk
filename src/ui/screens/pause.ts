import { getCharacter } from '../../characters/characters';
import { button, confirmButton, copyButton, el } from '../dom';
import { formatDuration, seedUrl } from '../format';
import type { UiContext } from '../UI';
import { ABILITY_UPGRADES } from '../../characters/upgrades';

/** Run summary on the left, the four choices on the right. Options are the same screen as on the title. */
export function pauseScreen(ctx: UiContext): HTMLElement {
  const { run } = ctx;
  const info = run.snapshot();

  const line = (name: string, value: string, className = 'stat'): HTMLElement => el('div', className, el('span', '', name), el('strong', 'value', value));
  const summary = el(
    'div',
    'summary',
    line('OPERATIVE', getCharacter(info.characterId).name),
    line('FLOOR', String(info.floor)),
    line('EXPERIENCIA', `NV ${info.experienceLevel} · ${info.experience} XP`),
    line('CREDITS', String(info.credits)),
    line('KILLS', String(info.kills)),
    line('TIME', formatDuration(info.timeSec)),
    line('IMPLANTS', info.implants.length > 0 ? info.implants.join(', ') : 'NONE', 'stat block'),
    line('EVOLUCIONES', info.upgrades.length ? info.upgrades.map(id => ABILITY_UPGRADES.find(u => u.id === id)?.name).join(', ') : 'NINGUNA', 'stat block'),
    el('div', 'row seed', el('span', 'name', `SEED ${info.seed}`), copyButton('COPY LINK', () => seedUrl(location.href, info.seed))),
  );

  const resume = button('RESUME', ctx.resume, 'primary');
  resume.setAttribute('data-autofocus', '');
  const menu = el(
    'div',
    'menu',
    resume,
    button('OPTIONS', () => ctx.go('options')),
    confirmButton(
      'RESTART RUN',
      'SURE? PRESS AGAIN',
      () => {
        ctx.close();
        run.restartRun();
      },
      'danger',
    ),
    confirmButton(
      'MAIN MENU',
      'ABANDON? PRESS AGAIN',
      () => {
        run.quitToMenu();
        ctx.open('title');
      },
      'danger',
    ),
  );

  return el('div', 'panel pause', el('h2', 'heading', 'PAUSED'), summary, menu);
}
