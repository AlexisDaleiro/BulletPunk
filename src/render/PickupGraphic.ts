import { Container, Graphics, Text, type Renderer } from 'pixi.js';
import type { PickupComponent } from '../ecs/components';
import { cachedArt } from './artCache';
import { pickupAppearance, type PickupAppearance } from './pickupAppearance';

/** A physical item, with grounded shadow and a restrained proximity label. */
export class PickupGraphic extends Container {
  private readonly item = new Container();
  private readonly halo: Graphics;
  private readonly shadow: Graphics;
  private itemLabel: Text | null = null;
  private readonly appearance: PickupAppearance;

  constructor(p: PickupComponent, renderer: Renderer) {
    super();
    const a = this.appearance = pickupAppearance(p);
    this.shadow = new Graphics().ellipse(1, 5, p.kind === 'WEAPON' ? 22 : 14, 6).fill({ color: 0x000000, alpha: 0.45 });
    this.halo = new Graphics().ellipse(0, 4, p.kind === 'WEAPON' ? 24 : 17, 10).fill({ color: a.color, alpha: 0.08 }).stroke({ color: a.color, width: 0.8, alpha: 0.45 });
    this.addChild(this.shadow, this.halo, this.item);
    const g = new Graphics();
    const ink = 0x141e26;
    if (p.kind === 'WEAPON') {
      g.rotation = -0.35;
      const long = a.weaponType === 'RAILGUN' ? 24 : a.weaponType === 'PISTOL' ? 8 : 18;
      g.poly([-15, -3, -7, -3, -7, 4, -16, 5]).fill(0x6b7071).stroke({ color: ink, width: 1.4 });
      g.roundRect(-8, -4, 19, 9, 1.5).fill(0xb3b8ad).stroke({ color: ink, width: 1.5 });
      g.rect(9, -2, long - 4, 4).fill(0x778c91).stroke({ color: ink, width: 1 });
      g.rect(long + 4, -3, 3, 6).fill(0x40515b);
      g.poly([-4, 4, 1, 4, -1, 12, -6, 11]).fill(0x46565f).stroke({ color: ink, width: 1 });
      g.rect(-5, -2, 7, 1.5).fill(a.color);
      if (a.weaponType === 'SHOTGUN') {
        g.roundRect(4, -4, 10, 9, 1).fill(0x8f6c4b).stroke({ color: ink, width: 1 });
        for (let i = 0; i < 3; i++) g.moveTo(6 + i * 3, -3).lineTo(6 + i * 3, 4).stroke({ color: ink, width: 1 });
      } else if (a.weaponType === 'RAILGUN') {
        g.roundRect(6, -4, 22, 8, 1).fill(0x536b83).stroke({ color: ink, width: 1 });
        g.rect(10, -1, 19, 1.8).fill(0xc4bcf3);
        for (let i = 0; i < 3; i++) g.rect(13 + i * 4, -4, 1.5, 8).fill(0xa8b9c5);
        g.roundRect(-1, -8, 11, 4, 1).fill(0x273b49).stroke({ color: 0x92acb5, width: 0.7 });
        g.rect(10, -0.5, 16, 1).fill(0xb8c9ef);
      } else if (a.weaponType === 'SMG') {
        g.rect(0, 4, 5, 10).fill(0x586e78).stroke({ color: ink, width: 1 });
        g.roundRect(17, -3.5, 6, 7, 1).fill(0x293c44).stroke({ color: 0x82969a, width: 0.7 });
      }
    } else if (p.kind === 'AMMO') {
      g.roundRect(-11, -9, 22, 18, 2).fill(0x4d6564).stroke({ color: ink, width: 1.5 });
      g.rect(-10, 2, 20, 6).fill(0x2a3d42);
      for (let i = 0; i < 4; i++) {
        const x = -8 + i * 5;
        g.roundRect(x, -8, 3.5, 11, 1).fill(0xd0b283).stroke({ color: 0x685742, width: 0.7 });
        g.poly([x, -8, x + 1.75, -12, x + 3.5, -8]).fill(0xf0d8ab);
      }
    } else if (p.kind === 'HEAL') {
      g.roundRect(-12, -9, 24, 19, 3).fill(0xcad6cd).stroke({ color: ink, width: 1.5 });
      g.roundRect(-5, -13, 10, 5, 1).stroke({ color: 0x849b9c, width: 2 });
      g.rect(-12, 4, 24, 5).fill(0x7a9493);
      g.rect(-3, -6, 6, 12).rect(-6, -3, 12, 6).fill(0xce576e);
      g.rect(9, -5, 2, 8).fill(0xe5ebe0);
    } else if (p.kind === 'KEY') {
      g.roundRect(-13, -9, 26, 18, 2).fill(0xd7dfcf).stroke({ color: ink, width: 1.5 });
      g.rect(-12, -8, 24, 5).fill(a.color);
      g.rect(-9, -1, 7, 6).fill(0x957c48).stroke({ color: 0xc7b06f, width: 0.6 });
      g.moveTo(1, 0).lineTo(9, 0).moveTo(1, 3).lineTo(7, 3).stroke({ color: 0x6d8388, width: 1 });
      g.rect(9, 5, 2, 2).fill(a.color);
    } else if (p.kind === 'IMPLANT') {
      g.roundRect(-10, -10, 20, 20, 2).fill(0x405b66).stroke({ color: ink, width: 1.5 });
      for (const side of [-1, 1]) for (let i = -6; i <= 6; i += 4) g.rect(side < 0 ? -13 : 10, i, 3, 2).fill(0xc2ad7f);
      g.roundRect(-6, -6, 12, 12, 2).fill(0x1a2537).stroke({ color: a.color, width: 1 });
      g.poly([0, -4, 4, 0, 0, 4, -4, 0]).fill(0xcdbbff);
      g.moveTo(-8, 7).lineTo(0, 7).lineTo(0, 10).stroke({ color: 0x8db5ac, width: 0.8 });
    } else {
      for (let i = 0; i < 3; i++) {
        const x = -10 + i * 6, y = 3 - i * 4;
        g.roundRect(x, y, 12, 9, 1).fill(0x528779).stroke({ color: ink, width: 1 });
        g.roundRect(x, y - 2, 12, 7, 1).fill(0xd6c085).stroke({ color: 0x756747, width: 0.8 });
        g.rect(x + 3, y, 6, 1).fill(0x655d43);
      }
    }
    const art = new Container();
    art.addChild(g);
    this.item.addChild(cachedArt(a.cacheKey, art, renderer));
  }

  animate(age: number, phase: number, nearby: boolean): void {
    const landing = Math.max(0, 1 - age / 0.4);
    this.item.y = -Math.sin(landing * Math.PI) * 10 + Math.sin(age * 2 + phase) * 0.65;
    this.item.rotation = landing * Math.sin(phase) * 0.25;
    this.item.scale.set(1 + landing * 0.12);
    this.shadow.alpha = 1 - landing * 0.5;
    this.halo.alpha = 0.65 + Math.sin(age * 2.4 + phase) * 0.2;
    if (nearby && !this.itemLabel) {
      this.itemLabel = new Text({ text: this.appearance.name, style: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: 0xe5e9dc, stroke: { color: 0x101820, width: 3 } } });
      this.itemLabel.anchor.set(0.5, 1);
      this.itemLabel.y = -20;
      this.addChild(this.itemLabel);
    }
    if (this.itemLabel) this.itemLabel.visible = nearby;
  }
}
