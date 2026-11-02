import { getCharacter } from '../../characters/characters';
import { favoriteCharacter, NAME_MAX } from '../../profile/Profile';
import { button, confirmButton, el, row } from '../dom';
import { formatDuration } from '../format';
import type { UiContext } from '../UI';

export function profileScreen(ctx: UiContext): HTMLElement {
  const { profile } = ctx;

  const name = el('input', 'field');
  name.type = 'text';
  name.maxLength = NAME_MAX;
  name.autocomplete = 'off';
  name.spellcheck = false;
  name.setAttribute('aria-label', 'Callsign');
  name.value = profile.value.name;

  const message = el('p', 'message');
  message.setAttribute('aria-live', 'polite');
  const say = (text: string, state: 'ok' | 'bad' | ''): void => {
    message.textContent = text;
    message.dataset.state = state;
  };

  const save = (): void => {
    const result = profile.setName(name.value);
    if (result.ok) {
      name.value = result.name;
      say('SAVED', 'ok');
    } else {
      say(result.error, 'bad');
    }
  };
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });
  name.addEventListener('input', () => say('', ''));

  const stats = el('div', 'stats');
  const renderStats = (): void => {
    const p = profile.value;
    const favorite = favoriteCharacter(p);
    const lines: [string, string][] = [
      ['FAVORITE', favorite ? getCharacter(favorite).name : '-'],
      ['RUNS', String(p.stats.runs)],
      ['BEST FLOOR', String(p.stats.bestFloor)],
      ['TOTAL TIME', formatDuration(p.stats.totalTimeSec)],
      ['MAX CREDITS', String(p.stats.maxCredits)],
      ['KILLS', String(p.stats.kills)],
    ];
    stats.replaceChildren(...lines.map(([k, v]) => el('div', 'stat', el('span', '', k), el('strong', 'value', v))));
  };
  renderStats();

  const wipe = confirmButton(
    'DELETE DATA',
    'SURE? PRESS AGAIN',
    () => {
      profile.clear();
      name.value = profile.value.name;
      renderStats();
      say('DATA ERASED', 'ok');
    },
    'danger',
  );

  return el(
    'div',
    'panel wide',
    el('h2', 'heading', 'PROFILE'),
    row('CALLSIGN', name, button('SAVE', save)),
    message,
    stats,
    el('div', 'actions', wipe, button('BACK', ctx.back)),
  );
}
