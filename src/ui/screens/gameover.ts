import { getCharacter } from '../../characters/characters';
import { button, copyButton, el } from '../dom';
import { formatDuration, seedUrl } from '../format';
import type { UiContext } from '../UI';

export function gameOverScreen(ctx: UiContext): HTMLElement {
  const { run } = ctx;
  const info = ctx.gameOver ?? run.snapshot();
  const line = (name: string, value: string): HTMLElement => el('div', 'stat', el('span', '', name), el('strong', 'value', value));

  const retry = button(
    'RETRY',
    () => {
      ctx.close();
      run.startRun(info.characterId);
    },
    'primary',
  );
  retry.setAttribute('data-autofocus', '');

  return el(
    'div',
    'panel over',
    el('h2', 'heading lost', 'SIGNAL LOST'),
    el(
      'div',
      'summary',
      line('OPERATIVE', getCharacter(info.characterId).name),
      line('FLOOR REACHED', String(info.floor)),
      line('CREDITS', String(info.credits)),
      line('KILLS', String(info.kills)),
      line('TIME', formatDuration(info.timeSec)),
      el('div', 'row seed', el('span', 'name', `SEED ${info.seed}`), copyButton('COPY LINK', () => seedUrl(location.href, info.seed))),
    ),
    el(
      'div',
      'actions',
      retry,
      button('MAIN MENU', () => {
        run.quitToMenu();
        ctx.open('title');
      }),
    ),
  );
}
