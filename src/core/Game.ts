import { Application } from 'pixi.js';
import { COLORS, FIXED_DT, MAX_FRAME_DT, MAX_PIXEL_RATIO } from '../config';
import type { System } from '../ecs/System';
import { World } from '../ecs/World';
import { PauseReasons, type PauseReason } from './pause';

/**
 * Owns the Pixi app, the world and the system pipeline.
 * Simulation runs at a fixed FIXED_DT; rendering runs once per displayed frame with an
 * interpolation alpha, so motion stays smooth on 60/120/144 Hz displays alike.
 */
export class Game {
  onFrame: ((frameMs: number, workMs: number) => void) | null = null;
  lastWorkMs = 0;
  readonly world = new World();
  readonly app = new Application();
  /** Cap on devicePixelRatio for the canvas; change it with `setPixelRatio`. */
  maxPixelRatio: number = MAX_PIXEL_RATIO;
  private readonly systems: System[] = [];
  private readonly pauseReasons = new PauseReasons();
  private host: HTMLElement | null = null;
  private ready = false;
  private accumulator = 0;
  /** Set on resume so the first frame after a pause (whose delta spans the pause) is dropped. */
  private discardFrame = false;
  private inStep = false;
  get stepping(): boolean {
    return this.inStep;
  }

  /** While any reason holds (a menu, a phone held upright, a hidden tab), frames are skipped entirely. */
  get paused(): boolean {
    return this.pauseReasons.paused;
  }

  setPause(reason: PauseReason, on: boolean): void {
    if (on) {
      this.pauseReasons.add(reason);
    } else if (this.pauseReasons.delete(reason)) {
      this.accumulator = 0;
      this.discardFrame = true;
    }
    if (this.ready) {
      if (this.paused) this.app.stop();
      else this.app.start();
    }
  }

  refresh(): void {
    for (const system of this.systems) system.render?.(this.world, 1, 0);
    if (this.ready) this.app.render();
  }

  /** Systems run in registration order: this is the pipeline order. */
  addSystem(system: System): this {
    this.systems.push(system);
    return this;
  }

  async start(host: HTMLElement, antialias = true): Promise<void> {
    this.host = host;
    await this.app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution: this.pixelRatio(),
      autoDensity: true,
      antialias,
      background: COLORS.background,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.ready = true;

    for (const system of this.systems) system.init?.();

    this.resize(host.clientWidth, host.clientHeight);
    new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) this.resize(rect.width, rect.height);
    }).observe(host);

    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS / 1000));
    if (this.paused) this.app.stop();
  }

  setPixelRatio(ratio: number): void {
    if (this.maxPixelRatio === ratio) return;
    this.maxPixelRatio = ratio;
    if (this.host) this.resize(this.host.clientWidth, this.host.clientHeight);
  }

  private resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    // Resolution is re-read so dragging the window to another monitor re-sharpens the canvas.
    this.app.renderer.resize(w, h, this.pixelRatio());
    for (const system of this.systems) system.resize?.(w, h);
    if (this.ready && this.paused) this.refresh();
  }

  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
  }

  private frame(rawDt: number): void {
    if (this.paused) return;
    if (this.discardFrame) {
      this.discardFrame = false;
      return;
    }
    const frameDt = Math.min(rawDt, MAX_FRAME_DT);
    const started = performance.now();
    this.accumulator += frameDt;
    while (this.accumulator >= FIXED_DT) {
      this.inStep = true;
      for (const system of this.systems) {
        system.update?.(this.world, FIXED_DT);
        if (this.paused) break;
      }
      this.world.flush();
      this.inStep = false;
      for (const system of this.systems) system.afterStep?.(this.world, FIXED_DT);
      if (this.paused) {
        this.accumulator = 0;
        // A floor-choice menu can open mid-step: show the new floor without advancing combat.
        for (const system of this.systems) system.render?.(this.world, 1, 0);
        this.app.render();
        return;
      }
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;
    for (const system of this.systems) system.render?.(this.world, alpha, frameDt);
    this.lastWorkMs = performance.now() - started;
    this.onFrame?.(rawDt * 1000, this.lastWorkMs);
  }
}
