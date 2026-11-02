import { Graphics } from 'pixi.js';
import type { System } from '../ecs/System';
import type { NoiseField } from '../noise/NoiseField';
import type { RenderSystem } from './RenderSystem';
import type { World } from '../ecs/World';

/**
 * Draws every live noise ripple as expanding rings, fading with intensity. They sit above the fog
 * layer and ignore walls, so sound gives radar awareness of what the vision cone can not see.
 */
export class RippleRenderSystem implements System {
  private readonly renderer: RenderSystem;
  private readonly field: NoiseField;
  private readonly rings = new Graphics();

  constructor(renderer: RenderSystem, field: NoiseField) {
    this.renderer = renderer;
    this.field = field;
  }

  init(): void {
    this.rings.blendMode = 'add';
    this.renderer.layers.ripples.addChild(this.rings);
  }

  render(_world: World): void {
    this.rings.clear();
    for (const e of this.field.events) {
      const own = e.sourceEntityId === String(this.renderer.cameraTarget);
      const color = e.color === '#ff0055' ? 0xe49a8c : e.color === '#00e5ff' ? 0x8bb7c3 : 0xd7c49a;
      this.rings.circle(e.x, e.y, e.currentRadius).stroke({ width: 1, color, alpha: e.intensity * (own ? 0.18 : 0.42) });
    }
  }
}
