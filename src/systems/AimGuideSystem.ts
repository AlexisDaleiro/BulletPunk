import { Graphics } from 'pixi.js';
import { traceAim } from '../combat/aimTrace';
import { BULLET_RANGE } from '../config';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { TileMap } from '../world/TileMap';
import { segmentCircle } from '../world/raycast';
import type { RenderSystem } from './RenderSystem';

/** Collision-aware laser. Only already-visible enemies may change the target indicator. */
export class AimGuideSystem implements System {
  map: TileMap | null = null;
  private readonly guide = new Graphics();
  private readonly renderer: RenderSystem;
  constructor(renderer: RenderSystem) { this.renderer = renderer; }
  init(): void { this.renderer.layers.vision.addChild(this.guide); }

  render(world: World): void {
    this.guide.clear();
    const map = this.map;
    if (!map) return;
    world.each(['playerControlled', 'transform', 'weaponInventory', 'vision', 'health'], (_e, _tag, t, inv, vision, health) => {
      if (health.hp <= 0) return;
      const weapon = inv.slots[inv.activeSlot];
      const trace = traceAim(map, t.x, t.y, t.angle, weapon.type, Math.min(weapon.range ?? BULLET_RANGE, vision.effectiveRange ?? vision.range));
      let hit = 1, target = false;
      world.each(['team', 'transform', 'health', 'collider', 'renderable'], (_enemy, team, enemy, h, col, r) => {
        if (team.team !== 'ENEMY' || h.hp <= 0 || !r.node.visible) return;
        const fraction = segmentCircle(trace.sx, trace.sy, trace.ex, trace.ey, enemy.x, enemy.y, col.halfSize + 3);
        if (fraction !== null && fraction < hit) { hit = fraction; target = true; }
      });
      const ex = trace.sx + (trace.ex - trace.sx) * hit, ey = trace.sy + (trace.ey - trace.sy) * hit;
      const color = target ? 0xff9785 : inv.reloadTimer > 0 ? 0xd5bc80 : 0x92e8cf;
      this.guide.moveTo(trace.sx, trace.sy).lineTo(ex, ey).stroke({ color, width: 3, alpha: 0.08 });
      this.guide.moveTo(trace.sx, trace.sy).lineTo(ex, ey).stroke({ color, width: 0.9, alpha: inv.reloadTimer > 0 ? 0.25 : 0.65 });
      this.guide.circle(ex, ey, target ? 5 : 3).stroke({ color, width: 1, alpha: 0.85 });
      this.guide.circle(ex, ey, 1.1).fill(color);
      if (target) this.guide.moveTo(ex - 8, ey).lineTo(ex - 5, ey).moveTo(ex + 5, ey).lineTo(ex + 8, ey).stroke({ color, width: 1, alpha: 0.8 });
    });
  }
}
