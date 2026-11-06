import { ABILITY_UPGRADES } from '../../characters/upgrades';
import { button, confirmButton, copyButton, el } from '../dom';
import { formatDuration, seedUrl } from '../format';
import { menuIcon, metric } from '../menuChrome';
import { operativeSplash } from '../splash';
import type { UiContext } from '../UI';
import { syncLabel } from '../syncLabel';
import { WEAPONS } from '../../combat/weapons';

export function pauseScreen(ctx: UiContext): HTMLElement {
  const { run } = ctx;
  if (run.practice) {
    const select = el('select', 'practice-weapons');
    select.setAttribute('aria-label', 'Arma de práctica');
    for (const weapon of Object.values(WEAPONS)) {
      const option = el('option', '', weapon.name);
      option.value = weapon.id;
      select.append(option);
    }
    select.value = run.equippedWeaponId;
    select.addEventListener('change', () => run.selectPracticeWeapon(select.value));
    return el(
      'div',
      'panel wide practice-panel',
      el('span', 'menu-eyebrow', 'CAMPO DE PRUEBAS / SIN RIESGO'),
      el('h2', 'heading', 'PRÁCTICA EN PAUSA'),
      el(
        'p',
        'controls-help',
        'Probá el pad, el dash y todas las armas contra blancos regenerables. Las habilidades se recuperan en 2 segundos. Tu incursión guardada sigue disponible.',
      ),
      select,
      button('VOLVER A LA PRÁCTICA', ctx.resume, 'primary'),
      button('AJUSTAR CONTROLES', () => ctx.go('options')),
      button('REINICIAR PRÁCTICA', () => {
        ctx.close();
        run.restartRun();
      }),
      button('SALIR DE PRÁCTICA', () => {
        run.quitToMenu();
        ctx.open('title');
      }),
    );
  }
  const info = run.snapshot();
  const operative = run.character;
  const resume = button('', ctx.resume, 'primary pause-resume');
  resume.append(menuIcon('play'), el('span', '', 'VOLVER AL JUEGO'), menuIcon('arrow'));
  resume.setAttribute('data-autofocus', '');
  const restart = confirmButton(
    'REINICIAR INCURSIÓN',
    '¿REINICIAR? TOCÁ OTRA VEZ',
    () => {
      if (!ctx.accounts.canPlay) {
        ctx.go('account');
        return;
      }
      ctx.close();
      run.restartRun();
    },
    'pause-restart',
  );
  const leave = confirmButton(
    'VOLVER AL INICIO',
    '¿ABANDONAR? TOCÁ OTRA VEZ',
    () => {
      run.quitToMenu();
      ctx.open('title');
    },
    'danger pause-leave',
  );
  const note = el('p', 'pause-session-note', ctx.saves.label());
  note.setAttribute('aria-live', 'polite');
  const saveExit = button(
    'GUARDAR Y SALIR',
    () => {
      saveExit.disabled = true;
      void ctx.saves
        .suspend()
        .then(() => ctx.open('title'))
        .catch((error) => {
          note.textContent = error instanceof Error ? error.message : 'No se pudo guardar.';
        })
        .finally(() => {
          saveExit.disabled = false;
        });
    },
    'pause-save',
  );
  ctx.cleanup(
    ctx.saves.subscribe(() => {
      note.textContent = ctx.saves.label();
    }),
  );
  const chips = el('div', 'pause-upgrade-chips');
  for (const id of info.upgrades) {
    const upgrade = ABILITY_UPGRADES.find((u) => u.id === id);
    chips.append(el('span', 'pause-upgrade-chip', el('b', '', upgrade?.glyph ?? '◇'), upgrade?.name ?? id));
  }
  if (!info.upgrades.length) chips.append(el('p', 'pause-empty', 'Ganá experiencia para elegir tu primera evolución.'));
  const portrait = el(
    'div',
    'pause-portrait',
    operativeSplash(operative, 'pause-splash', true),
    el(
      'div',
      'pause-portrait-label',
      el('span', 'menu-eyebrow', operative.role),
      el('strong', '', operative.name),
      el('small', '', operative.ability.name),
    ),
  );
  portrait.style.setProperty('--operative-color', `#${operative.color.toString(16).padStart(6, '0')}`);

  const saveStatus = el('span', 'pause-footer-hint', syncLabel(ctx.accounts));
  ctx.cleanup(
    ctx.accounts.subscribe(() => {
      saveStatus.textContent = syncLabel(ctx.accounts);
    }),
  );
  return el(
    'div',
    'panel pause pause-command',
    el(
      'header',
      'pause-header',
      el('div', '', el('span', 'menu-eyebrow', 'UN RESPIRO ENTRE DISPAROS'), el('h2', '', 'EN PAUSA')),
      el('span', 'pause-status', el('i'), 'INCURSIÓN DETENIDA'),
    ),
    el(
      'div',
      'pause-body',
      portrait,
      el(
        'section',
        'pause-brief',
        el(
          'div',
          'pause-metrics',
          metric('PISO ACTUAL', String(info.floor).padStart(2, '0')),
          metric('ELIMINACIONES', info.kills),
          metric('CRÉDITOS', info.credits),
          metric('TIEMPO', formatDuration(info.timeSec)),
        ),
        el(
          'div',
          'pause-xp',
          el('strong', '', `NIVEL ${info.experienceLevel}`),
          el('span', '', `${info.experience} XP OBTENIDA`),
        ),
        el(
          'div',
          'pause-loadout',
          el('span', 'menu-eyebrow', `EVOLUCIONES / ${info.upgrades.length}`),
          chips,
          el('span', 'menu-eyebrow', 'IMPLANTES'),
          el('p', 'pause-implants', info.implants.join(' · ') || 'Sin implantes instalados.'),
        ),
      ),
      el(
        'nav',
        'pause-actions',
        resume,
        button('OPCIONES', () => ctx.go('options')),
        saveExit,
        el('div', 'pause-action-divider'),
        restart,
        leave,
        note,
      ),
    ),
    el(
      'footer',
      'pause-footer',
      el('span', '', `SEÑAL #${info.seed}`),
      copyButton('COPIAR INCURSIÓN', () => seedUrl(location.href, info.seed)),
      saveStatus,
    ),
  );
}
