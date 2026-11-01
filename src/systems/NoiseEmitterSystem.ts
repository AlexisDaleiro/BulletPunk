import { RUN_RIPPLE_INTERVAL } from '../config';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { NoiseField } from '../noise/NoiseField';

/** Running (and dashing) emits a cyan ripple every RUN_RIPPLE_INTERVAL; sneaking and idling stay silent. */
export class NoiseEmitterSystem implements System {
  private readonly field: NoiseField;

  constructor(field: NoiseField) {
    this.field = field;
  }

  update(world: World, dt: number): void {
    world.each(['transform', 'locomotion', 'noiseEmitter'], (entity, t, loc, emitter) => {
      if (loc.gait !== 'RUN') {
        emitter.movementAccumulator = 0;
        return;
      }
      emitter.movementAccumulator += dt;
      if (emitter.movementAccumulator < RUN_RIPPLE_INTERVAL) return;
      emitter.movementAccumulator -= RUN_RIPPLE_INTERVAL;
      const damping = world.get(entity, 'passiveSynergy')?.stats.noiseDampingMult ?? 1;
      this.field.emit('RUN', t.x, t.y, entity, damping);
    });
  }
}
