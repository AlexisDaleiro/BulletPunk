import { PIXEL_RATIOS, type PixelRatio } from '../../settings/Settings';
import { button, el, row, toggle } from '../dom';
import type { UiContext } from '../UI';
import { controlsEditor } from '../ControlsEditor';
import { QUALITY, visualQuality } from '../../render/visualQuality';
import { QUALITY_PRESETS } from '../../settings/Settings';

type Tab = 'sound' | 'graphics' | 'controls';
const TABS: readonly Tab[] = ['sound', 'graphics', 'controls'];
const TAB_LABELS: Record<Tab, string> = { sound: 'SONIDO', graphics: 'GRÁFICOS', controls: 'CONTROLES' };
let lastTab: Tab = 'sound';

const RESOLUTION_LABEL: Record<PixelRatio, string> = { 1: 'BAJA 1X', 1.5: 'MEDIA 1.5X', 2: 'ALTA 2X' };

/** Read-only: rebinding is out of scope. */
const CONTROLS: readonly [string, string][] = [
  ['MOVERSE', 'WASD / FLECHAS'],
  ['APUNTAR', 'MOUSE / PAD DERECHO'],
  ['DISPARAR', 'CLIC / AUTOMÁTICO EN MÓVIL'],
  ['RECARGAR', 'R / RELOAD'],
  ['DASH', 'SPACE / SHIFT'],
  ['HABILIDAD', 'F / SKILL'],
  ['INTERACTUAR', 'E / HACK'],
  ['CAMBIAR ARMA', 'Q / SWAP'],
  ['SIGILO', 'MANTENER C / PAD SUAVE'],
  ['SILENCIAR', 'M'],
  ['PAUSA', 'ESC / P'],
];

/** One screen for both the title and the pause menu. Every control writes straight to the settings. */
export function optionsScreen(ctx: UiContext): HTMLElement {
  const pages: Record<Tab, HTMLElement> = {
    sound: soundPage(ctx),
    graphics: graphicsPage(ctx),
    controls: controlsPage(ctx),
  };
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');

  const select = (tab: Tab): void => {
    lastTab = tab;
    for (const t of TABS) {
      pages[t].hidden = t !== tab;
      tabButtons.get(t)?.setAttribute('aria-selected', String(t === tab));
    }
  };
  for (const tab of TABS) {
    const b = button(TAB_LABELS[tab], () => select(tab));
    b.setAttribute('role', 'tab');
    tabButtons.set(tab, b);
    tabs.append(b);
  }
  select(lastTab);
  tabButtons.get(lastTab)?.setAttribute('data-autofocus', '');

  return el(
    'div',
    'panel wide',
    el('h2', 'heading', 'A TU MANERA'),
    tabs,
    ...TABS.map((t) => pages[t]),
    button('VOLVER', ctx.back),
  );
}

function soundPage(ctx: UiContext): HTMLElement {
  const { settings } = ctx;
  const slider = el('input', 'slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.setAttribute('aria-label', 'Master volume');
  const readout = el('span', 'readout');
  slider.addEventListener('input', () => settings.update({ volume: Number(slider.value) / 100 }));
  const mute = toggle((on) => settings.update({ muted: on }));

  const sync = (): void => {
    const pct = Math.round(settings.value.volume * 100);
    slider.value = String(pct);
    readout.textContent = `${pct}%`;
    mute.set(settings.value.muted);
  };
  ctx.cleanup(settings.subscribe(sync));
  sync();
  return el('div', 'page', row('VOLUMEN', slider, readout), row('SILENCIAR', mute.el));
}

function graphicsPage(ctx: UiContext): HTMLElement {
  const { settings } = ctx;
  const presets = el('div', 'quality-presets');
  const presetButtons = QUALITY_PRESETS.map((p) => {
    const b = button(QUALITY[p].label, () => settings.update({ quality: p, pixelRatio: QUALITY[p].resolution }));
    presets.append(b);
    return [p, b] as const;
  });
  const adaptive = toggle((on) => settings.update({ adaptiveQuality: on }));
  const active = el('p', 'controls-help');
  const showQuality = (): void => {
    active.textContent = `Perfil activo: ${QUALITY[visualQuality.preset].label}${visualQuality.preset !== settings.value.quality ? ' · reducido automáticamente' : ''}.`;
  };
  showQuality();
  window.addEventListener('bulletpunk:quality', showQuality);
  ctx.cleanup(() => window.removeEventListener('bulletpunk:quality', showQuality));
  const seg = el('div', 'seg');
  const resolution = new Map<PixelRatio, HTMLButtonElement>();
  for (const ratio of PIXEL_RATIOS) {
    const b = button(RESOLUTION_LABEL[ratio], () => settings.update({ pixelRatio: ratio }));
    resolution.set(ratio, b);
    seg.append(b);
  }
  const fps = toggle((on) => settings.update({ showFps: on }));
  const antialias = toggle((on) => settings.update({ antialias: on }));
  const reload = el(
    'div',
    'row',
    el('span', 'note', 'EL SUAVIZADO SE APLICA AL RECARGAR'),
    button('RECARGAR', () => location.reload()),
  );

  const sync = (): void => {
    const s = settings.value;
    for (const [p, b] of presetButtons) b.setAttribute('aria-pressed', String(p === s.quality));
    adaptive.set(s.adaptiveQuality);
    for (const [ratio, b] of resolution) b.setAttribute('aria-pressed', String(ratio === s.pixelRatio));
    fps.set(s.showFps);
    antialias.set(s.antialias);
    reload.hidden = s.antialias === ctx.bootAntialias;
  };
  ctx.cleanup(settings.subscribe(sync));
  sync();
  return el(
    'div',
    'page',
    presets,
    active,
    el(
      'p',
      'controls-help',
      'Fluido reduce partículas, vapor y reflejos. Cinemático amplía el detalle. Las señales de peligro se conservan en todos los perfiles.',
    ),
    row('AJUSTE AUTOMÁTICO', adaptive.el),
    el(
      'p',
      'controls-help',
      'Reduce la calidad durante combates exigentes. Podés desactivarlo para mantener el perfil elegido.',
    ),
    row('RESOLUCIÓN MÁXIMA', seg),
    row('MOSTRAR FPS', fps.el),
    row('SUAVIZADO', antialias.el),
    reload,
  );
}

function controlsPage(ctx: UiContext): HTMLElement {
  return el(
    'div',
    'page controls',
    controlsEditor(ctx),
    el(
      'details',
      'keyboard-reference',
      el('summary', '', 'CONTROLES DE TECLADO'),
      ...CONTROLS.map(([action, keys]) => el('div', 'stat', el('span', '', action), el('strong', 'value', keys))),
    ),
  );
}
