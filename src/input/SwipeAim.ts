import { TOUCH_TURN_RADIANS } from '../config.ts';

/** Relative horizontal rotation. Lifting preserves pending movement; cancelling discards it. */
export class SwipeAim {
  pointerId: number | null = null;
  private lastX = 0;
  private turn = 0;

  begin(pointerId: number, x: number): void {
    this.pointerId = pointerId;
    this.lastX = x;
  }

  move(x: number, width: number): void {
    this.turn += (x - this.lastX) / Math.max(1, width) * TOUCH_TURN_RADIANS;
    this.lastX = x;
  }

  end(): void { this.pointerId = null; }

  takeTurn(): number {
    const turn = this.turn;
    this.turn = 0;
    return turn;
  }

  reset(): void {
    this.end();
    this.turn = 0;
  }
}
