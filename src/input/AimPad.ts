import { AIM_PAD_DEADZONE, AIM_PAD_RADIUS } from '../config.ts';

export interface AimDirection { x: number; y: number }

/** Floating 360° pad. A tap keeps the previous heading; a deliberate drag queues a heading. */
export class AimPad {
  pointerId: number | null = null;
  x = 0;
  y = 0;
  private originX = 0;
  private originY = 0;
  private pending: AimDirection | null = null;

  begin(pointerId: number, x: number, y: number): void {
    this.pointerId = pointerId;
    this.originX = x;
    this.originY = y;
    this.x = this.y = 0;
  }

  move(x: number, y: number): void {
    if (this.pointerId === null) return;
    const dx = x - this.originX, dy = y - this.originY;
    const distance = Math.hypot(dx, dy);
    const scale = 1 / Math.max(AIM_PAD_RADIUS, distance);
    this.x = dx * scale;
    this.y = dy * scale;
    if (distance >= AIM_PAD_DEADZONE) this.pending = { x: dx / distance, y: dy / distance };
  }

  /** Lifting does not discard a quick drag that happened between simulation steps. */
  end(): void {
    this.pointerId = null;
    this.x = this.y = 0;
  }

  takeDirection(): AimDirection | null {
    const direction = this.pending;
    this.pending = null;
    return direction;
  }

  reset(): void {
    this.end();
    this.pending = null;
  }
}
