import { getCharacter } from '../../characters/characters';
import { button, el } from '../dom';
import type { UiContext } from '../UI';

export function titleScreen(ctx: UiContext): HTMLElement {
  const { run, profile } = ctx;
  const resumable = run.active && !run.over;

  const menu = el('div', 'menu');
  if (resumable) {
    menu.append(
      button(
        'CONTINUE',
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
      'PLAY',
      () => {
        ctx.close();
        run.startRun(profile.value.lastCharacter, ctx.takeSeed());
      },
      resumable ? '' : 'primary',
    ),
    button('OPERATIVE', () => ctx.go('character')),
    button('PROFILE', () => ctx.go('profile')),
    button('OPTIONS', () => ctx.go('options')),
  );
  menu.querySelector('button')?.setAttribute('data-autofocus', '');

  const logo = el(
    'div',
    'logo',
    el('h1', '', 'CYBER-ECHO'),
    el('p', 'tagline', 'PROTOCOL ZERO'),
    el('p', 'meta', `${profile.value.name} · ${getCharacter(profile.value.lastCharacter).name}`),
  );
  return el('div', 'panel title', logo, menu);
}
