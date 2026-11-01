import { Graphics } from 'pixi.js';
import type { System } from '../ecs/System';
import type { NoiseField } from '../noise/NoiseField';
import type { RenderSystem } from './RenderSystem';

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

  render(): void {
    this.rings.clear();
    for (const e of this.field.events) {
      this.rings.circle(e.x, e.y, e.currentRadius).stroke({ width: 2.5, color: e.color, alpha: e.intensity });
      this.rings.circle(e.x, e.y, e.currentRadius * 0.6).stroke({ width: 1.5, color: e.color, alpha: e.intensity * 0.5 });
    }
  }
}
