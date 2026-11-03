import { getCharacter, type CharacterDef } from '../characters/characters';
import type { Game } from '../core/Game';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { GameState } from '../game/GameState';
import type { LevelManager } from '../game/LevelManager';
import type { InputManager } from '../input/InputManager';
import type { ProfileStore } from '../profile/ProfileStore';
import type { HudSystem } from '../systems/HudSystem';

/** A snapshot of the run for the pause summary and the game-over screen. */
export interface RunInfo {
  characterId: string;
  seed: number;
  floor: number;
  credits: number;
  kills: number;
  timeSec: number;
  /** Names of the installed implants (the operative's innate perk included). */
  implants: string[];
}

export interface RunDeps {
  game: Game;
  world: World;
  levels: LevelManager;
  state: GameState;
  hud: HudSystem;
  input: InputManager;
  profile: ProfileStore;
}

/** Short delay between dying and the game-over screen, so the death flash is seen and the killing click does not hit a button. */
const GAME_OVER_DELAY_MS = 700;

const newSeed = (): number => Date.now() >>> 0 || 1;

/**
 * The life cycle of a run: start, restart, quit to the menu, death. Also a system, only to count
 * play time in fixed steps (so paused time never counts). Every way a run can end goes through
 * `endRun`, which records it in the profile exactly once.
 */
export class RunController implements System {
  /** True from `startRun` until `quitToMenu`; stays true on the game-over screen. */
  active = false;
  /** True once the player has died. */
  over = false;
  character: CharacterDef = getCharacter('');
  seed = 0;
  elapsed = 0;
  /** Called after the death delay; the UI shows the game-over screen. */
  onGameOver: ((info: RunInfo) => void) | null = null;
  /** Called whenever the run starts, ends, dies or a menu opens or closes. */
  onChange: (() => void) | null = null;

  private readonly deps: RunDeps;
  private recorded = false;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: RunDeps) {
    this.deps = deps;
    deps.hud.onDeath = () => this.handleDeath();
  }

  update(_world: World, dt: number): void {
    if (this.active && !this.over) this.elapsed += dt;
  }

  /** A fresh run. A run still in progress is recorded as abandoned first. */
  startRun(characterId: string, seed: number = newSeed()): void {
    const { levels, hud, profile, game } = this.deps;
    this.endRun();
    this.clearTimer();
    levels.reset();
    hud.reset();

    const character = getCharacter(characterId);
    profile.setLastCharacter(character.id);
    this.character = character;
    this.seed = seed;
    this.elapsed = 0;
    this.over = false;
    this.recorded = false;
    this.active = true;
    this.deps.state.touch = this.deps.input.inputMode === 'touch';
    levels.start(character, seed);
    game.app.canvas.style.visibility = 'visible';
    this.setMenuOpen(false);
  }

  /** Same operative, same seed, back to floor 1. */
  restartRun(): void {
    this.startRun(this.character.id, this.seed);
  }

  /** Abandons the run (recorded) and clears the world. */
  quitToMenu(): void {
    this.endRun();
    this.clearTimer();
    this.deps.levels.reset();
    this.deps.hud.reset();
    this.active = false;
    this.over = false;
    this.deps.game.app.canvas.style.visibility = 'hidden';
    this.setMenuOpen(true);
  }

  /** Freezes the game and the input while a menu is up; unfreezes both when it closes. */
  setMenuOpen(open: boolean): void {
    this.deps.game.setPause('menu', open);
    this.deps.input.setActive(!open && this.active && !this.over);
    this.onChange?.();
  }

  /** Saves the run in progress as abandoned; also used on `pagehide`, when the tab closes mid-run. */
  endRun(): void {
    if (!this.active || this.recorded) return;
    this.recorded = true;
    const info = this.snapshot();
    this.deps.profile.record({ characterId: info.characterId, floor: info.floor, credits: info.credits, kills: info.kills, timeSec: info.timeSec });
  }

  snapshot(): RunInfo {
    const { world, levels, state } = this.deps;
    const syn = levels.player === null ? undefined : world.get(levels.player, 'passiveSynergy');
    return {
      characterId: this.character.id,
      seed: this.seed,
      floor: state.floor,
      credits: state.credits,
      kills: state.kills,
      timeSec: this.elapsed,
      implants: syn ? syn.passives.map((p) => p.name) : [],
    };
  }

  private handleDeath(): void {
    if (!this.active || this.over) return;
    this.over = true;
    this.endRun();
    this.onChange?.();
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.setMenuOpen(true);
      this.onGameOver?.(this.snapshot());
    }, GAME_OVER_DELAY_MS);
  }

  private clearTimer(): void {
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    this.gameOverTimer = null;
  }
}
