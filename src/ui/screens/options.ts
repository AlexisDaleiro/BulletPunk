import { PIXEL_RATIOS, type PixelRatio } from '../../settings/Settings';
import { button, el, row, toggle } from '../dom';
import type { UiContext } from '../UI';

type Tab = 'sound' | 'graphics' | 'controls';
const TABS: readonly Tab[] = ['sound', 'graphics', 'controls'];
let lastTab: Tab = 'sound';

const RESOLUTION_LABEL: Record<PixelRatio, string> = { 1: 'LOW 1X', 1.5: 'MID 1.5X', 2: 'HIGH 2X' };

/** Read-only: rebinding is out of scope. */
const CONTROLS: readonly [string, string][] = [
  ['MOVE', 'WASD / ARROWS'],
  ['AIM', 'MOUSE'],
  ['FIRE', 'LEFT CLICK'],
  ['RELOAD', 'R'],
  ['DASH', 'SPACE / SHIFT'],
  ['ABILITY', 'F / SKILL (TOUCH)'],
  ['INTERACT', 'E'],
  ['SWAP WEAPON', 'Q'],
  ['SNEAK', 'HOLD C'],
  ['MUTE', 'M'],
  ['PAUSE', 'ESC / P'],
];

/** One screen for both the title and the pause menu. Every control writes straight to the settings. */
export function optionsScreen(ctx: UiContext): HTMLElement {
  const pages: Record<Tab, HTMLElement> = { sound: soundPage(ctx), graphics: graphicsPage(ctx), controls: controlsPage() };
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
    const b = button(tab.toUpperCase(), () => select(tab));
    b.setAttribute('role', 'tab');
    tabButtons.set(tab, b);
    tabs.append(b);
  }
  select(lastTab);
  tabButtons.get(lastTab)?.setAttribute('data-autofocus', '');

  return el('div', 'panel wide', el('h2', 'heading', 'OPTIONS'), tabs, ...TABS.map((t) => pages[t]), button('BACK', ctx.back));
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
  return el('div', 'page', row('VOLUME', slider, readout), row('MUTE', mute.el));
}

function graphicsPage(ctx: UiContext): HTMLElement {
  const { settings } = ctx;
  const seg = el('div', 'seg');
  const resolution = new Map<PixelRatio, HTMLButtonElement>();
  for (const ratio of PIXEL_RATIOS) {
    const b = button(RESOLUTION_LABEL[ratio], () => settings.update({ pixelRatio: ratio }));
    resolution.set(ratio, b);
    seg.append(b);
  }
  const fps = toggle((on) => settings.update({ showFps: on }));
  const antialias = toggle((on) => settings.update({ antialias: on }));
  const reload = el('div', 'row', el('span', 'note', 'ANTIALIAS APPLIES AFTER A RELOAD'), button('RELOAD NOW', () => location.reload()));

  const sync = (): void => {
    const s = settings.value;
    for (const [ratio, b] of resolution) b.setAttribute('aria-pressed', String(ratio === s.pixelRatio));
    fps.set(s.showFps);
    antialias.set(s.antialias);
    reload.hidden = s.antialias === ctx.bootAntialias;
  };
  ctx.cleanup(settings.subscribe(sync));
  sync();
  return el('div', 'page', row('RESOLUTION', seg), row('SHOW FPS', fps.el), row('ANTIALIAS', antialias.el), reload);
}

function controlsPage(): HTMLElement {
  return el('div', 'page controls', ...CONTROLS.map(([action, keys]) => el('div', 'stat', el('span', '', action), el('strong', 'value', keys))));
}
