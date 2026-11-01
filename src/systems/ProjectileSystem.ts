import type { SoundManager } from '../audio/SoundManager';
import { applyDamage } from '../combat/damage';
import { COLORS, TILE_SIZE } from '../config';
import type { Team } from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnFlash } from '../entities/effects';
import type { ProjectilePool } from '../entities/projectiles';
import type { Level } from '../game/Level';
import { raycastTiles, segmentCircle } from '../world/raycast';
import type { TileMap } from '../world/TileMap';
import type { RenderSystem } from './RenderSystem';

/** Added to a body's half-size so a bolt that grazes the box still counts. */
const BULLET_RADIUS = 3;

interface Candidate {
  t: number;
  entity: Entity;
}
const candidates: Candidate[] = [];

/**
 * Moves nothing itself: PhysicsSystem already advanced each bolt. This sweeps the segment from the
 * previous to the current position, so even a 1800 px/s railgun slug (30 px per step) can not tunnel
 * through a wall or a body. Hits are resolved nearest first; walls end, bounce or are ignored by the shot.
 */
export class ProjectileSystem implements System {
  /** Current floor's tiles. */
  map: TileMap | null = null;
  /** Current floor; explosive rounds use it to blow open secret walls. */
  level: Level | null = null;
  private readonly renderer: RenderSystem;
  private readonly pool: ProjectilePool;
  private readonly audio: SoundManager;

  constructor(renderer: RenderSystem, pool: ProjectilePool, audio: SoundManager) {
    this.renderer = renderer;
    this.pool = pool;
    this.audio = audio;
  }

  update(world: World, dt: number): void {
    const map = this.map;
    if (!map) return;
    const solid = (tx: number, ty: number): boolean => map.isSolid(tx, ty);

    world.each(['projectile', 'transform'], (entity, p, t) => {
      if (!p.active) return;
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.release(entity);
        return;
      }

      const wall = raycastTiles(solid, t.prevX, t.prevY, t.x, t.y);
      const reach = wall ? wall.t : 1;

      candidates.length = 0;
      world.each(['health', 'transform', 'team', 'collider'], (target, health, tt, team, collider) => {
        if (team.team === p.team || health.hp <= 0 || p.hit.includes(target)) return;
        const hit = segmentCircle(t.prevX, t.prevY, t.x, t.y, tt.x, tt.y, collider.halfSize + BULLET_RADIUS);
        if (hit !== null && hit <= reach) candidates.push({ t: hit, entity: target });
      });
      candidates.sort((a, b) => a.t - b.t);

      for (const c of candidates) {
        const health = world.get(c.entity, 'health');
        if (health) applyDamage(health, p.damage);
        p.hit.push(c.entity);
        this.impact(world, t.prevX + (t.x - t.prevX) * c.t, t.prevY + (t.y - t.prevY) * c.t, p.team);
        if (!p.piercing) {
          this.pool.release(entity);
          return;
        }
      }
      if (!wall) return;

      const hx = t.prevX + (t.x - t.prevX) * wall.t;
      const hy = t.prevY + (t.y - t.prevY) * wall.t;
      this.impact(world, hx, hy, p.team);
      if (p.explosive && this.level && (wall.nx !== 0 || wall.ny !== 0)) {
        // The slug entered the tile on the far side of the hit face.
        const tx = Math.floor((hx - wall.nx * 2) / TILE_SIZE);
        const ty = Math.floor((hy - wall.ny * 2) / TILE_SIZE);
        if (map.get(tx, ty) === 'SECRET_WALL') {
          this.level.setTiles([{ x: tx, y: ty, tile: 'FLOOR' }]);
          spawnFlash(world, this.renderer, hx, hy, COLORS.amber, 30, 0.4);
          this.audio.playExplosion({ x: hx, y: hy });
        }
      }
      if (p.bounces > 0 && (wall.nx !== 0 || wall.ny !== 0)) {
        // Ricochet: mirror the velocity across the face and restart the sweep just off the wall.
        const dot = t.vx * wall.nx + t.vy * wall.ny;
        t.vx -= 2 * dot * wall.nx;
        t.vy -= 2 * dot * wall.ny;
        t.x = t.prevX = hx + wall.nx * 1.5;
        t.y = t.prevY = hy + wall.ny * 1.5;
        t.angle = t.prevAngle = Math.atan2(t.vy, t.vx);
        p.bounces--;
        p.hit.length = 0;
      } else {
        this.pool.release(entity);
      }
    });
  }

  private impact(world: World, x: number, y: number, team: Team): void {
    spawnFlash(world, this.renderer, x, y, team === 'PLAYER' ? COLORS.cyan : COLORS.red, 9, 0.18);
    this.audio.playBulletImpact({ x, y });
  }
}
