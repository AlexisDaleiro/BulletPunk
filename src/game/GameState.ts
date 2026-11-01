import type { KeyColor } from '../types';

/** Run-wide state that is not an entity: floor, credits, keycards, and what the HUD should say. */
export class GameState {
  floor = 1;
  credits = 0;
  readonly keys: Record<KeyColor, boolean> = { red: false, blue: false, gold: false };
  /** What the nearest interactable offers. `{E}` stands for the interact key or button. Null when nothing is near. */
  prompt: string | null = null;
  /** True while the touch controls are active, so prompts can say HACK instead of E. */
  touch = false;
  toastText = '';
  toastTimer = 0;

  toast(text: string, seconds = 2.4): void {
    this.toastText = text;
    this.toastTimer = seconds;
  }

  tick(dt: number): void {
    this.toastTimer = Math.max(0, this.toastTimer - dt);
  }

  resetKeys(): void {
    this.keys.red = this.keys.blue = this.keys.gold = false;
  }
}
