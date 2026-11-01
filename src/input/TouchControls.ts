import { AIM_DEADZONE, STICK_RADIUS } from '../config';
import './touch.css';

/** One-shot button presses. Shared with InputManager, which latches keyboard presses into it too. */
export interface ActionEdges {
  dash: boolean;
  reload: boolean;
  interact: boolean;
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
 * DOM overlay for touch play: floating move stick (left half), floating aim stick (right half),
 * and Dash / Reload / Interact buttons. Hidden unless the InputManager is in touch mode.
 */
export class TouchControls {
  readonly move = new Stick('stick-base');
  readonly aim = new Stick('stick-base aim');
  private readonly root = div('touch-ui');
  private readonly edges: ActionEdges;
  private release: { x: number; y: number } | null = null;

  constructor(host: HTMLElement, edges: ActionEdges) {
    this.edges = edges;
    this.root.style.setProperty('--stick-r', `${STICK_RADIUS}px`);
    this.root.append(this.move.base, this.aim.base);
    this.addButton('RELOAD', 'reload', 'reload');
    this.addButton('HACK', 'interact', 'interact');
    this.addButton('DASH', 'dash', 'dash');

    this.root.addEventListener('pointerdown', (e) => {
      const stick = e.clientX < this.root.clientWidth / 2 ? this.move : this.aim;
      if (stick.pointerId !== null) return;
      e.preventDefault();
      this.root.setPointerCapture(e.pointerId);
      stick.begin(e.pointerId, e.clientX, e.clientY);
    });
    this.root.addEventListener('pointermove', (e) => {
      for (const stick of [this.move, this.aim]) {
        if (stick.pointerId === e.pointerId) stick.move(e.clientX, e.clientY);
      }
    });
    const lift = (e: PointerEvent): void => {
      if (this.move.pointerId === e.pointerId) this.move.end();
      if (this.aim.pointerId === e.pointerId) {
        // Releasing a deliberate aim fires one shot along the last aim direction.
        if (this.aim.magnitude >= AIM_DEADZONE) this.release = { x: this.aim.x, y: this.aim.y };
        this.aim.end();
      }
    };
    this.root.addEventListener('pointerup', lift);
    this.root.addEventListener('pointercancel', lift);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    host.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  /** Releases every held control, e.g. when switching input mode. */
  reset(): void {
    this.move.end();
    this.aim.end();
    this.release = null;
  }

  /** The aim vector from a just-released aim stick, once; null if there was none. */
  takeRelease(): { x: number; y: number } | null {
    const r = this.release;
    this.release = null;
    return r;
  }

  private addButton(label: string, className: string, edge: keyof ActionEdges): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-btn ${className}`;
    button.textContent = label;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // keep the root from starting a stick under the button
      this.edges[edge] = true;
      button.classList.add('on');
    });
    const off = (): void => button.classList.remove('on');
    button.addEventListener('pointerup', off);
    button.addEventListener('pointercancel', off);
    button.addEventListener('pointerleave', off);
    this.root.appendChild(button);
  }
}
