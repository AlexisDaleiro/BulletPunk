import type { Renderer } from 'pixi.js';
import type { ProfileStore } from '../profile/ProfileStore';
import type { RunController } from '../run/RunController';
import type { SettingsStore } from '../settings/SettingsStore';
import { el } from './dom';
import { characterScreen } from './screens/character';
import { optionsScreen } from './screens/options';
import { profileScreen } from './screens/profile';
import { titleScreen } from './screens/title';
import './ui.css';

export type ScreenName = 'title' | 'character' | 'profile' | 'options';

export interface UiDeps {
  run: RunController;
  settings: SettingsStore;
  profile: ProfileStore;
  renderer: Renderer;
  /** The antialias value the renderer actually started with (changing the setting needs a reload). */
  bootAntialias: boolean;
  /** The `?seed=` of the page, handed out once to the first run. */
  takeSeed: () => number | undefined;
}

/** What a screen can do: navigate, close the overlay, and register cleanup for when it goes away. */
export interface UiContext extends UiDeps {
  go(name: ScreenName): void;
  back(): void;
  close(): void;
  cleanup(fn: () => void): void;
}

const SCREENS: Record<ScreenName, (ctx: UiContext) => HTMLElement> = {
  title: titleScreen,
  character: characterScreen,
  profile: profileScreen,
  options: optionsScreen,
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';
const STEP: Record<string, 1 | -1> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };

/**
 * The menu overlay: one DOM layer above the canvas with a tiny screen stack. Keys and clicks on it
 * never reach the game because the InputManager is switched off while it is open.
 */
export class UI {
  private readonly root = el('div', 'ui');
  private readonly ctx: UiContext;
  private stack: ScreenName[] = [];
  private current: ScreenName | null = null;
  private cleanups: (() => void)[] = [];

  constructor(deps: UiDeps) {
    this.ctx = {
      ...deps,
      go: (name) => this.go(name),
      back: () => this.back(),
      close: () => this.close(),
      cleanup: (fn) => void this.cleanups.push(fn),
    };
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    document.body.appendChild(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  /** Shows `name` as a fresh root screen (nothing to go back to). */
  open(name: ScreenName): void {
    this.stack = [];
    this.root.dataset.backdrop = 'solid';
    this.render(name);
  }

  close(): void {
    this.runCleanups();
    this.root.classList.remove('open');
    this.root.replaceChildren();
    this.current = null;
    this.stack = [];
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  private go(name: ScreenName): void {
    if (this.current) this.stack.push(this.current);
    this.render(name);
  }

  private back(): void {
    const previous = this.stack.pop();
    if (previous) this.render(previous);
  }

  private render(name: ScreenName): void {
    this.runCleanups();
    this.root.replaceChildren(SCREENS[name](this.ctx));
    this.root.classList.add('open');
    this.current = name;
    const first = this.root.querySelector<HTMLElement>('[data-autofocus]') ?? this.focusables()[0];
    first?.focus({ preventScroll: true });
  }

  private runCleanups(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }

  private focusables(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => !e.closest('[hidden]'));
  }

  /** Escape goes back one screen; arrows move focus (left/right stay native inside sliders and text fields). */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.back();
      return;
    }
    const step = STEP[e.key];
    if (!step) return;
    const target = e.target;
    if (target instanceof HTMLInputElement && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    const list = this.focusables();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + step + list.length) % list.length].focus({ preventScroll: true });
  };
}
