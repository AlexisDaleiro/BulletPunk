import { SNEAK_INPUT } from '../config';
import { abilityModifiers } from '../characters/abilities';
import { smoothAngle } from '../core/math';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

const IDLE_INPUT = 0.01;

/**
 * Turns intent into velocity and facing: accelerated movement, cyber-dash, gait for noise.
 * Runs after PhysicsSystem, so a velocity set here is integrated on the next step (16 ms latency)
 * and the angle change lands after the physics snapshot, which keeps rotation interpolated.
 */
export class LocomotionSystem implements System {
  update(world: World, dt: number): void {
    world.each(['transform', 'intent', 'locomotion'], (entity, t, intent, loc) => {
      const inputLen = Math.hypot(intent.moveX, intent.moveY);
      const mag = Math.min(1, inputLen);

      loc.dashTimer = Math.max(0, loc.dashTimer - dt);
      loc.dashCooldownTimer = Math.max(0, loc.dashCooldownTimer - dt);
      if (intent.wantsDash && loc.dashTimer === 0 && loc.dashCooldownTimer === 0) {
        loc.dashTimer = loc.dashDuration;
        loc.dashCooldownTimer = loc.dashCooldown;
        loc.trailTimer = 0;
        // Cyber-dash grants i-frames for its whole duration.
        const health = world.get(entity, 'health');
        if (health) health.invulnerableTimer = Math.max(health.invulnerableTimer, loc.dashDuration);
        // Dash where you move, or straight ahead when standing still.
        loc.dashDirX = mag > IDLE_INPUT ? intent.moveX / inputLen : Math.cos(t.angle);
        loc.dashDirY = mag > IDLE_INPUT ? intent.moveY / inputLen : Math.sin(t.angle);
      }

      if (loc.dashTimer > 0) {
        t.vx = loc.dashDirX * loc.dashSpeed;
        t.vy = loc.dashDirY * loc.dashSpeed;
      } else {
        const speedMult = world.get(entity, 'passiveSynergy')?.stats.moveSpeedMult ?? 1;
        const scale = (inputLen > 1 ? 1 / inputLen : 1) * loc.runSpeed * speedMult * abilityModifiers(world.get(entity, 'character')).speedMult;
        const targetX = intent.moveX * scale;
        const targetY = intent.moveY * scale;
        const dvx = targetX - t.vx;
        const dvy = targetY - t.vy;
        const dist = Math.hypot(dvx, dvy);
        const speeding = Math.hypot(targetX, targetY) > Math.hypot(t.vx, t.vy);
        const step = (speeding ? loc.accel : loc.decel) * dt;
        if (dist <= step) {
          t.vx = targetX;
          t.vy = targetY;
        } else {
          t.vx += (dvx / dist) * step;
          t.vy += (dvy / dist) * step;
        }
      }

      loc.gait = loc.dashTimer > 0 ? 'RUN' : mag <= IDLE_INPUT ? 'IDLE' : mag < SNEAK_INPUT ? 'SNEAK' : 'RUN';
      t.angle = smoothAngle(t.angle, intent.aimAngle, loc.turnRate * (intent.autoFire ? 1.8 : 1), dt);
    });
  }
}
