import { KEY_SNEAK_SCALE, MOVE_DEADZONE } from '../config';
import { TouchControls, type ActionEdges } from './TouchControls';

export type InputMode = 'desktop' | 'touch';

/** One sampled frame of input, identical in shape for both modes. Reused between polls. */
export interface InputState {
  ability: boolean;
  mode: InputMode;
  /** Move vector, length 0..1. Short = sneak. */
  moveX: number;
  moveY: number;
  /** Desktop: pointer position in canvas CSS px. Aim angle is derived by the caller (needs the camera). */
  hasPointer: boolean;
  pointerX: number;
  pointerY: number;
  /** Touch: a deliberate direction from the floating right-hand pad, sampled once. */
  aimDirection: { x: number; y: number } | null;
  fire: boolean;
  /** One-shot actions: true for exactly one poll per press. */
  dash: boolean;
  reload: boolean;
  interact: boolean;
  swap: boolean;
}

const DASH_KEYS = ['Space', 'ShiftLeft', 'ShiftRight'];
const BLOCKED_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Keyboard + mouse and touch behind one `poll()`. Mode follows the last device used: a touch
 * switches to the overlay, a key press or mouse event switches back.
 *
 * Desktop: WASD/arrows move, mouse aims, left click fires, R reload, Space/Shift dash,
 * E interact, Q swap weapon, F ability, hold C to sneak (silent).
 */
export class InputManager {
  private mode: InputMode;
  private readonly host: HTMLElement;
  private readonly touch: TouchControls;
  private readonly keys = new Set<string>();
  private readonly edges: ActionEdges = { dash: false, reload: false, interact: false, swap: false, ability: false };
  /** False while a menu is up: every event is ignored so clicking a button cannot fire the weapon. */
  private active = true;
  private mouseDown = false;
  /** Keep very short clicks until the next fixed step samples input. */
  private firePressed = false;
  private pointerX = 0;
  private pointerY = 0;
  private hasPointer = false;
  private readonly state: InputState = {
    ability: false,
    mode: 'desktop',
    moveX: 0,
    moveY: 0,
    hasPointer: false,
    pointerX: 0,
    pointerY: 0,
    aimDirection: null,
    fire: false,
    dash: false,
    reload: false,
    interact: false,
    swap: false,
  };

  constructor(host: HTMLElement) {
    this.host = host;
    this.touch = new TouchControls(host, this.edges);
    this.mode = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop';
    this.applyMode();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    // Switch modes before the touch overlay receives the first finger, so resetting cannot drop it.
    window.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Available before the first simulation step, including while the deployment menu is open. */
  get inputMode(): InputMode { return this.mode; }

  /** Off while a menu is open (also drops held keys and hides the touch buttons); on to play. */
  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.applyMode();
    } else {
      this.releaseAll();
      this.touch.setVisible(false);
    }
  }

  /** Samples input. Call once per fixed step: one-shot actions are cleared by the call. */
  poll(): InputState {
    const s = this.state;
    s.mode = this.mode;
    if (this.mode === 'touch') this.readTouch(s);
    else this.readDesktop(s);
    s.dash = this.edges.dash;
    s.reload = this.edges.reload;
    s.interact = this.edges.interact;
    s.swap = this.edges.swap;
    s.ability = this.edges.ability;
    this.edges.ability = false;
    this.edges.dash = this.edges.reload = this.edges.interact = this.edges.swap = false;
    return s;
  }

  setAbilityStatus(text: string, ready: boolean, active: boolean): void {
    this.touch.setAbilityStatus(text, ready, active);
  }

  private readDesktop(s: InputState): void {
    const x = this.axis('KeyD', 'ArrowRight') - this.axis('KeyA', 'ArrowLeft');
    const y = this.axis('KeyS', 'ArrowDown') - this.axis('KeyW', 'ArrowUp');
    // Normalize diagonals to length 1, then scale down while sneaking.
    const scale = (this.keys.has('KeyC') ? KEY_SNEAK_SCALE : 1) / Math.max(1, Math.hypot(x, y));
    s.moveX = x * scale;
    s.moveY = y * scale;
    s.hasPointer = this.hasPointer;
    s.pointerX = this.pointerX;
    s.pointerY = this.pointerY;
    s.aimDirection = null;
    s.fire = this.mouseDown || this.firePressed;
    this.firePressed = false;
  }

  private readTouch(s: InputState): void {
    const { move, aim } = this.touch;
    const moveMag = move.magnitude;
    // Rescale so the stick starts at 0 just past the deadzone instead of jumping to MOVE_DEADZONE.
    const k = moveMag < MOVE_DEADZONE ? 0 : (moveMag - MOVE_DEADZONE) / (1 - MOVE_DEADZONE) / moveMag;
    s.moveX = move.x * k;
    s.moveY = move.y * k;
    s.hasPointer = false;

    s.aimDirection = aim.takeDirection();
    s.fire = false; // Target detection in WeaponSystem decides when to fire on mobile.
  }

  private axis(...codes: string[]): number {
    return codes.some((c) => this.keys.has(c)) ? 1 : 0;
  }

  private setMode(mode: InputMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyMode();
  }

  private applyMode(): void {
    this.touch.setVisible(this.mode === 'touch');
    this.releaseAll();
  }

  /** Lets go of every key, button, stick and latched one-shot, so nothing stays stuck after a pause. */
  readonly releaseAll = (): void => {
    this.keys.clear();
    this.mouseDown = false;
    this.firePressed = false;
    this.edges.dash = this.edges.reload = this.edges.interact = this.edges.swap = false;
    this.edges.ability = false;
    this.touch.reset();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    this.setMode('desktop');
    if (BLOCKED_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (DASH_KEYS.includes(e.code)) this.edges.dash = true;
    else if (e.code === 'KeyR') this.edges.reload = true;
    else if (e.code === 'KeyE') this.edges.interact = true;
    else if (e.code === 'KeyQ') this.edges.swap = true;
    else if (e.code === 'KeyF') this.edges.ability = true;
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.active) return;
    if (e.pointerType === 'touch') {
      const switching = this.mode !== 'touch';
      this.setMode('touch');
      if (switching && e.target instanceof Node && this.host.contains(e.target)) this.touch.beginPointer(e);
      return;
    }
    this.setMode('desktop');
    this.trackPointer(e);
    if (e.button === 0) {
      this.mouseDown = true;
      this.firePressed = true;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerType === 'touch') return;
    this.setMode('desktop');
    this.trackPointer(e);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' && e.button === 0) this.mouseDown = false;
  };

  private trackPointer(e: PointerEvent): void {
    const rect = this.host.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
    this.hasPointer = true;
  }
}
