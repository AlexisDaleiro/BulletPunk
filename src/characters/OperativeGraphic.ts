import { Container, Graphics } from 'pixi.js';
import type { CharacterDef } from './characters';
import { weaponMuzzle } from './weaponPose';
import type { WeaponType } from '../types';
import type { CharacterComponent, HealthComponent } from '../ecs/components';

const INK = 0x0b1115;

/** Layered top-down art. +X is forward; the root alone is rotated by the renderer. */
export class OperativeGraphic extends Container {
  private readonly rig = new Container();
  private readonly feet = [new Graphics(), new Graphics()];
  private readonly gun = new Graphics();
  private readonly effect = new Graphics();
  private readonly lights = new Graphics();
  private weaponType: WeaponType | null = null;
  private stride = 0;
  private age = 0;
  private readonly def: CharacterDef;

  constructor(def: CharacterDef, weapon: WeaponType) {
    super();
    this.def = def;
    const p = def.palette;
    const heavy = def.id === 'BRASA';
    const scout = def.id === 'VECTOR';
    const shoulder = heavy ? 13 : scout ? 11 : 9;
    const shadow = new Graphics().ellipse(1, 3, heavy ? 20 : 17, heavy ? 18 : 15).fill({ color: 0x000000, alpha: 0.38 });
    this.addChild(shadow, this.effect, this.rig);
    this.feet.forEach((foot, i) => {
      foot.roundRect(-15, i ? 3 : -10, 10, 7, 2).fill(INK).stroke({ color: p.metal, width: 0.7 });
      foot.rect(-14, i ? 4 : -9, 3, 5).fill(p.armor);
      this.rig.addChild(foot);
    });

    const coat = new Graphics();
    if (scout) {
      coat.poly([-8, -10, -21, -12, -17, -2, -8, -1]).fill(p.cloth).stroke({ width: 1, color: INK });
      coat.poly([-8, 1, -20, 5, -19, 13, -7, 10]).fill(p.cloth).stroke({ width: 1, color: p.metal, alpha: 0.5 });
      coat.moveTo(-18, -10).lineTo(-10, -5).stroke({ width: 1, color: p.light, alpha: 0.5 });
    } else if (!heavy) {
      coat.poly([-8, -10, -15, -8, -13, 8, -7, 10]).fill(p.cloth).stroke({ color: INK, width: 1.5 });
    }
    this.rig.addChild(coat);

    const pack = new Graphics().roundRect(-13, -7, 8, 14, 2).fill(INK).stroke({ color: p.metal, width: 1 });
    pack.roundRect(-12, -5, 4, 10, 1).fill(p.armor);
    if (heavy) {
      pack.roundRect(-16, -6, 5, 12, 2).fill(p.metal).stroke({ color: INK, width: 1 });
      pack.rect(-15, -3, 2, 6).fill(def.color);
    }
    this.rig.addChild(pack);

    const body = new Graphics();
    body.roundRect(-10, -10, 17, 20, 4).fill(p.cloth).stroke({ width: 1.5, color: INK });
    body.poly([-8, -7, 1, -9, 6, -5, 5, 6, -5, 9, -9, 4]).fill(p.armor).stroke({ width: 1, color: p.metal });
    body.moveTo(-7, -4).lineTo(-3, 0).lineTo(-7, 5).stroke({ color: p.light, width: 1, alpha: 0.35 });
    body.rect(-8, -2, 3, 5).fill(p.cloth);
    body.roundRect(-6, 6, 5, 3, 0.7).fill(p.light);
    // Shoulder shape and armor mass differ as well as the palette.
    for (const side of [-1, 1]) {
      const y = side * shoulder;
      body.roundRect(-5, y - (heavy ? 5 : 4), heavy ? 12 : 9, heavy ? 10 : 8, heavy ? 2 : 3)
        .fill(side === -1 || heavy ? p.armor : p.cloth).stroke({ color: INK, width: 1.5 });
      body.moveTo(-3, y - 2).lineTo(3, y - 2).stroke({ color: p.light, alpha: 0.65, width: 1 });
      // Bent forearm and glove, supporting the gun along the right side.
      body.poly([3, y - 2, 10, side > 0 ? 11 : -3, 17, 7, 14, 10, 6, side > 0 ? 14 : 2, 1, y + 3])
        .fill(p.cloth).stroke({ color: INK, width: 1 });
      body.roundRect(side > 0 ? 10 : 15, 6, 5, 5, 1.5).fill(p.metal).stroke({ color: INK, width: 0.7 });
    }
    if (heavy) {
      body.poly([-1, -16, 5, -15, 7, -8, 0, -7]).fill(p.light).stroke({ color: INK, width: 1 });
      body.moveTo(-3, 10).lineTo(2, 13).stroke({ color: def.color, width: 2 });
    } else if (!scout) {
      body.poly([-6, -13, 0, -14, 5, -9, 1, -6, -5, -8]).fill(p.light).stroke({ color: INK, width: 1 });
    }
    // Collar, helmet crown and front visor establish a human silhouette from above.
    body.ellipse(3, -1, 7, 7.5).fill(INK);
    body.roundRect(0, -7, heavy ? 12 : 11, 12, heavy ? 3 : 5).fill(scout ? p.light : p.armor).stroke({ color: INK, width: 1.3 });
    body.poly([2, -6, 7, -6, 8, -3, 2, -3]).fill({ color: p.light, alpha: scout ? 0.25 : 0.6 });
    body.roundRect(8, -5, 4, 7, 1).fill(INK);
    body.rect(10, -4, 1.6, 5).fill(def.color);
    body.moveTo(1, 0).lineTo(5, 2).stroke({ color: INK, alpha: 0.6, width: 1 });
    if (scout) {
      body.roundRect(4, -11, 8, 4, 1).fill(INK).stroke({ color: p.metal, width: 0.7 });
      body.circle(11, -9, 2).fill(def.color);
      body.moveTo(-8, -9).lineTo(-13, -17).stroke({ color: p.metal, width: 1 });
    }
    // Small abrasion marks rather than a full neon outline.
    body.moveTo(-2, -11).lineTo(1, -10).moveTo(-6, 4).lineTo(-4, 3).stroke({ color: p.light, width: 0.6, alpha: 0.7 });
    this.rig.addChild(body, this.gun, this.lights);
    this.lights.roundRect(-4, -shoulder - 1, 4, 1.6, 0.5).fill(def.color);
    this.lights.roundRect(-4, shoulder, 3, 1.6, 0.5).fill(def.color);
    this.setWeapon(weapon);
  }

