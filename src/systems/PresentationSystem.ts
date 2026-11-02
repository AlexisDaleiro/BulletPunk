import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { HostileGraphic } from '../characters/HostileGraphic';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { PickupGraphic } from '../render/PickupGraphic';
import type { RenderSystem } from './RenderSystem';

/** Visual motion has no effect on collision boxes, hearing or combat timing. */
export class PresentationSystem implements System {
  private readonly renderer: RenderSystem;
  private readonly motes = new Container();
  private time = 0;

  constructor(renderer: RenderSystem) { this.renderer = renderer; }

  init(): void {
    const shape = new GraphicsContext().circle(0, 0, 0.8).fill(0xc2c8b0);
    for (let i = 0; i < 24; i++) this.motes.addChild(new Graphics(shape));
    this.renderer.layers.entities.addChild(this.motes);
  }

  update(world: World, dt: number): void {
    world.each(['enemyVisual'], (_e, v) => { v.recoil = Math.max(0, v.recoil - dt * 8); });
    world.each(['pickupVisual'], (_e, v) => { v.age += dt; });
    world.each(['particle', 'transform'], (_e, p, t) => {
      const damping = Math.exp(-p.drag * dt);
      t.vx *= damping;
      t.vy *= damping;
      t.angle += p.spin * dt;
    });
  }

  render(world: World, _alpha: number, dt: number): void {
    this.time += dt;
    const camera = this.renderer.cameraTarget;
    const player = camera === null ? undefined : world.get(camera, 'transform');
    let nearestPickup = -1;
    let nearestDistance = 105;
    if (player) world.each(['pickup', 'transform', 'renderable'], (entity, _p, t, r) => {
      const distance = Math.hypot(player.x - t.x, player.y - t.y);
      if (r.node.visible && distance < nearestDistance) { nearestDistance = distance; nearestPickup = entity; }
    });
    world.each(['enemyVisual', 'renderable', 'health', 'transform', 'aiController', 'weaponInventory'], (_e, v, r, h, t, ai, inv) => {
      if (!r.node.visible || !(r.node instanceof HostileGraphic)) return;
      const w = inv.slots[inv.activeSlot];
      r.node.setWeapon(w.type);
      r.node.animateHostile(dt, Math.hypot(t.vx, t.vy), v.recoil, h, t.angle, ai.state, inv.reloadTimer > 0 ? 1 - inv.reloadTimer / w.reloadTime : 0);
    });
    world.each(['pickupVisual', 'pickup', 'renderable'], (entity, v, _p, r) => {
      if (!r.node.visible || !(r.node instanceof PickupGraphic)) return;
      r.node.animate(v.age, v.phase, entity === nearestPickup);
    });
    this.motes.visible = !!player;
    if (player) this.motes.children.forEach((m, i) => {
      const x = ((i * 127.1 + this.time * (3 + i % 4)) % 720) - 360;
      const y = ((i * 217.7 - this.time * 5) % 720 + 720) % 720 - 360;
      m.position.set(player.x + x, player.y + y);
      m.alpha = 0.12 + 0.15 * Math.sin(this.time + i) ** 2;
    });
  }
}
