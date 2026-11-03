import { Container, Graphics, Sprite, type Renderer } from 'pixi.js';
import type { OperativeAppearance } from './enemyAppearances';
import { cachedArt } from '../render/artCache';
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
  private readonly muzzleLight = new Graphics();
  private readonly torso = new Container();
  private readonly weaponRig = new Container();
  private readonly renderer?: Renderer;
  private damageOverlay?: Sprite;
  private weaponType: WeaponType | null = null;
  private stride = 0;
  private age = 0;
  private readonly def: OperativeAppearance;

  constructor(def: OperativeAppearance, weapon: WeaponType, renderer?: Renderer) {
    super();
    this.def = def;
    this.renderer = renderer;
    const p = def.palette;
    const heavy = def.id === 'BRASA' || def.id === 'MORSA' || def.silhouette === 'HEAVY';
    const scout = def.id === 'VECTOR' || def.silhouette === 'SCOUT';
    const shoulder = heavy ? 13 : scout ? 11 : 9;
    const shadow = new Graphics().ellipse(2, 5, heavy ? 24 : 21, heavy ? 21 : 18).fill({ color: 0x000000, alpha: 0.15 })
      .ellipse(1, 3, heavy ? 20 : 17, heavy ? 18 : 15).fill({ color: 0x000000, alpha: 0.45 });
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
    this.torso.addChild(coat);

    const pack = new Graphics().roundRect(-13, -7, 8, 14, 2).fill(INK).stroke({ color: p.metal, width: 1 });
    pack.roundRect(-12, -5, 4, 10, 1).fill(p.armor);
    if (heavy) {
      pack.roundRect(-16, -6, 5, 12, 2).fill(p.metal).stroke({ color: INK, width: 1 });
      pack.rect(-15, -3, 2, 6).fill(def.color);
    }
    this.torso.addChild(pack);

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
    if (def.hostile) {
      // A respirator, armor chevrons and a red ID plate make the faction distinct.
      body.roundRect(9, -5, 6, 9, 2).fill(0x1a2024).stroke({ color: p.metal, width: 0.7 });
      body.rect(13, -4, 1.7, 6).fill(def.color);
      body.moveTo(-3, -12).lineTo(0, -10).lineTo(3, -12).stroke({ color: def.color, width: 1.6 });
      body.roundRect(-8, 5, 5, 4, 0.5).fill(0x351c20);
      body.rect(-7, 6, 3, 1).fill(0xff8271);
      if (heavy) {
        for (let i = 0; i < 3; i++) body.roundRect(-8 + i * 3, 11, 2, 5, 0.5).fill(0xc6a077).stroke({ color: INK, width: 0.6 });
      } else if (scout) {
        body.poly([-8, -11, -14, -14, -18, -6, -8, -4]).fill(p.armor).stroke({ color: INK, width: 1 });
      }
    }
    if (def.id === 'SUTURA') {
      body.roundRect(-14, -10, 9, 20, 2).fill(p.light).stroke({ color: INK, width: 1.5 });
      body.rect(-12, -2, 5, 2).rect(-10.5, -4, 2, 6).fill(def.color);
      body.roundRect(0, -7, 10, 12, 3).fill(p.light).stroke({ color: INK, width: 1 });
      body.rect(8, -4, 3, 6).fill(0x425958);
      body.rect(-3, 10, 7, 4).fill(def.color);
    } else if (def.id === 'VOLT') {
      body.poly([-7, -12, -17, -8, -19, 4, -12, 10, -7, 7]).fill(p.light).stroke({ color: INK, width: 1.5 });
      body.circle(-11, -1, 4).fill(0x1d3146).stroke({ color: def.color, width: 1.5 });
      body.moveTo(-13, -9).lineTo(-18, -17).moveTo(-11, 8).lineTo(-17, 16).stroke({ color: p.metal, width: 2 });
      body.poly([2, -8, 10, -5, 12, 1, 4, 6, -1, 3]).fill(p.armor).stroke({ color: INK, width: 1 });
      body.rect(9, -3, 3, 5).fill(def.color);
    } else if (def.id === 'MORSA') {
      body.roundRect(-17, -10, 8, 20, 2).fill(p.armor).stroke({ color: INK, width: 1.5 });
      body.roundRect(-16, -6, 5, 12, 1).fill(0x303d31);
      body.poly([-4, -18, 6, -17, 10, -10, -1, -8]).fill(p.light).stroke({ color: INK, width: 1.5 });
      body.roundRect(0, -8, 13, 13, 2).fill(p.armor).stroke({ color: p.metal, width: 1 });
      body.rect(10, -5, 4, 8).fill(INK);
      body.rect(12, -4, 1.5, 5).fill(def.color);
      for (let i = 0; i < 5; i++) body.rect(-6 + i * 3, 11, 2, 5).fill(0xc7ad73);
    }
    if (def.elite) {
      body.poly([-5, -19, 6, -17, 8, -11, -2, -10]).fill(p.light).stroke({ color: INK, width: 1.2 });
      body.poly([-4, 13, 5, 11, 8, 16, -2, 19]).fill(p.light).stroke({ color: INK, width: 1.2 });
      body.moveTo(-4, -15).lineTo(0, -12).lineTo(4, -15).stroke({ color: def.color, width: 1.5 });
      body.rect(-15, -6, 3, 12).fill(def.color);
    }
    // Character-specific top-down signatures echo their illustrated dossier art.
    if (!def.hostile) {
      if (def.id === 'NIX') {
        body.poly([-1, -8, 6, -10, 10, -6, 5, -4, 1, 1, -2, -2]).fill(0x121e23).stroke({ color: p.metal, width: .7 });
        body.moveTo(1, -7).lineTo(5, -6).lineTo(7, -3).stroke({ color: def.color, width: 1.4 });
        body.moveTo(-11, -7).lineTo(-16, -4).lineTo(-14, 7).stroke({ color: def.color, width: .8, alpha: .7 });
      } else if (def.id === 'BRASA') {
        body.poly([1, -9, 6, -10, 9, -4, 4, -2]).fill(0xb56c42).stroke({ color: 0xe8b984, width: .7 });
        body.poly([-5, -20, 4, -19, 7, -15, 4, -8, -4, -10]).fill(0x9b6940).stroke({ color: p.light, width: 1 });
        for (let i = 0; i < 3; i++) body.rect(-3 + i * 2.4, -17, 1.2, 5).fill({ color: def.color, alpha: .75 });
      } else if (def.id === 'VECTOR') {
        body.poly([-7, -10, -25, -14, -22, -4, -9, 0]).fill(0x28383f).stroke({ color: p.metal, width: 1 });
        body.poly([1, -8, 7, -8, 10, -5, 3, -3]).fill(0xdee0d8);
        body.circle(11, -6, 2).fill(def.color).stroke({ color: 0xe6dcfa, width: .7 });
      } else if (def.id === 'SUTURA') {
        body.ellipse(3, -2, 6, 5).fill(0x50352f).stroke({ color: 0xaf8675, width: .8 });
        body.roundRect(-14, -7, 3, 5, 1).fill(def.color);
      } else if (def.id === 'VOLT') {
        body.poly([0, -8, 5, -10, 10, -7, 8, -4, 3, -3]).fill(0xc0deeb).stroke({ color: def.color, width: 1 });
        body.moveTo(-13, -5).lineTo(-10, -2).lineTo(-13, 1).lineTo(-9, 5).stroke({ color: def.color, width: 1.3 });
      } else if (def.id === 'MORSA') {
        body.roundRect(-11, -15, 3, 9, 1).fill(0xc1ab76).stroke({ color: INK, width: .7 });
        body.moveTo(-10, -3).lineTo(-7, 2).lineTo(-8, 8).stroke({ color: p.light, width: 1.5 });
      }
      // A fine lit edge separates armor from the dark floor at mobile scale.
      body.moveTo(-6, -shoulder - 3).lineTo(1, -shoulder - 3).stroke({ color: p.light, width: 1.2, alpha: .85 });
    }
    // Small abrasion marks rather than a full neon outline.
    body.moveTo(-2, -11).lineTo(1, -10).moveTo(-6, 4).lineTo(-4, 3).stroke({ color: p.light, width: 0.6, alpha: 0.7 });
    this.torso.addChild(body);
    const paintedBody = renderer ? cachedArt(`operative:${def.id}`, this.torso, renderer) : this.torso;
    this.rig.addChild(paintedBody);
    if (paintedBody instanceof Sprite) {
      this.damageOverlay = new Sprite(paintedBody.texture);
      this.damageOverlay.position.copyFrom(paintedBody.position);
      this.damageOverlay.blendMode = 'add';
      this.damageOverlay.alpha = 0;
      this.rig.addChild(this.damageOverlay);
    }
    this.rig.addChild(this.weaponRig, this.lights, this.muzzleLight);
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
    } else if (this.def.id === 'MORSA' && type === 'PLASMA_RIFLE') {
      g.roundRect(13, 4, 13, 8, 1).fill(p.armor).stroke({ color: INK, width: 1 });
      g.rect(25, 6, m.x - 25, 4).fill(p.metal);
      g.ellipse(14, 12, 5, 4).fill(0x35452f).stroke({ color: p.metal, width: 1 });
      for (let i = 0; i < 3; i++) g.rect(17 + i * 3, 5, 1, 2).fill(p.light);
    } else if (type === 'PLASMA_RIFLE') {
      g.roundRect(15, 5, 11, 6, 1).fill(p.light).stroke({ color: INK, width: 1 });
      g.rect(25, 6, m.x - 25, 4).fill(p.metal);
      g.rect(18, 7, 10, 1.3).fill(this.def.color);
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
    for (const child of this.weaponRig.removeChildren()) if (child !== g) child.destroy();
    if (this.renderer) {
      // Keep the reusable drawing object; cachedArt owns and destroys its temporary container.
      const art = new Container();
      art.addChild(new Graphics(g.context.clone()));
      this.weaponRig.addChild(cachedArt(`weapon:${this.def.id}:${type}`, art, this.renderer));
    } else this.weaponRig.addChild(g);
    this.muzzleLight.clear().poly([m.x - 2, m.y - 2, m.x + 9, m.y, m.x - 2, m.y + 2]).fill(0xffe7b0);
    this.muzzleLight.blendMode = 'add';
    this.muzzleLight.visible = false;
  }

  animateMotion(dt: number, speed: number, recoil: number, h: HealthComponent, reloadProgress = 0): void {
    this.age += dt;
    this.stride += dt * Math.min(speed, 330) * 0.065;
    const moving = Math.min(1, speed / 100);
    this.feet.forEach((f, i) => {
      f.x = Math.sin(this.stride + i * Math.PI) * 3.4 * moving;
      f.rotation = Math.sin(this.stride + i * Math.PI) * 0.12 * moving;
    });
    this.rig.y = Math.sin(this.stride * 2) * 0.65 * moving;
    this.rig.x = -recoil * 0.8 + Math.sin(this.age * 2.3) * 0.22 * (1 - moving);
    this.rig.rotation = Math.sin(this.stride) * 0.028 * moving;
    this.rig.scale.set(1 + Math.sin(this.age * 2.3) * 0.008);
    this.weaponRig.x = -recoil * 3;
    this.weaponRig.rotation = reloadProgress > 0 ? -0.25 * Math.sin(reloadProgress * Math.PI) : recoil * -0.04;
    this.muzzleLight.visible = recoil > 0.65;
    this.muzzleLight.alpha = recoil;
    this.rig.tint = (h.hitFlash ?? 0) > 0 ? 0xffdfc6 : 0xffffff;
    if (this.damageOverlay) this.damageOverlay.alpha = Math.min(0.65, (h.hitFlash ?? 0) * 4);
  }

  animate(dt: number, speed: number, c: CharacterComponent, h: HealthComponent, reloadProgress = 0): void {
    this.animateMotion(dt, speed, c.recoil, h, reloadProgress);
    this.lights.alpha = c.activeRemaining > 0 ? 0.7 + Math.sin(this.age * 10) * 0.3 : 0.8;
    const e = this.effect.clear();
    const color = this.def.color;
    if (c.activeRemaining > 0 && h.hp > 0) {
      if (this.def.id === 'BRASA') {
        for (let i = 0; i < 6; i++) e.arc(0, 0, 23, i * Math.PI / 3 + 0.1, (i + 1) * Math.PI / 3 - 0.1).stroke({ color, width: (h.hitFlash ?? 0) > 0 ? 3 : 1.6, alpha: 0.7 });
      } else if (this.def.id === 'VECTOR') {
        const r = 24 + ((this.age * 22) % 18);
        e.arc(0, 0, r, -0.65, 0.65).stroke({ color, alpha: 0.35, width: 1 });
      } else if (this.def.id === 'SUTURA') {
        e.circle(0, 0, 24).stroke({ color, width: 1, alpha: 0.35 });
        e.rect(-3, -24, 6, 12).rect(-6, -21, 12, 6).fill({ color, alpha: 0.65 });
      } else if (this.def.id === 'VOLT') {
        const r = Math.min(c.def.ability.pulseRadius ?? 170, 20 + (c.def.ability.duration - c.activeRemaining) * 220);
        e.circle(0, 0, r).stroke({ color, width: 1.6, alpha: Math.max(0.05, 0.6 - (r / 170) * 0.5) });
      } else if (this.def.id === 'MORSA') {
        e.poly([-20, -20, 20, -20, 24, -12, 24, 12, 20, 20, -20, 20]).stroke({ color, width: 2, alpha: 0.6 });
      } else {
        e.moveTo(-22, -10).lineTo(-12, -10).moveTo(-22, 10).lineTo(-12, 10).stroke({ color, width: 1.2, alpha: 0.6 });
      }
    }
    if (c.activationFlash > 0) e.circle(0, 0, 18 + (0.5 - c.activationFlash) * 24).stroke({ color, width: 1.5, alpha: c.activationFlash });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    // The construction-only gun is not a child when its cached sprite is used.
    if (this.renderer) this.gun.destroy();
    super.destroy(typeof options === 'object' ? { ...options, context: true } : { children: !!options, context: true });
  }
}
