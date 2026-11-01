import type { SoundManager } from '../audio/SoundManager';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';

/** Keeps the audio listener on the player so positioned sounds pan and fade correctly. */
export class AudioSystem implements System {
  private readonly audio: SoundManager;

  constructor(audio: SoundManager) {
    this.audio = audio;
  }

  update(world: World): void {
    world.each(['playerControlled', 'transform'], (_entity, _tag, t) => this.audio.setListener(t.x, t.y));
  }
}
