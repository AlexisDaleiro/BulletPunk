import { Graphics } from 'pixi.js';
import { BULLET_RANGE, COLORS } from '../config';
import { createTransform, type ProjectileComponent, type Team, type TransformComponent } from '../ecs/components';
import type { Entity, World } from '../ecs/World';
import type { RenderSystem } from '../systems/RenderSystem';

export interface ShotSpec {
  range?: number;
  color?: number;
  x: number;
  y: number;
  angle: number;
  /** px/s */
  speed: number;
  team: Team;
  damage: number;
  piercing: boolean;
  explosive: boolean;
  bounces: number;
}

/**
 * Bullets are recycled, never destroyed: an inactive projectile keeps its entity and Graphics
 * node, and `spawn` re-arms one from the idle list. No allocation per shot once warmed up.
 */
export class ProjectilePool {
  private readonly world: World;
  private readonly renderer: RenderSystem;
  private readonly idle: Entity[] = [];

  constructor(world: World, renderer: RenderSystem) {
    this.world = world;
    this.renderer = renderer;
  }

  spawn(spec: ShotSpec): Entity {
    const entity = this.idle.pop() ?? this.create();
    const t = this.world.get(entity, 'transform') as TransformComponent;
    const p = this.world.get(entity, 'projectile') as ProjectileComponent;
    const node = this.world.get(entity, 'renderable')?.node as Graphics;

    t.x = t.prevX = spec.x;
    t.y = t.prevY = spec.y;
    t.angle = t.prevAngle = spec.angle;
    t.vx = Math.cos(spec.angle) * spec.speed;
    t.vy = Math.sin(spec.angle) * spec.speed;
    p.active = true;
    p.team = spec.team;
    p.damage = spec.damage;
    p.piercing = spec.piercing;
    p.explosive = spec.explosive;
    p.bounces = spec.bounces;
    p.life = (spec.range ?? BULLET_RANGE) / spec.speed;
    p.hit.length = 0;

    // Neon bolt pointing along +x (the node rotates with the transform): a bright head and a trail.
    const color = spec.color ?? (spec.team === 'PLAYER' ? COLORS.cyan : COLORS.red);
    const heavy = spec.piercing;
    const length = heavy ? 90 : Math.min(60, Math.max(14, spec.speed * 0.05));
    const width = heavy ? 5 : 2.5;
    node.clear()
      .poly([-length, 0, -length * .25, -width * 1.7, width * 2, 0, -length * .25, width * 1.7]).fill({ color, alpha: .12 })
      .moveTo(-length * .8, 0).lineTo(0, 0).stroke({ width: width * 3, color, alpha: .09 })
      .moveTo(-length * .65, 0).lineTo(0, 0).stroke({ width, color, alpha: .75 })
      .moveTo(-length * .22, 0).lineTo(width, 0).stroke({ width: Math.max(1, width * .45), color: 0xfff5db, alpha: .95 })
      .circle(0, 0, width * .65).fill(0xffffff);
    node.renderable = true;
    return entity;
  }

  /** Forgets every recycled bolt. Call after the world was cleared, when their entities no longer exist. */
  reset(): void {
    this.idle.length = 0;
  }

  release(entity: Entity): void {
    const p = this.world.get(entity, 'projectile');
    const t = this.world.get(entity, 'transform');
    const r = this.world.get(entity, 'renderable');
    if (!p || !t || !r) return;
    p.active = false;
    t.vx = 0;
    t.vy = 0;
    r.node.renderable = false;
    this.idle.push(entity);
  }

  private create(): Entity {
    const entity = this.world.create();
    this.world
      .add(entity, 'transform', createTransform(0, 0))
      .add(entity, 'projectile', { active: false, team: 'PLAYER', damage: 0, piercing: false, explosive: false, bounces: 0, life: 0, hit: [] })
      .add(entity, 'fogged', {});
    const node = new Graphics();
    node.blendMode = 'add';
    node.renderable = false;
    this.renderer.attach(this.world, entity, 'entities', node);
    return entity;
  }
}
