import { Container, Graphics, Sprite, type Renderer } from 'pixi.js';
import type { OperativeAppearance } from './enemyAppearances';
import { cachedArt } from '../render/artCache';
import { weaponMuzzle } from './weaponPose';
import type { WeaponDefinition } from '../types';
import { weaponVisual } from './weaponVisual';
import { motionStyle } from './motion';
import type { CharacterComponent, HealthComponent } from '../ecs/components';

const INK = 0x0b1115;

/** Layered top-down art. +X is forward; the root alone is rotated by the renderer. */
export class OperativeGraphic extends Container {
  private readonly rig = new Container();
  private readonly feet = [new Graphics(), new Graphics()];
  private readonly gun = new Graphics();
  private readonly effect = new Graphics();
  private readonly hitEffect = new Graphics();
  private readonly reloadHand = new Graphics();
  private readonly reloadMagazine = new Graphics();
  private readonly lights = new Graphics();
  private readonly muzzleLight = new Graphics();
  private readonly torso = new Container();
  private readonly weaponRig = new Container();
  private readonly renderer?: Renderer;
  private damageOverlay?: Sprite;
  private weaponKey = '';
  get equippedWeaponId(): string { return this.weaponKey; }
  private stride = 0;
  private age = 0;
  private readonly def: OperativeAppearance;

  constructor(def: OperativeAppearance, weapon: WeaponDefinition, renderer?: Renderer) {
    super();
    this.def = def;
    this.renderer = renderer;
    const p = def.palette;
    const heavy = def.id === 'BRASA' || def.id === 'MORSA' || def.silhouette === 'HEAVY';
    const scout = def.id === 'VECTOR' || def.silhouette === 'SCOUT';
    const shoulder = heavy ? 13 : scout ? 11 : 9;
    const shadow = new Graphics().ellipse(3, 6, heavy ? 26 : 23, heavy ? 22 : 19).fill({ color: 0x000000, alpha: 0.2 })
      .ellipse(1, 3, heavy ? 20 : 17, heavy ? 18 : 15).fill({ color: 0x000000, alpha: 0.52 });
    this.addChild(shadow, this.effect, this.rig, this.hitEffect);
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
    // A restrained key light catches machined edges; the cloth stays matte and dark.
    body.moveTo(-6,-shoulder-3).lineTo(1,-shoulder-3).lineTo(4,-shoulder+1).stroke({color:p.light,width:1.2,alpha:.8});
    body.moveTo(-7,shoulder+3).lineTo(-1,shoulder+3).stroke({color:p.metal,width:1,alpha:.65});
    body.moveTo(0,-7).lineTo(7,-7).stroke({color:p.light,width:1,alpha:.7});
    this.torso.addChild(body);
    const paintedBody = renderer ? cachedArt(`operative:${def.id}:${def.look?.skin ?? 'FIELD'}`, this.torso, renderer) : this.torso;
    this.rig.addChild(paintedBody);
    if (paintedBody instanceof Sprite) {
      this.damageOverlay = new Sprite(paintedBody.texture);
      this.damageOverlay.position.copyFrom(paintedBody.position);
      this.damageOverlay.blendMode = 'add';
      this.damageOverlay.alpha = 0;
      this.rig.addChild(this.damageOverlay);
    }
    this.rig.addChild(this.weaponRig, this.lights, this.muzzleLight);
    this.reloadHand.roundRect(-3, -2.5, 6, 5, 1.5).fill(p.metal).stroke({ color: INK, width: .8 });
    this.reloadMagazine.roundRect(-2, -4, 4, 8, .6).fill(p.armor).stroke({ color: p.light, width: .8 });
    this.rig.addChild(this.reloadMagazine, this.reloadHand);
    this.reloadHand.visible = this.reloadMagazine.visible = false;
    this.lights.roundRect(-4, -shoulder - 1, 4, 1.6, 0.5).fill(def.color);
    this.lights.roundRect(-4, shoulder, 3, 1.6, 0.5).fill(def.color);
    this.setWeapon(weapon);
  }

