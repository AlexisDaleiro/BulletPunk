import { Container, Graphics } from 'pixi.js';
import type { ChestCategory, ChestFamily } from '../world/plan';

export type ChestState = 'CLOSED' | 'OPENING' | 'LOOTED';

const INK = 0x0b1014;
/** Special-case trim by rarity: steel and cyan, reinforced amber, black chrome and magenta. */
const TRIM = [0x35e8ff, 0xffd23f, 0xff4fa3] as const;
const BODY = [0x59636a, 0x6a6a5e, 0x2a2d33] as const;

/**
 * A chest drawn from parts: a body, a lid that lifts, an interior that lights up and a few LEDs.
 * Supply caches are low, soft-edged and marked by what they hold (ammo crate, med case, lockbox);
 * special cases are wide armored shells whose latches, brackets and LED count grow with rarity.
 */
export class ChestGraphic extends Container {
  private readonly lid = new Graphics();
  private readonly glow = new Graphics();
  private readonly leds = new Graphics();
  private readonly family: ChestFamily;
  private readonly category: ChestCategory;
  private readonly tier: 1 | 2 | 3;
  private readonly w: number;
  private readonly h: number;
  private age = 0;

  constructor(family: ChestFamily, category: ChestCategory, tier: 1 | 2 | 3) {
    super();
    this.family = family;
    this.category = category;
    this.tier = tier;
    const special = family === 'SPECIAL';
    this.w = special ? 38 : 30;
    this.h = special ? 26 : 20;
    const { w, h } = this;

    const body = new Graphics();
    body.roundRect(-w / 2 + 2, -h / 2 + 4, w, h, 4).fill({ color: 0x000000, alpha: 0.35 });
    this.addChild(body, this.glow, this.lid, this.leds);

    if (special) {
      const base = BODY[tier - 1];
      body.roundRect(-w / 2, -h / 2, w, h, 3).fill(base).stroke({ color: INK, width: 2 });
      for (let i = 0; i < 4; i++) body.rect(-w / 2 + 2, -h / 2 + 4 + i * 5, w - 4, 1).fill({ color: 0xffffff, alpha: 0.07 });
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) body.poly([cx * w / 2, cy * (h / 2 - 7), cx * w / 2, cy * h / 2, cx * (w / 2 - 7), cy * h / 2]).fill({ color: INK, alpha: 0.75 });
      if (tier === 2) for (let i = 0; i < 4; i++) body.poly([-w / 2 + 4 + i * 8, h / 2 - 1, -w / 2 + 9 + i * 8, h / 2 - 1, -w / 2 + 12 + i * 8, h / 2 - 5, -w / 2 + 7 + i * 8, h / 2 - 5]).fill({ color: TRIM[1], alpha: 0.8 });
      if (tier === 3) body.rect(-w / 2 + 4, h / 2 - 5, w - 8, 2).fill({ color: TRIM[2], alpha: 0.9 });
    } else {
      const tone = category === 'AMMO' ? 0x4f5a3a : category === 'MED' ? 0xcfd8d6 : 0x3b4249;
      body.roundRect(-w / 2, -h / 2, w, h, category === 'MED' ? 6 : 2).fill(tone).stroke({ color: INK, width: 1.8 });
      if (category === 'AMMO') for (const x of [-9, 9]) body.rect(x - 1.5, -h / 2 + 2, 3, h - 4).fill({ color: 0x1e2417, alpha: 0.7 });
      if (category === 'CREDITS') body.circle(0, 3, 4).fill(0x1b2024).stroke({ color: 0xb7c0c4, width: 1 });
    }
    this.drawLid();
    this.drawLeds(true);
    this.glow.blendMode = 'add';
  }

  private drawLid(): void {
    const { w, h, tier } = this;
    const special = this.family === 'SPECIAL';
    const lid = this.lid.clear();
    const tone = special ? BODY[tier - 1] : this.category === 'AMMO' ? 0x5d6945 : this.category === 'MED' ? 0xe4ecea : 0x4a525a;
    lid.roundRect(-w / 2, -h / 2, w, h * 0.55, 3).fill(tone).stroke({ color: INK, width: 1.8 });
    lid.rect(-w / 2 + 2, -h / 2 + 2, w - 4, 3).fill({ color: 0xffffff, alpha: 0.2 });
    if (special) {
      const latches = tier;
      for (let i = 0; i < latches; i++) {
        const x = (i - (latches - 1) / 2) * 11;
        lid.roundRect(x - 3, h * 0.55 - h / 2 - 5, 6, 8, 1).fill(0x1d2328).stroke({ color: TRIM[tier - 1], width: 1.2 });
      }
    } else if (this.category === 'AMMO') {
      lid.rect(-3, -h / 2, 6, h * 0.55).fill(0xd7b04a);
      lid.poly([-2, -2, 2, -2, 2, 3, -2, 3]).fill({ color: 0x3a3320, alpha: 0.8 });
    } else if (this.category === 'MED') {
      lid.rect(-2.5, -h / 2 + 3, 5, 9).fill(0xe0457a).rect(-6.5, -h / 2 + 5, 13, 5).fill(0xe0457a);
    } else {
      lid.rect(-w / 2 + 3, h * 0.55 - h / 2 - 4, w - 6, 3).fill(0x1b2024);
    }
  }

  private drawLeds(lit: boolean): void {
    const leds = this.leds.clear();
    const special = this.family === 'SPECIAL';
    const color = special ? TRIM[this.tier - 1] : this.category === 'AMMO' ? 0xffb347 : this.category === 'MED' ? 0x4fdc8a : 0x35e8ff;
    const n = special ? this.tier : 1;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 7;
      leds.circle(x, this.h / 2 + 4, 2).fill({ color: lit ? color : 0x20262b, alpha: lit ? 1 : 0.8 });
      if (lit) leds.circle(x, this.h / 2 + 4, 5).fill({ color, alpha: 0.18 });
    }
  }

  /** Lid lift, interior light and LED blink for the given state. `t` is seconds spent opening (0..0.5 plays the lift). */
  animate(state: ChestState, t: number, dt: number): void {
    this.age += dt;
    const { w, h, tier } = this;
    if (state === 'CLOSED') {
      // A slow pulse on the LEDs: closed cases look alive, looted ones go dark.
      this.leds.alpha = this.tier >= 2 || this.family === 'SPECIAL' ? 0.65 + 0.35 * Math.sin(this.age * (2 + tier)) : 0.85;
      return;
    }
    const p = state === 'LOOTED' ? 1 : Math.min(1, t / 0.45);
    const ease = 1 - (1 - p) * (1 - p);
    this.lid.position.set(0, -ease * 11);
    this.lid.rotation = -ease * 0.5;
    this.lid.alpha = 1 - 0.25 * ease;
    this.glow.clear();
    const color = this.family === 'SPECIAL' ? TRIM[tier - 1] : 0xfff0c2;
    if (state === 'OPENING') this.glow.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3).fill({ color, alpha: 0.75 * Math.sin(p * Math.PI) + 0.1 });
    else this.glow.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3).fill({ color: 0x050709, alpha: 0.85 });
    this.glow.blendMode = state === 'OPENING' ? 'add' : 'normal';
    if (state === 'LOOTED') {
      this.drawLeds(false);
      this.leds.alpha = 1;
    }
  }
}
