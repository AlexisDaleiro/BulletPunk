import type { SoundManager } from '../audio/SoundManager';
import { abilityModifiers, endAbility } from '../characters/abilities';
import { weaponMuzzle } from '../characters/weaponPose';
import { hasMobileTarget, mobileAttackCone } from '../combat/mobileAim';
import { COLORS, MUZZLE_OFFSET, NOISE_PROFILE_MULT } from '../config';
import type { Team, TransformComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnDebris, spawnFlash } from '../entities/effects';
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
  private readonly audio: SoundManager;

  constructor(renderer: RenderSystem, field: NoiseField, pool: ProjectilePool, audio: SoundManager) {
    this.renderer = renderer;
    this.field = field;
    this.pool = pool;
    this.audio = audio;
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
      const cone = intent.autoFire && world.has(entity, 'playerControlled') ? mobileAttackCone(world, entity, w) : null;
      const wantsFire = cone ? !!this.map && hasMobileTarget(world, this.map, entity, cone) : intent.wantsFire;
      if (!wantsFire || inv.fireCooldown > 0) return;
      if (inv.magazine[slot] <= 0) {
        if (inv.reserve[slot] > 0) this.startReload(world, entity, t, w, inv);
        return;
      }
      this.fire(world, entity, t, w, inv, team.team, cone?.spread ?? w.spreadAngle);
    });
  }

  /** Reloading is a quiet amber pulse. */
  private startReload(world: World, entity: Entity, t: TransformComponent, w: WeaponDefinition, inv: WeaponInventoryComponent): void {
    inv.reloadTimer = w.reloadTime;
    const damping = world.get(entity, 'passiveSynergy')?.stats.noiseDampingMult ?? 1;
    this.field.emit('UTILITY', t.x, t.y, entity, damping);
    this.audio.playReload(t);
  }

  private fire(world: World, entity: Entity, t: TransformComponent, w: WeaponDefinition, inv: WeaponInventoryComponent, team: Team, spread: number): void {
    const stats = world.get(entity, 'passiveSynergy')?.stats;
    const character = world.get(entity, 'character');
    const enemy = world.get(entity, 'enemyVisual');
    const color = team === 'PLAYER' ? character?.def.color ?? COLORS.cyan : COLORS.red;
    const muzzle = character || enemy ? weaponMuzzle(w) : { x: MUZZLE_OFFSET, y: 0 };
    const mx = t.x + Math.cos(t.angle) * muzzle.x - Math.sin(t.angle) * muzzle.y;
    const my = t.y + Math.sin(t.angle) * muzzle.x + Math.cos(t.angle) * muzzle.y;
    if (character) {
      character.recoil = 1;
      const health = world.get(entity, 'health');
      if (health && character.def.ability.kind === 'GHOST_STEP' && !character.augments?.ghostFire) endAbility(character, health);
    }

    inv.magazine[inv.activeSlot]--;
    if (enemy) enemy.recoil = 1;
    inv.fireCooldown = 1 / (w.fireRate * (stats?.fireRateMult ?? 1));

    const mult = NOISE_PROFILE_MULT[w.noiseProfile] * (w.noiseScale ?? 1);
    if (mult > 0) this.field.emit('SHOOT', t.x, t.y, entity, mult * (stats?.noiseDampingMult ?? 1));
    this.audio.playLaserShoot(w.type, t);

    // Muzzle inside a wall (shooter hugging it): the shot dies on the wall face.
    const map = this.map;
    const blocked = map ? raycastTiles((tx, ty) => map.isSolid(tx, ty), t.x, t.y, mx, my) : null;
    if (blocked) {
      spawnFlash(world, this.renderer, t.x + (mx - t.x) * blocked.t, t.y + (my - t.y) * blocked.t, color, 9, 0.18);
      return;
    }
    spawnFlash(world, this.renderer, mx, my, color, 7, 0.08);
    spawnDebris(world, this.renderer, t.x - Math.sin(t.angle) * 13, t.y + Math.cos(t.angle) * 13, 0xc8a675, 1, true);

    const damage = w.damagePerPellet * (stats?.damageMult ?? 1) * abilityModifiers(character).damageMult * (character?.augments?.damageMult ?? 1);
    const bounces = (w.specialAttributes?.ricochetCount ?? 0) + (stats?.bulletBounces ?? 0);
    for (let i = 0; i < w.pelletCount; i++) {
      this.pool.spawn({
        x: mx,
        y: my,
        angle: t.angle + (Math.random() - 0.5) * spread,
        speed: w.projectileSpeed,
        team,
        damage,
        piercing: w.specialAttributes?.piercing ?? false,
        explosive: w.noiseProfile === 'EXPLOSIVE',
        bounces,
        range: w.range,
        color,
      });
    }
  }
}