  setWeapon(weapon: WeaponDefinition): void {
    if (this.weaponKey === weapon.id) return;
    this.weaponKey = weapon.id;
    const v = weaponVisual(weapon);
    const finish = this.def.look?.weapon ?? 'FACTORY';
    const shell = finish === 'COPPER' ? 0xb58055 : finish === 'ION' ? 0x243d53 : this.def.palette.metal;
    const light = finish === 'ION' ? 0x7df3ef : finish === 'COPPER' ? 0xf5d19b : v.color;
    const m = weaponMuzzle(weapon), g = this.gun.clear();
    const y = m.y, half = v.width / 2;
    g.roundRect(8, y - 2, 12, 5, 1).fill(INK).stroke({ color: shell, width: .8 });
    g.poly([12, y + 2, 17, y + 2, 15, y + 8, 12, y + 7]).fill(shell).stroke({ color: INK, width: .7 });
    g.roundRect(15, y - half, Math.max(4, m.x - 18), v.width, 1).fill(shell).stroke({ color: INK, width: 1 });
    switch (v.style) {
      case 'PISTOL':
        g.roundRect(12, y - 3, 8, 5, 1).fill(this.def.palette.light);
        g.rect(15, y - 2, 3, 1).fill(light);
        break;
      case 'SUPPRESSED':
        g.roundRect(m.x - 12, y - 3.4, 12, 6.8, 1).fill(0x18292e).stroke({ color: shell, width: .8 });
        g.rect(17, y + 3, 4, 5).fill(0x31454a);
        g.moveTo(16, y - 1).lineTo(23, y - 1).stroke({ color: light, width: 1 });
        break;
      case 'ARC':
        for (let i = 0; i < 3; i++) g.ellipse(20 + i * 2.7, y, 1.8, 4.3).stroke({ color: light, width: 1 });
        g.rect(16, y + 3, 4, 7).fill(0xb59e53).stroke({ color: INK, width: .8 });
        break;
      case 'COMPACT':
        g.poly([8, y - 2, 12, y - 5, 14, y - 4, 11, y + 1]).fill(shell);
        g.rect(17, y + 3, 3, 7).fill(0x26383d);
        g.rect(19, y - 2, 5, 1).fill(light);
        break;
      case 'BELT':
        g.roundRect(14, y - 5, 14, 10, 2).fill(shell).stroke({ color: INK, width: 1 });
        g.ellipse(18, y + 7, 6, 4).fill(0x374232).stroke({ color: shell, width: 1 });
        for (let i = 0; i < 5; i++) g.rect(22 + i * 2.3, y - 5, 1.2, 3).fill(0xd4b779);
        g.rect(30, y - 2, 9, 4).fill(0x26352c);
        break;
      case 'PUMP':
        g.rect(21, y - 4, 8, 8).fill(0xa87c4f).stroke({ color: INK, width: .8 });
        for (let i = 0; i < 4; i++) g.moveTo(22 + i * 1.8, y - 3).lineTo(22 + i * 1.8, y + 3).stroke({ color: INK, width: .7 });
        g.rect(29, y - 1, 3, 2).fill(light);
        break;
      case 'DOUBLE':
        g.rect(20, y - 3, 14, 2).rect(20, y + 1, 14, 2).fill(0x8c8196).stroke({ color: INK, width: .5 });
        g.moveTo(16, y).lineTo(30, y).stroke({ color: light, width: 1.3 });
        break;
      case 'LANCE':
      case 'HEAVY_RAIL':
        g.rect(24, y - half, m.x - 24, 1.6).rect(24, y + half - 1.6, m.x - 24, 1.6).fill(this.def.palette.light);
        g.moveTo(24, y).lineTo(m.x - 1, y).stroke({ color: light, width: v.style === 'LANCE' ? 1 : 2 });
        g.roundRect(16, y - half - 3, v.style === 'LANCE' ? 10 : 14, 3, 1).fill(INK).stroke({ color: shell, width: .8 });
        g.circle(24, y - half - 1, 1.3).fill(light);
        if (v.style === 'HEAVY_RAIL') for (let i = 0; i < 3; i++) g.rect(26 + i * 5, y - half - 1, 2, v.width + 2).fill(shell);
        break;
      default:
        g.rect(18, y - 2, 11, 1.5).fill(light);
        g.rect(23, y + 3, 4, 5).fill(shell).stroke({ color: INK, width: .8 });
    }
    g.rect(m.x - 1, y - 1.5, 1.2, 3).fill(INK);
    for (const child of this.weaponRig.removeChildren()) if (child !== g) child.destroy();
    if (this.renderer) {
      const art = new Container();
      art.addChild(new Graphics(g.context.clone()));
      this.weaponRig.addChild(cachedArt(`weapon:${this.def.id}:${this.def.look?.skin}:${weapon.id}:${finish}`, art, this.renderer));
    } else this.weaponRig.addChild(g);
    this.muzzleLight.clear().poly([m.x - 2, m.y - 2, m.x + 9, m.y, m.x - 2, m.y + 2]).fill(0xffe7b0);
    this.muzzleLight.blendMode = 'add';
    this.muzzleLight.visible = false;
  }

