import type { ProfileStore } from '../profile/ProfileStore';
import type { RunController, RunInfo } from '../run/RunController';
import type { SettingsStore } from '../settings/SettingsStore';
import { button, el } from './dom';
import { characterScreen } from './screens/character';
import { gameOverScreen } from './screens/gameover';
import { optionsScreen } from './screens/options';
import { pauseScreen } from './screens/pause';
import { profileScreen } from './screens/profile';
import { titleScreen } from './screens/title';
import './ui.css';
import './art-direction.css';

export type ScreenName = 'title' | 'character' | 'profile' | 'options' | 'pause' | 'gameover';

export interface UiDeps {
  run: RunController;
  settings: SettingsStore;
  profile: ProfileStore;
  /** The antialias value the renderer actually started with (changing the setting needs a reload). */
  bootAntialias: boolean;
  /** The `?seed=` of the page, handed out once to the first run. */
  takeSeed: () => number | undefined;
}

/** What a screen can do: navigate, close the overlay, and register cleanup for when it goes away. */
export interface UiContext extends UiDeps {
  /** The final numbers of the run that just ended; read by the game-over screen. */
  gameOver: RunInfo | null;
  /** Shows a fresh root screen (nothing to go back to). */
  open(name: ScreenName): void;
  go(name: ScreenName): void;
  back(): void;
  close(): void;
  /** Closes the pause menu and plays on. */
  resume(): void;
  cleanup(fn: () => void): void;
}

const SCREENS: Record<ScreenName, (ctx: UiContext) => HTMLElement> = {
  title: titleScreen,
  character: characterScreen,
  profile: profileScreen,
  options: optionsScreen,
  pause: pauseScreen,
  gameover: gameOverScreen,
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';
const STEP: Record<string, 1 | -1> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };

/**
 * The menu overlay: one DOM layer above the canvas with a tiny screen stack. Keys and clicks on it
 * never reach the game because the InputManager is switched off while it is open. It also owns the
 * ways into the pause menu: Esc or P, losing focus, a hidden tab, and the touch button.
 */
export class UI {
  private readonly root = el('div', 'ui');
  private readonly pauseButton = button('II', () => this.openPause(), 'pause-btn');
  private readonly deps: UiDeps;
  private readonly ctx: UiContext;
  private stack: ScreenName[] = [];
  private current: ScreenName | null = null;
  private cleanups: (() => void)[] = [];

  constructor(deps: UiDeps) {
    this.deps = deps;
    this.ctx = {
      ...deps,
      gameOver: null,
      open: (name) => this.open(name),
      go: (name) => this.go(name),
      back: () => this.back(),
      close: () => this.close(),
      resume: () => this.resume(),
      cleanup: (fn) => void this.cleanups.push(fn),
    };
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.hidden = true;
    document.body.append(this.root, this.pauseButton);

    deps.run.onChange = () => this.syncPauseButton();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('blur', () => this.openPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.openPause();
    });
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  /** Shows `name` as a fresh root screen. The title sits on a solid backdrop; the rest dim the frozen game. */
  open(name: ScreenName): void {
    this.stack = [];
    this.root.dataset.backdrop = name === 'title' ? 'solid' : 'dim';
    this.render(name);
  }

  close(): void {
    this.runCleanups();
    this.root.classList.remove('open');
    this.root.replaceChildren();
    this.current = null;
    this.stack = [];
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.syncPauseButton();
  }

  /** Freezes the run and shows the pause menu. Does nothing unless a run is being played. */
  openPause(): void {
    const { run } = this.deps;
    if (!run.active || run.over || this.isOpen) return;
    run.setMenuOpen(true);
    this.open('pause');
  }

  openGameOver(info: RunInfo): void {
    this.ctx.gameOver = info;
    this.open('gameover');
  }

  private resume(): void {
    this.close();
    this.deps.run.setMenuOpen(false);
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
    this.root.dataset.screen = name;
    this.root.replaceChildren(SCREENS[name](this.ctx));
    this.root.classList.add('open');
    this.current = name;
    this.syncPauseButton();
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

  /** The touch pause button shows only while a run is being played with no menu up. */
  private syncPauseButton(): void {
    const { run } = this.deps;
    this.pauseButton.hidden = !(run.active && !run.over && !this.isOpen);
  }

  /** Esc goes back one screen, or resumes from the pause menu's first page. */
  private escape(): void {
    if (this.stack.length > 0) this.back();
    else if (this.current === 'pause') this.resume();
  }

  /** Esc or P toggles the pause; arrows move focus (left/right stay native inside sliders and text fields). */
  private readonly onKey = (e: KeyboardEvent): void => {
    const typing = e.target instanceof HTMLInputElement;
    if (!this.isOpen) {
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && !typing) this.openPause();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.escape();
      return;
    }
    if (e.code === 'KeyP' && !e.repeat && !typing) {
      if (this.current === 'pause' && this.stack.length === 0) this.resume();
      return;
    }
    const step = STEP[e.key];
    if (!step) return;
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    const list = this.focusables();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + step + list.length) % list.length].focus({ preventScroll: true });
  };
}
