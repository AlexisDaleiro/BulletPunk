import { getCharacter } from '../../characters/characters';
import { favoriteCharacter, NAME_MAX } from '../../profile/Profile';
import { button, confirmButton, el, row } from '../dom';
import { formatDuration } from '../format';
import type { UiContext } from '../UI';
import { COSMETICS, DEFAULT_UNLOCKS } from '../../profile/cosmetics';
import { syncLabel } from '../syncLabel';

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
      say('PERFIL ACTUALIZADO', 'ok');
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
      ['FAVORITO', favorite ? getCharacter(favorite).name : '-'],
      ['INCURSIONES', String(p.stats.runs)],
      ['MEJOR PISO', String(p.stats.bestFloor)],
      ['TIEMPO TOTAL', formatDuration(p.stats.totalTimeSec)],
      ['RÉCORD DE CRÉDITOS', String(p.stats.maxCredits)],
      ['ELIMINACIONES', String(p.stats.kills)],
      ['COSMÉTICOS', `${p.cosmetics.unlocked.length - DEFAULT_UNLOCKS.length} / ${COSMETICS.length - DEFAULT_UNLOCKS.length}`],
    ];
    stats.replaceChildren(...lines.map(([k, v]) => el('div', 'stat', el('span', '', k), el('strong', 'value', v))));
  };
  renderStats();
  ctx.cleanup(profile.subscribe(() => { renderStats(); }));
  const storageNote = el('p', 'profile-storage-note', ctx.accounts.isGuest
    ? 'INVITADO · Tu progreso se guarda en este navegador. Entrá con una cuenta para conservarlo en el servidor y usarlo desde otro dispositivo.'
    : 'CUENTA CONECTADA · Tu perfil, estadísticas y estilos se guardan en el servidor. La calidad gráfica permanece en este dispositivo. Podés continuar tu incursión desde el último guardado confirmado, incluso en otro dispositivo.');
  const sync = el('p', 'account-sync-state', syncLabel(ctx.accounts));
  ctx.cleanup(ctx.accounts.subscribe(() => { sync.textContent = syncLabel(ctx.accounts); }));

  const wipe = confirmButton(
    'BORRAR PERFIL',
    '¿BORRAR? TOCÁ OTRA VEZ',
    () => {
      profile.clear();
      name.value = profile.value.name;
      renderStats();
      say('PERFIL BORRADO', 'ok');
    },
    'danger',
  );

  return el(
    'div',
    'panel wide',
    el('h2', 'heading', 'TU PERFIL'),
    storageNote,
    row('ALIAS', name, button('GUARDAR', save)),
    message,
    stats,
    sync,
    el('div', 'actions', button('PERSONALIZAR', () => ctx.go('cosmetics')), ctx.accounts.isGuest ? wipe : button('MI CUENTA', () => ctx.go('account')), button('VOLVER', ctx.back)),
  );
}
