import { AIM_PAD_RADIUS, STICK_RADIUS } from '../config';
import { AimPad } from './AimPad';
import './touch.css';

/** One-shot button presses. Shared with InputManager, which latches keyboard presses into it too. */
export interface ActionEdges {
  ability: boolean;
  dash: boolean;
  reload: boolean;
  interact: boolean;
  swap: boolean;
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/** Floating joystick: anchors where the finger lands, reports a vector of length 0..1. */
class Stick {
  pointerId: number | null = null;
  x = 0;
  y = 0;
  readonly base: HTMLDivElement;
  private readonly knob = div('stick-knob');
  private originX = 0;
  private originY = 0;

  constructor(className: string) {
    this.base = div(className);
    this.base.appendChild(this.knob);
  }

  get magnitude(): number {
    return Math.hypot(this.x, this.y);
  }

  begin(pointerId: number, cx: number, cy: number): void {
    this.pointerId = pointerId;
    this.originX = cx;
    this.originY = cy;
    this.x = 0;
    this.y = 0;
    this.base.style.transform = `translate(${cx}px, ${cy}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.add('on');
  }

  move(cx: number, cy: number): void {
    let dx = cx - this.originX;
    let dy = cy - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx *= STICK_RADIUS / len;
      dy *= STICK_RADIUS / len;
    }
    this.x = dx / STICK_RADIUS;
    this.y = dy / STICK_RADIUS;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  end(): void {
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.base.classList.remove('on');
  }
}

/**
 * DOM overlay for touch play: floating move stick (left half), directional aim pad (right half),
 * and Dash / Reload / Interact / Skill buttons. Hidden unless input is in touch mode.
 */
export class TouchControls {
  readonly move = new Stick('stick-base');
  readonly aim = new AimPad();
  private readonly root = div('touch-ui');
  private readonly actions = div('touch-actions');
  private readonly movementActions = div('touch-movement-actions');
  private readonly aimBase = div('aim-pad');
  private readonly aimKnob = div('aim-pad-knob');
  private visible = false;
  private readonly edges: ActionEdges;
  private readonly abilityButton: HTMLButtonElement;

  constructor(host: HTMLElement, edges: ActionEdges) {
    this.edges = edges;
    this.root.style.setProperty('--stick-r', `${STICK_RADIUS}px`);
    this.root.style.setProperty('--aim-r', `${AIM_PAD_RADIUS}px`);
    this.aimBase.append(this.aimKnob);
    this.aimBase.setAttribute('aria-hidden', 'true');
    this.actions.setAttribute('role', 'group');
    this.actions.setAttribute('aria-label', 'Acciones del operativo');
    this.movementActions.setAttribute('role', 'group');
    this.movementActions.setAttribute('aria-label', 'Acciones de movimiento');
    this.root.append(this.move.base, this.aimBase, this.movementActions, this.actions);
    this.addButton('SWAP', 'swap', 'swap');
    this.addButton('RELOAD', 'reload', 'reload');
    this.addButton('HACK', 'interact', 'interact');
    this.addButton('DASH', 'dash', 'dash', this.movementActions);
    this.abilityButton = this.addButton('SKILL', 'ability', 'ability');
    this.abilityButton.setAttribute('aria-label', 'Activar habilidad');

    this.root.addEventListener('pointerdown', this.beginPointer);
    this.root.addEventListener('pointermove', (e) => {
      if (this.move.pointerId === e.pointerId) this.move.move(e.clientX, e.clientY);
      if (this.aim.pointerId === e.pointerId) {
        this.aim.move(e.clientX, e.clientY);
        this.updateAimVisual();
      }
    });
    const lift = (e: PointerEvent): void => {
      if (this.move.pointerId === e.pointerId) this.move.end();
      if (this.aim.pointerId === e.pointerId) {
        // The last pointermove is the deliberate aim; lifting must never add a new direction.
        if (e.type !== 'pointerup') this.aim.reset();
        this.aim.end();
        this.aimBase.classList.remove('on');
      }
    };
    this.root.addEventListener('pointerup', lift);
    this.root.addEventListener('pointercancel', lift);
    this.root.addEventListener('lostpointercapture', lift);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    host.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.reset();
    this.root.style.display = visible ? '' : 'none';
  }

  /** Also accepts the first canvas touch when a hybrid device switches into touch mode. */
  readonly beginPointer = (e: PointerEvent): void => {
    if (!this.visible || e.pointerType !== 'touch') return;
    const left = e.clientX - this.root.getBoundingClientRect().left < this.root.clientWidth / 2;
    const control = left ? this.move : this.aim;
    if (control.pointerId !== null) return;
    e.preventDefault();
    this.root.setPointerCapture(e.pointerId);
    if (left) this.move.begin(e.pointerId, e.clientX, e.clientY);
    else {
      this.aim.begin(e.pointerId, e.clientX, e.clientY);
      this.aimBase.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.aimBase.classList.add('on');
      this.updateAimVisual();
    }
  };

  private updateAimVisual(): void {
    this.aimKnob.style.transform = `translate(${this.aim.x * AIM_PAD_RADIUS}px, ${this.aim.y * AIM_PAD_RADIUS}px)`;
  }

  setAbilityStatus(text: string, ready: boolean, active: boolean): void {
    if (this.abilityButton.textContent !== text) this.abilityButton.textContent = text;
    this.abilityButton.setAttribute('aria-disabled', String(!ready));
    this.abilityButton.classList.toggle('active', active);
  }

  /** Releases every held control, e.g. when switching input mode. */
  reset(): void {
    const pointers = [this.move.pointerId, this.aim.pointerId];
    this.move.end();
    this.aim.reset();
    this.aimBase.classList.remove('on');
    for (const id of pointers) if (id !== null && this.root.hasPointerCapture(id)) this.root.releasePointerCapture(id);
    this.root.querySelectorAll('.touch-btn.on').forEach((button) => button.classList.remove('on'));
  }

  private addButton(label: string, className: string, edge: keyof ActionEdges, group = this.actions): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-btn ${className}`;
    button.textContent = label;
    button.setAttribute('aria-label', { swap: 'Cambiar arma', reload: 'Recargar', interact: 'Interactuar', dash: 'Impulso', ability: 'Activar habilidad' }[edge]);
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // keep the root from starting a stick under the button
      this.edges[edge] = true;
      button.setPointerCapture(e.pointerId);
      button.classList.add('on');
    });
    const off = (): void => button.classList.remove('on');
    button.addEventListener('pointerup', off);
    button.addEventListener('pointercancel', off);
    button.addEventListener('lostpointercapture', off);
    button.addEventListener('pointerleave', off);
    group.appendChild(button);
    return button;
  }
}
