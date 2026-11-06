import { COSMETICS, DEFAULT_UNLOCKS } from '../../profile/cosmetics';
import { button, el } from '../dom';
import { menuIcon, metric, menuBrand } from '../menuChrome';
import type { UiContext } from '../UI';
import { refugeBackdrop, refugeScene, checkpointCard } from '../Refuge';
import { syncLabel } from '../syncLabel';

export function titleScreen(ctx: UiContext): HTMLElement {
  const { run, profile } = ctx;
  const resumable = (run.active && !run.over) || ctx.saves.hasSaved;
  const identity = button('', () => ctx.go('account'), 'lobby-identity');
  identity.setAttribute('aria-label', 'Mi cuenta');
  const accountLabel = el('small', '', ctx.accounts.isGuest ? 'ENTRAR / CREAR CUENTA' : 'CUENTA CONECTADA');
  identity.append(
    el('span', 'identity-avatar', profile.value.name.slice(0, 2)),
    el('span', 'identity-copy', el('strong', '', profile.value.name), accountLabel),
    menuIcon('arrow'),
  );

  const play = button(
    '',
    () => {
      if (run.active && !run.over) {
        void ctx.saves.continueLive();
      } else if (ctx.saves.hasSaved) {
        void ctx.saves.resume();
      } else ctx.go('character');
    },
    'primary lobby-play',
  );
  play.setAttribute('aria-label', resumable ? 'CONTINUAR' : 'JUGAR');
  play.setAttribute('data-autofocus', '');
  play.disabled = !ctx.accounts.canPlay || ['loading', 'saving'].includes(ctx.saves.status);
  play.append(
    menuIcon('play'),
    el(
      'span',
      '',
      el('small', '', resumable ? 'TU INCURSIÓN TE ESPERA' : 'TU PRÓXIMA HISTORIA EMPIEZA ACÁ'),
      el('strong', '', resumable ? 'CONTINUAR' : 'JUGAR'),
    ),
    menuIcon('arrow'),
  );

  const nav = el('nav', 'lobby-nav');
  nav.setAttribute('aria-label', 'Menú principal');
  for (const [label, detail, icon, screen] of [
    ['OPERATIVOS', 'Elegí tu estilo', 'operatives', 'character'],
    ['PERFIL', 'Tu trayectoria', 'profile', 'profile'],
    ['OPCIONES', 'A tu manera', 'settings', 'options'],
  ] as const) {
    const item = button('', () => ctx.go(screen), 'lobby-nav-item');
    item.setAttribute('aria-label', label);
    item.append(menuIcon(icon), el('span', '', el('strong', '', label), el('small', '', detail)));
    nav.append(item);
  }

  const feature = refugeScene(ctx);
  const unlocked = profile.value.cosmetics.unlocked.length - DEFAULT_UNLOCKS.length;
  const sync = el('span', '', syncLabel(ctx.accounts));
  const checkpoint = el('p', 'checkpoint-status', ctx.saves.label());
  checkpoint.setAttribute('aria-live', 'polite');
  const deployActions = el(
    'div',
    'lobby-deploy',
    play,
    ...(resumable ? [button('NUEVA INCURSIÓN', () => ctx.go('character'), 'lobby-new-run')] : []),
    checkpoint,
  );
  if (ctx.saves.status === 'busy')
    deployActions.append(
      button('CONTINUAR AQUÍ Y CERRAR LA OTRA SESIÓN', () => void ctx.saves.resume(true), 'checkpoint-takeover'),
    );
  if (ctx.saves.status === 'conflict')
    deployActions.append(
      button('CONTINUAR DESDE EL SERVIDOR', () => void ctx.saves.resume(false, true), 'checkpoint-takeover'),
    );
  ctx.cleanup(
    ctx.saves.subscribe(() => {
      checkpoint.textContent = ctx.saves.label();
      play.disabled =
        !ctx.accounts.canPlay ||
        ['loading', 'saving'].includes(ctx.saves.status) ||
        (ctx.saves.hasSaved && !ctx.saves.canResume);
    }),
  );
  ctx.cleanup(
    ctx.accounts.subscribe(() => {
      sync.textContent = syncLabel(ctx.accounts);
      play.disabled = !ctx.accounts.canPlay || ['loading', 'saving'].includes(ctx.saves.status);
    }),
  );
  return el(
    'div',
    'panel title lobby refuge',
    refugeBackdrop(),
    el('header', 'lobby-header', menuBrand(), el('span', 'lobby-location', 'REFUGIO 09 / CANAL SEGURO'), identity),
    el(
      'main',
      'lobby-main',
      el(
        'section',
        'lobby-welcome',
        el('span', 'menu-eyebrow lobby-transmission', 'PROTOCOL ZERO · LA SEÑAL SIGUE VIVA'),
        el('h1', 'lobby-headline', 'VOLVÉ A', el('br'), el('span', '', 'LA SOMBRA.')),
        el('p', 'lobby-description', 'Revisá tu equipo. Dejá tu huella. Volvé para contarlo.'),
        deployActions,
        checkpointCard(ctx),
        nav,
        button('SALA DE PRÁCTICA ↗', () => void ctx.startPractice(), 'refuge-practice'),
        el(
          'div',
          'lobby-record',
          metric('INCURSIONES', profile.value.stats.runs),
          metric('MEJOR PISO', profile.value.stats.bestFloor),
          metric('ESTILOS', `${unlocked}/${COSMETICS.length - DEFAULT_UNLOCKS.length}`),
        ),
      ),
      feature,
    ),
    el('footer', 'lobby-footer', el('span', 'status-signal', 'CADA INCURSIÓN DEJA UNA HISTORIA'), sync),
  );
}
