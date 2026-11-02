import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { visionFan } from '../vision/cone';

/** A soft flashlight fan and a readable contour, both cut to the existing line of sight. */
export class VisionConeGraphic extends Container {
  private readonly light: Sprite;
  private readonly clip = new Graphics();
  private readonly contour = new Graphics();
  private readonly fan: number[] = [];

  constructor() {
    super();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,240,201,0.21)');
    gradient.addColorStop(0.55, 'rgba(255,240,201,0.10)');
    gradient.addColorStop(0.95, 'rgba(255,240,201,0.045)');
    gradient.addColorStop(1, 'rgba(255,240,201,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    this.light = new Sprite(Texture.from(canvas));
    this.light.blendMode = 'add';
    this.light.setMask({ mask: this.clip });
    this.addChild(this.light, this.clip, this.contour);
  }

  update(polygon: readonly number[], x: number, y: number, angle: number, fov: number, range: number): void {
    const fan = visionFan(polygon, x, y, angle, fov, this.fan);
    this.visible = fan.length >= 6;
    this.clip.clear();
    this.contour.clear();
    if (!this.visible) return;
    this.light.position.set(x - range, y - range);
    this.light.width = this.light.height = range * 2;
    this.clip.poly(fan).fill(0xffffff);
    this.contour.poly(fan).fill({ color: 0xffebc2, alpha: 0.018 }).stroke({ color: 0xe9e4c8, alpha: 0.24, width: 0.9 });
  }
}