  setWeapon(type: WeaponType): void {
    if (this.weaponType === type) return;
    this.weaponType = type;
    const p = this.def.palette;
    const m = weaponMuzzle(type);
    const g = this.gun.clear();
    g.roundRect(8, 6, 11, 5, 1).fill(INK).stroke({ color: p.metal, width: 0.8 });
    g.rect(13, 10, 4, 3).fill(p.armor);
    if (type === 'RAILGUN') {
      g.roundRect(16, 5, 15, 6, 1).fill(p.light).stroke({ color: INK, width: 1 });
      g.rect(29, 6, m.x - 29, 4).fill(p.metal).stroke({ color: INK, width: 0.7 });
      g.rect(20, 6.5, 13, 1).fill(this.def.color);
      g.roundRect(16, 3, 8, 3, 1).fill(INK);
      g.circle(23, 4.5, 1).fill(this.def.color);
    } else if (type === 'SHOTGUN') {
      g.roundRect(15, 5, 10, 7, 1).fill(p.armor).stroke({ color: INK, width: 1 });
      g.rect(23, 6, m.x - 23, 4).fill(p.metal);
      for (let x = 16; x < 23; x += 2) g.moveTo(x, 6).lineTo(x, 11).stroke({ color: INK, width: 1 });
      g.rect(10, 7, 3, 3).fill(this.def.color);
    } else {
      g.roundRect(15, 6, m.x - 15, 4, 1).fill(p.metal).stroke({ color: INK, width: 0.8 });
      if (type !== 'PISTOL') g.roundRect(m.x - 7, 5, 7, 6, 1).fill(0x29363c).stroke({ color: p.metal, width: 0.6 });
      g.rect(16, 7, 3, 1).fill(this.def.color);
    }
    g.rect(m.x - 1, 6.5, 1.2, 3).fill(INK);
  }

  animate(dt: number, speed: number, c: CharacterComponent, h: HealthComponent): void {
    this.age += dt;
    this.stride += dt * Math.min(speed, 330) * 0.065;
    const moving = Math.min(1, speed / 100);
    this.feet.forEach((f, i) => { f.x = Math.sin(this.stride + i * Math.PI) * 2.2 * moving; });
    this.rig.y = Math.sin(this.stride * 2) * 0.45 * moving;
    this.rig.rotation = Math.sin(this.stride) * 0.018 * moving;
    this.gun.x = -c.recoil * 2.5;
    this.rig.tint = (h.hitFlash ?? 0) > 0 ? 0xffc4b4 : 0xffffff;
    this.lights.alpha = c.activeRemaining > 0 ? 0.7 + Math.sin(this.age * 10) * 0.3 : 0.8;
    const e = this.effect.clear();
    const color = this.def.color;
    if (c.activeRemaining > 0 && h.hp > 0) {
      if (this.def.id === 'BRASA') {
        for (let i = 0; i < 6; i++) e.arc(0, 0, 23, i * Math.PI / 3 + 0.1, (i + 1) * Math.PI / 3 - 0.1).stroke({ color, width: (h.hitFlash ?? 0) > 0 ? 3 : 1.6, alpha: 0.7 });
      } else if (this.def.id === 'VECTOR') {
        const r = 24 + ((this.age * 22) % 18);
        e.arc(0, 0, r, -0.65, 0.65).stroke({ color, alpha: 0.35, width: 1 });
      } else {
        e.moveTo(-22, -10).lineTo(-12, -10).moveTo(-22, 10).lineTo(-12, 10).stroke({ color, width: 1.2, alpha: 0.6 });
      }
    }
    if (c.activationFlash > 0) e.circle(0, 0, 18 + (0.5 - c.activationFlash) * 24).stroke({ color, width: 1.5, alpha: c.activationFlash });
  }
}
