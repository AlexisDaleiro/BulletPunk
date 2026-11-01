import type { System } from '../ecs/System';
import type { NoiseField } from '../noise/NoiseField';

/** Expands and expires ripples. Rendering (M4) and AI hearing read the field this keeps current. */
export class NoisePropagationSystem implements System {
  private readonly field: NoiseField;

  constructor(field: NoiseField) {
    this.field = field;
  }

  update(_world: unknown, dt: number): void {
    this.field.update(dt);
  }
}
