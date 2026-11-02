import type { SoundManager } from '../audio/SoundManager';
import { RUN_RIPPLE_INTERVAL } from '../config';
import { abilityModifiers } from '../characters/abilities';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { NoiseField } from '../noise/NoiseField';

/** Running (and dashing) emits a cyan ripple every RUN_RIPPLE_INTERVAL; sneaking and idling stay silent. */
export class NoiseEmitterSystem implements System {
  private readonly field: NoiseField;
  private readonly audio: SoundManager;

  constructor(field: NoiseField, audio: SoundManager) {
    this.field = field;
    this.audio = audio;
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
      const stats = world.get(entity, 'passiveSynergy')?.stats;
      const damping = (stats?.noiseDampingMult ?? 1) * (stats?.movementNoiseMult ?? 1) * abilityModifiers(world.get(entity, 'character')).movementNoiseMult;
      this.field.emit('RUN', t.x, t.y, entity, damping);
      this.audio.playFootstep('METAL', t); // the same step you can see as a ripple, you can hear
    });
  }
}
