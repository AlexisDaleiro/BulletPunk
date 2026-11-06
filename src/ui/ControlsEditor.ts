import { DEFAULT_SETTINGS, TOUCH_ACTIONS, type TouchAction } from '../settings/Settings';
import { touchLayout } from '../input/touchLayout';
import type { UiContext } from './UI';
import { button, el, row, toggle } from './dom';

export function controlsEditor(ctx: UiContext): HTMLElement {
  const { settings } = ctx,
    preview = el('div', 'controls-preview');
  preview.setAttribute('aria-label', 'Editor de botones táctiles');
  const move = el('span', 'preview-pad', 'MOVER'),
    aim = el('span', 'preview-pad preview-aim', 'APUNTAR 360°');
  const instructions = el(
    'p',
    'controls-help',
    'Arrastrá cada botón. También podés seleccionarlo y usar las flechas. Los cambios se guardan en este dispositivo.',
  );
  const closeEditor = button(
    'LISTO ✓',
    () => {
      preview.classList.remove('expanded');
      preview.setAttribute('role', 'group');
      preview.removeAttribute('aria-modal');
      closeEditor.hidden = true;
      sync();
      expand.focus();
    },
    'editor-close',
  );
  closeEditor.hidden = true;
  const expand = button(
    'EDITAR A PANTALLA COMPLETA ↗',
    () => {
      preview.classList.add('expanded');
      preview.setAttribute('role', 'dialog');
      preview.setAttribute('aria-modal', 'true');
      closeEditor.hidden = false;
      sync();
      closeEditor.focus();
    },
    'editor-expand',
  );
  preview.append(move, aim, closeEditor);
  const buttons = new Map<TouchAction, HTMLButtonElement>();
  const labels = { swap: 'SWAP', reload: 'RELOAD', interact: 'HACK', dash: 'DASH', ability: 'SKILL' };
  const place = (action: TouchAction, x: number, y: number): void => {
    settings.update({
      touchPositions: {
        ...settings.value.touchPositions,
        [action]: { x: settings.value.touchLeftHanded ? 1 - x : x, y },
      },
    });
  };
  for (const action of TOUCH_ACTIONS) {
    const b = button(labels[action], () => {}, `preview-action ${action}`);
    b.setAttribute('aria-label', `Mover botón ${labels[action]}`);
    let dragging = false;
    const drag = (e: PointerEvent): void => {
      const r = preview.getBoundingClientRect();
      place(
        action,
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      );
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      b.setPointerCapture(e.pointerId);
      b.focus();
    });
    b.addEventListener('pointermove', (e) => {
      if (dragging) drag(e);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      b.addEventListener(event, () => {
        dragging = false;
      });
    b.addEventListener('keydown', (e) => {
      const delta = (
        { ArrowLeft: [-0.015, 0], ArrowRight: [0.015, 0], ArrowUp: [0, -0.025], ArrowDown: [0, 0.025] } as Record<
          string,
          number[]
        >
      )[e.key];
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      const r = preview.getBoundingClientRect(),
        p = touchLayout(r.width, r.height, settings.value)[action];
      place(action, p.x / r.width + delta[0], p.y / r.height + delta[1]);
    });
    buttons.set(action, b);
    preview.append(b);
  }
  const sync = (): void => {
    const r = preview.getBoundingClientRect();
    if (!r.width) return;
    const layout = touchLayout(r.width, r.height, settings.value);
    for (const [action, b] of buttons) {
      const p = layout[action];
      Object.assign(b.style, {
        left: `${p.x}px`,
        top: `${p.y}px`,
        width: `${p.width}px`,
        height: `${p.height}px`,
        opacity: String(settings.value.touchOpacity),
      });
    }
    move.style.left = settings.value.touchLeftHanded ? '76%' : '20%';
    aim.style.left = settings.value.touchLeftHanded ? '20%' : '76%';
  };
  preview.addEventListener('keydown', (e) => {
    if (!preview.classList.contains('expanded')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeEditor.click();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const list = [closeEditor, ...buttons.values()],
        at = list.indexOf(document.activeElement as HTMLButtonElement);
      list[(at + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
    }
  });
  const observer = new ResizeObserver(sync);
  observer.observe(preview);
  ctx.cleanup(() => observer.disconnect());
  ctx.cleanup(settings.subscribe(sync));
  const slider = (
    label: string,
    key: 'touchScale' | 'touchOpacity' | 'aimDeadzone',
    min: number,
    max: number,
    step: number,
  ): HTMLElement => {
    const input = el('input', 'slider'),
      value = el('span', 'readout');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => settings.update({ [key]: Number(input.value) }));
    const update = (): void => {
      input.value = String(settings.value[key]);
      value.textContent =
        key === 'aimDeadzone' ? `${Math.round(settings.value[key])} PX` : `${Math.round(settings.value[key] * 100)}%`;
    };
    update();
    ctx.cleanup(settings.subscribe(update));
    return row(label, input, value);
  };
  const left = toggle((on) => settings.update({ touchLeftHanded: on }));
  left.set(settings.value.touchLeftHanded);
  ctx.cleanup(settings.subscribe((s) => left.set(s.touchLeftHanded)));
  const message = el('p', 'controls-help');
  const practice = button(
    'ENTRAR A LA SALA DE PRÁCTICA ↗',
    () => {
      practice.disabled = true;
      void ctx
        .startPractice()
        .catch((e) => {
          message.textContent = e instanceof Error ? e.message : 'No se pudo abrir la práctica.';
        })
        .finally(() => (practice.disabled = false));
    },
    'primary',
  );
  return el(
    'section',
    'controls-custom',
    instructions,
    expand,
    preview,
    row('MODO ZURDO', left.el),
    slider('TAMAÑO DE BOTONES', 'touchScale', 0.85, 1.4, 0.05),
    slider('OPACIDAD', 'touchOpacity', 0.35, 1, 0.05),
    slider('ZONA MUERTA DEL APUNTADO', 'aimDeadzone', 3, 24, 1),
    el(
      'div',
      'actions',
      button('RESTABLECER CONTROLES', () =>
        settings.update({
          touchScale: DEFAULT_SETTINGS.touchScale,
          touchOpacity: DEFAULT_SETTINGS.touchOpacity,
          touchLeftHanded: false,
          aimDeadzone: 10,
          touchPositions: {},
        }),
      ),
      practice,
    ),
    el(
      'p',
      'controls-help',
      'Práctica libre: todas las armas, blancos que se regeneran y habilidades. Tu incursión queda guardada; no otorga XP ni estadísticas.',
    ),
    message,
  );
}
