import { COLORS, MUZZLE_OFFSET, NOISE_PROFILE_MULT } from '../config';
import type { Team, TransformComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnFlash } from '../entities/effects';
import type { ProjectilePool } from '../entities/projectiles';
import type { NoiseField } from '../noise/NoiseField';
import type { WeaponDefinition } from '../types';
import { raycastTiles } from '../world/raycast';
import type { TileMap } from '../world/TileMap';
import type { RenderSystem } from './RenderSystem';

/**
 * Turns `wantsFire / wantsReload / wantsSwap` intents into magazine state, projectiles and noise,
 * for the player and bots alike.
 */
export class WeaponSystem implements System {
  /** Current floor's tiles; shots fired point-blank into a wall die at the wall. */
  map: TileMap | null = null;
  private readonly renderer: RenderSystem;
  private readonly field: NoiseField;
  private readonly pool: ProjectilePool;

  constructor(renderer: RenderSystem, field: NoiseField, pool: ProjectilePool) {
    this.renderer = renderer;
    this.field = field;
    this.pool = pool;
  }

  update(world: World, dt: number): void {
    world.each(['transform', 'intent', 'weaponInventory', 'team'], (entity, t, intent, inv, team) => {
      const w = inv.slots[inv.activeSlot];
      if (!w) return;
      const slot = inv.activeSlot;
      inv.fireCooldown = Math.max(0, inv.fireCooldown - dt);

      if (intent.wantsSwap && inv.slots.length > 1) {
        inv.activeSlot = (slot + 1) % inv.slots.length;
        inv.reloadTimer = 0;
        inv.fireCooldown = 0.2;
        return;
      }

      if (inv.reloadTimer > 0) {
        inv.reloadTimer -= dt;
        if (inv.reloadTimer <= 0) {
          inv.reloadTimer = 0;
          const take = Math.min(w.magazineSize - inv.magazine[slot], inv.reserve[slot]);
          inv.magazine[slot] += take;
          inv.reserve[slot] -= take; // Infinity - n stays Infinity: the pistol never runs dry
        }
        return;
      }

      if (intent.wantsReload && inv.magazine[slot] < w.magazineSize && inv.reserve[slot] > 0) {
        this.startReload(world, entity, t, w, inv);
        return;
      }
      if (!intent.wantsFire || inv.fireCooldown > 0) return;
      if (inv.magazine[slot] <= 0) {
        if (inv.reserve[slot] > 0) this.startReload(world, entity, t, w, inv);
        return;
      }
      this.fire(world, entity, t, w, inv, team.team);
    });
  }

  /** Reloading is a quiet amber pulse. */
  private startReload(world: World, entity: Entity, t: TransformComponent, w: WeaponDefinition, inv: WeaponInventoryComponent): void {
    inv.reloadTimer = w.reloadTime;
    const damping = world.get(entity, 'passiveSynergy')?.stats.noiseDampingMult ?? 1;
    this.field.emit('UTILITY', t.x, t.y, entity, damping);
  }

  private fire(world: World, entity: Entity, t: TransformComponent, w: WeaponDefinition, inv: WeaponInventoryComponent, team: Team): void {
    const stats = world.get(entity, 'passiveSynergy')?.stats;
    const color = team === 'PLAYER' ? COLORS.cyan : COLORS.red;
    const mx = t.x + Math.cos(t.angle) * MUZZLE_OFFSET;
    const my = t.y + Math.sin(t.angle) * MUZZLE_OFFSET;

    inv.magazine[inv.activeSlot]--;
    inv.fireCooldown = 1 / (w.fireRate * (stats?.fireRateMult ?? 1));

    const mult = NOISE_PROFILE_MULT[w.noiseProfile];
    if (mult > 0) this.field.emit('SHOOT', t.x, t.y, entity, mult * (stats?.noiseDampingMult ?? 1));

    // Muzzle inside a wall (shooter hugging it): the shot dies on the wall face.
    const map = this.map;
    const blocked = map ? raycastTiles((tx, ty) => map.isSolid(tx, ty), t.x, t.y, mx, my) : null;
    if (blocked) {
      spawnFlash(world, this.renderer, t.x + (mx - t.x) * blocked.t, t.y + (my - t.y) * blocked.t, color, 9, 0.18);
      return;
    }
    spawnFlash(world, this.renderer, mx, my, color, 7, 0.08);

    const damage = w.damagePerPellet * (stats?.damageMult ?? 1);
    const bounces = (w.specialAttributes?.ricochetCount ?? 0) + (stats?.bulletBounces ?? 0);
    for (let i = 0; i < w.pelletCount; i++) {
      this.pool.spawn({
        x: mx,
        y: my,
        angle: t.angle + (Math.random() - 0.5) * w.spreadAngle,
        speed: w.projectileSpeed,
        team,
        damage,
        piercing: w.specialAttributes?.piercing ?? false,
        bounces,
      });
    }
  }
}
