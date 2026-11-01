import type { GameState } from '../game/GameState';
import type { InputManager } from '../input/InputManager';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RenderSystem } from './RenderSystem';

/** Copies sampled input into the intent of every player-controlled entity. */
export class InputSystem implements System {
  private readonly input: InputManager;
  private readonly renderer: RenderSystem;
  private readonly state: GameState;

  constructor(input: InputManager, renderer: RenderSystem, state: GameState) {
    this.input = input;
    this.renderer = renderer;
    this.state = state;
  }

  update(world: World): void {
    const s = this.input.poll();
    this.state.touch = s.mode === 'touch';
    world.each(['playerControlled', 'intent', 'transform'], (_entity, _tag, intent, t) => {
      intent.moveX = s.moveX;
      intent.moveY = s.moveY;
      if (s.mode === 'desktop') {
        if (s.hasPointer) {
          const p = this.renderer.screenToWorld(s.pointerX, s.pointerY);
          intent.aimAngle = Math.atan2(p.y - t.y, p.x - t.x);
        }
      } else if (s.aimActive) {
        intent.aimAngle = Math.atan2(s.aimY, s.aimX);
      } else if (s.moveX !== 0 || s.moveY !== 0) {
        intent.aimAngle = Math.atan2(s.moveY, s.moveX); // no aim: face where you run
      }
      intent.wantsFire = s.fire;
      intent.wantsReload = s.reload;
      intent.wantsDash = s.dash;
      intent.wantsInteract = s.interact;
      intent.wantsSwap = s.swap;
    });
  }
}
