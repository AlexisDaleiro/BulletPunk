export type PauseReason = 'menu' | 'portrait' | 'hidden' | 'checkpoint';

/**
 * Why the game is frozen. A set, not a boolean: rotating a phone back to landscape must not
 * unfreeze a game that a menu is also holding.
 */
export class PauseReasons {
  private readonly reasons = new Set<PauseReason>();

  get paused(): boolean {
    return this.reasons.size > 0;
  }

  has(reason: PauseReason): boolean {
    return this.reasons.has(reason);
  }

  /** Returns true when this call is what froze the game. */
  add(reason: PauseReason): boolean {
    const was = this.paused;
    this.reasons.add(reason);
    return !was;
  }

  /** Returns true when this call is what unfroze the game. */
  delete(reason: PauseReason): boolean {
    const was = this.paused;
    this.reasons.delete(reason);
    return was && !this.paused;
  }
}
