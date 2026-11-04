import type { Entity } from '../ecs/World';
import type { NoiseEvent } from '../types';
// `.ts` extension: Node's test runner needs it for runtime imports (type imports are erased).
import { NOISE_PROFILES, NOISE_START_RADIUS, type NoiseKind } from '../config.ts';

/** Live acoustic ripples. Emitters add to it, NoisePropagationSystem steps it, M4 renders and AI hears it. */
export class NoiseField {
  readonly events: NoiseEvent[] = [];
  private nextId = 0;

  /** `radiusMult` below 1 shrinks the ripple (noise damping passives). */
  emit(kind: NoiseKind, x: number, y: number, source: Entity, radiusMult = 1): NoiseEvent {
    const profile = NOISE_PROFILES[kind];
    const maxRadius = Math.max(NOISE_START_RADIUS + 1, profile.maxRadius * radiusMult);
    const event: NoiseEvent = {
      kind,
      id: `noise-${this.nextId++}`,
      x,
      y,
      currentRadius: NOISE_START_RADIUS,
      maxRadius,
      expansionSpeed: (maxRadius - NOISE_START_RADIUS) / profile.duration,
      intensity: 1,
      color: profile.color,
      sourceEntityId: String(source),
    };
    this.events.push(event);
    return event;
  }

  /** Grows every ripple, fades its intensity to 0 at max radius, and drops finished ones. */
  update(dt: number): void {
    for (let i = this.events.length; i-- > 0; ) {
      const e = this.events[i];
      e.currentRadius += e.expansionSpeed * dt;
      if (e.currentRadius >= e.maxRadius) {
        const last = this.events.pop() as NoiseEvent;
        if (i < this.events.length) this.events[i] = last;
        continue;
      }
      e.intensity = 1 - (e.currentRadius - NOISE_START_RADIUS) / (e.maxRadius - NOISE_START_RADIUS);
    }
  }
}