  animateMotion(dt: number, speed: number, recoil: number, h: HealthComponent, reloadProgress = 0): void {
    const style = motionStyle(this.def.id);
    this.age += dt;
    this.stride += dt * Math.min(speed, 330) * style.stride;
    const moving = Math.min(1, speed / 100);
    this.feet.forEach((f, i) => {
      f.x = Math.sin(this.stride + i * Math.PI) * style.step * moving;
      f.rotation = Math.sin(this.stride + i * Math.PI) * 0.12 * moving;
    });
    const hit = Math.min(1, (h.hitFlash ?? 0) / .18);
    this.rig.y = Math.sin(this.stride * 2) * style.bob * moving;
    this.rig.x = -recoil * 0.8 + Math.sin(this.age * 2.3) * 0.22 * (1 - moving) - hit * 3;
    this.rig.rotation = Math.sin(this.stride) * style.sway * moving + Math.sin(hit * 12) * hit * .09;
    this.rig.scale.set(1 + Math.sin(this.age * 2.3) * 0.008);
    this.weaponRig.x = -recoil * 3;
    const reload = Math.sin(reloadProgress * Math.PI);
    this.weaponRig.rotation = reloadProgress > 0 ? style.reloadTilt * reload : recoil * -0.04;
    this.reloadHand.visible = this.reloadMagazine.visible = reloadProgress > 0;
    this.reloadHand.position.set(4 + reload * style.handReach, 15 - reload * 6);
    this.reloadMagazine.position.set(5 + reload * (style.handReach - 2), 21 - reload * 9);
    this.reloadMagazine.rotation = reload * (this.def.id === 'VOLT' ? Math.PI : -.5);
    this.muzzleLight.visible = recoil > 0.65;
    this.muzzleLight.alpha = recoil;
    this.rig.tint = (h.hitFlash ?? 0) > 0 ? 0xffdfc6 : 0xffffff;
    if (this.damageOverlay) this.damageOverlay.alpha = Math.min(0.65, (h.hitFlash ?? 0) * 4);
    const broken = h.shieldBreak ?? 0;
    this.hitEffect.clear();
    if (broken > 0) {
      const radius = 24 + (.48 - broken) * 42;
      for (let i = 0; i < 6; i++) this.hitEffect.arc(0, 0, radius, i * Math.PI / 3 + .12, (i + 1) * Math.PI / 3 - .12)
        .stroke({ color: 0xadeeff, width: 1.5, alpha: broken * 1.7 });
    }
  }

  animate(dt: number, speed: number, c: CharacterComponent, h: HealthComponent, reloadProgress = 0): void {
    this.animateMotion(dt, speed, c.recoil, h, reloadProgress);
    this.lights.alpha = c.activeRemaining > 0 ? 0.7 + Math.sin(this.age * 10) * 0.3 : 0.8;
    const e = this.effect.clear();
    const color = this.def.color;
    if (c.activeRemaining > 0 && h.hp > 0) {
      if (this.def.id === 'BRASA') {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, r = 25 + Math.sin(this.age * 4 + i) * 1.4;
          const points: number[] = [];
          for (const [radius, angle] of [[r, a - .38], [r + 5, a - .3], [r + 5, a + .3], [r, a + .38]]) points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
          e.poly(points).fill({ color, alpha: .15 + Math.min(.4, (h.hitFlash ?? 0) * 2) }).stroke({ color, width: 1.4, alpha: .85 });
        }
      } else if (this.def.id === 'VECTOR') {
        const r = 24 + ((this.age * 22) % 18);
        e.arc(0, 0, r, -0.65, 0.65).stroke({ color, alpha: 0.35, width: 1 });
      } else if (this.def.id === 'SUTURA') {
        for (let i = 0; i < 3; i++) {
          const a = this.age * 1.7 + i * Math.PI * 2 / 3;
          const x = Math.cos(a) * 29, y = Math.sin(a) * 29;
          const beamColor = c.augments?.repairShield ? 0x9ee5df : color;
          e.moveTo(x, y).lineTo(0, 0).stroke({ color: beamColor, width: 1, alpha: .4 + Math.sin(this.age * 12 + i) * .2 });
          e.ellipse(x + 1, y + 3, 7, 3).fill({ color: 0x000000, alpha: .22 });
          e.poly([x - 6, y, x - 2, y - 4, x + 4, y - 3, x + 6, y + 1, x, y + 4]).fill(0xdce1d1).stroke({ color: 0x2a3f43, width: 1 });
          e.circle(x, y, 1.8).fill(beamColor);
        }
      } else if (this.def.id === 'VOLT') {
        const r = Math.min(c.def.ability.pulseRadius ?? 170, 20 + (c.def.ability.duration - c.activeRemaining) * 220);
        e.circle(0, 0, r).stroke({ color, width: 1.6, alpha: Math.max(0.05, 0.6 - (r / (c.def.ability.pulseRadius ?? 170)) * 0.5) });
      } else if (this.def.id === 'MORSA') {
        e.poly([-20, -20, 20, -20, 24, -12, 24, 12, 20, 20, -20, 20]).stroke({ color, width: 2, alpha: 0.6 });
        for (const side of [-1, 1]) e.poly([-12, side * 10, -27, side * 19, -30, side * 23, -18, side * 22]).fill({ color: 0xa4ac86, alpha: .7 }).stroke({ color, width: 1 });
      } else {
        for (let i = 0; i < 5; i++) e.rect(-24 - i * 3, -12 + i * 5, 10 + i % 2 * 5, 2).fill({ color, alpha: .2 + Math.sin(this.age * 16 + i) * .1 });
        this.rig.alpha = .45 + Math.sin(this.age * 11) * .1;
      }
    }
    if (this.def.id !== 'NIX' || c.activeRemaining <= 0) this.rig.alpha = 1;
    if (c.activationFlash > 0) e.circle(0, 0, 18 + (0.5 - c.activationFlash) * 24).stroke({ color, width: 1.5, alpha: c.activationFlash });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    // The construction-only gun is not a child when its cached sprite is used.
    if (this.renderer) this.gun.destroy();
    super.destroy(typeof options === 'object' ? { ...options, context: true } : { children: !!options, context: true });
  }
}
