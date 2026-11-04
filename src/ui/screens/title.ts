import { getCharacter } from '../../characters/characters';
import { button, el } from '../dom';
import type { UiContext } from '../UI';
import { cinematicBackdrop, operativeSplash } from '../splash';

export function titleScreen(ctx: UiContext): HTMLElement {
  const { run, profile } = ctx;
  const resumable = run.active && !run.over;
  const operative = getCharacter(profile.value.lastCharacter);

  const menu = el('div', 'menu');
  if (resumable) {
    menu.append(
      button(
        'CONTINUAR',
        () => {
          ctx.close();
          run.setMenuOpen(false);
        },
        'primary',
      ),
    );
  }
  menu.append(
    button(
      'JUGAR',
      () => {
        ctx.go('character');
      },
      resumable ? '' : 'primary',
    ),
    button('OPERATIVOS', () => ctx.go('character')),
    button('PERFIL', () => ctx.go('profile')),
    button('OPCIONES', () => ctx.go('options')),
  );
  menu.querySelectorAll<HTMLButtonElement>('button').forEach((item, index) => {
    item.setAttribute('aria-label', item.textContent ?? '');
    item.dataset.index = `0${index + 1}`;
    item.classList.add('menu-action');
  });
  menu.querySelector('button')?.setAttribute('data-autofocus', '');

  const logo = el(
    'div',
    'logo',
    el('span', 'title-kicker', 'TRANSMISIÓN CIFRADA / SECTOR 09'),
    el('h1', '', el('span', '', 'BULLET'), el('span', '', 'PUNK')),
    el('p', 'tagline', 'PROTOCOL ZERO'),
    el('p', 'meta', `${profile.value.name} · ${getCharacter(profile.value.lastCharacter).name}`),
  );
  return el('div', 'panel title', cinematicBackdrop(),
    el('div', 'title-layout', logo, el('p', 'title-intro', 'Entra en las sombras. Sal como una leyenda.'), menu),
    el('div', 'title-status', el('span', 'status-signal', 'CANAL SEGURO'), el('span', '', 'INFILTRACIÓN / EXTRACCIÓN / SUPERVIVENCIA')),
    el('div', 'title-scene-label', el('div', 'title-operative', operativeSplash(operative, 'title-portrait', true, profile.lookFor(operative.id))), el('span', '', `OPERATIVO / ${operative.name}`), el('strong', '', 'LA CIUDAD NO DUERME.')),
  );
}
