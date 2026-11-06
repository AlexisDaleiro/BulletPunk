import type { World } from './World';

/** Every hook is optional; the Game calls the ones a system defines. */
export interface System {
  /** Once, after the renderer exists and before the first frame. */
  init?(): void;
  /** Viewport changed (CSS px). Also called once right after `init`. */
  resize?(width: number, height: number): void;
  /** Fixed-step simulation, `dt` is always FIXED_DT. */
  update?(world: World, dt: number): void;
  /** After deferred destruction is flushed; snapshots see a complete simulation step. */
  afterStep?(world: World, dt: number): void;
  /** Once per displayed frame. `alpha` in [0,1) is the progress into the next fixed step. */
  render?(world: World, alpha: number, frameDt: number): void;
}
