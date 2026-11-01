import { Application } from 'pixi.js';
import { COLORS, FIXED_DT, MAX_FRAME_DT, MAX_PIXEL_RATIO } from '../config';
import type { System } from '../ecs/System';
import { World } from '../ecs/World';

/**
 * Owns the Pixi app, the world and the system pipeline.
 * Simulation runs at a fixed FIXED_DT; rendering runs once per displayed frame with an
 * interpolation alpha, so motion stays smooth on 60/120/144 Hz displays alike.
 */
export class Game {
  readonly world = new World();
  readonly app = new Application();
  private readonly systems: System[] = [];
  private accumulator = 0;

  /** Systems run in registration order: this is the pipeline order. */
  addSystem(system: System): this {
    this.systems.push(system);
    return this;
  }

  async start(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution: pixelRatio(),
      autoDensity: true,
      antialias: true,
      background: COLORS.background,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);

    for (const system of this.systems) system.init?.();

    const resize = (width: number, height: number): void => {
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      // Resolution is re-read so dragging the window to another monitor re-sharpens the canvas.
      this.app.renderer.resize(w, h, pixelRatio());
      for (const system of this.systems) system.resize?.(w, h);
    };
    resize(host.clientWidth, host.clientHeight);
    new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) resize(rect.width, rect.height);
    }).observe(host);

    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS / 1000));
  }

  private frame(rawDt: number): void {
    const frameDt = Math.min(rawDt, MAX_FRAME_DT);
    this.accumulator += frameDt;
    while (this.accumulator >= FIXED_DT) {
      for (const system of this.systems) system.update?.(this.world, FIXED_DT);
      this.world.flush();
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;
    for (const system of this.systems) system.render?.(this.world, alpha, frameDt);
  }
}

function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}
