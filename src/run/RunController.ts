import { getCharacter, type CharacterDef } from '../characters/characters.ts';
import type { Game } from '../core/Game';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { GameState } from '../game/GameState';
import type { LevelManager } from '../game/LevelManager';
import type { InputManager } from '../input/InputManager';
import type { ProfileStore } from '../profile/ProfileStore';
import type { HudSystem } from '../systems/HudSystem';
import { applyAbilityUpgrade, upgradeChoices, type AbilityUpgrade } from '../characters/upgrades.ts';
import { appearanceFor, COSMETICS } from '../profile/cosmetics.ts';
import { gainExperience } from './experience.ts';

/** A snapshot of the run for the pause summary and the game-over screen. */
export interface RunInfo {
  experience: number;
  experienceLevel: number;
  upgrades: string[];
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
  upgradeOptions: readonly AbilityUpgrade[] = [];
  onUpgrade: (() => void) | null = null;
  /** The next earned level whose upgrade is waiting to be selected. */
  get upgradeLevel(): number { const xp = this.deps.state.experience; return xp.level - xp.pending + 1; }
  private seenProgress = '';
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
    if (!this.active || this.over) return;
    const { state, world, levels, profile } = this.deps;
    const progress = `${state.kills}:${state.floor}`;
    if (progress !== this.seenProgress) {
      this.seenProgress = progress;
      const unlocked = profile.checkUnlocks({ kills: profile.value.stats.kills + state.kills, floor: Math.max(profile.value.stats.bestFloor, state.floor), runs: profile.value.stats.runs });
      if (unlocked.length) state.toast(`DESBLOQUEADO · ${unlocked.map(id => COSMETICS.find(c => c.id === id)?.name).join(' / ')}`, 4);
    }
    if (state.experience.pending > 0 && levels.player !== null && (world.get(levels.player, 'health')?.hp ?? 0) > 0 && this.onUpgrade) {
      if (!this.upgradeOptions.length) this.offerUpgrade();
      return;
    }
    this.elapsed += dt;
  }

  awardExperience(amount: number): number {
    if (!this.active || this.over || this.recorded) return 0;
    return gainExperience(this.deps.state.experience, amount);
  }

  private offerUpgrade(): void {
    const { levels, world } = this.deps;
    const c = levels.player === null ? undefined : world.get(levels.player, 'character');
    if (!c) return;
    this.upgradeOptions = upgradeChoices(c, this.seed, this.upgradeLevel);
    this.setMenuOpen(true);
    this.onUpgrade?.();
  }

  chooseUpgrade(id: string): boolean {
    const { world, levels, state } = this.deps;
    if (!this.active || this.over || state.experience.pending <= 0 || !this.upgradeOptions.some(u => u.id === id) || levels.player === null
      || (world.get(levels.player, 'health')?.hp ?? 0) <= 0) return false;
    const c = world.get(levels.player, 'character');
    const previousHp = c?.augments?.maxHp ?? 0, previousShield = c?.augments?.maxShield ?? 0;
    if (!c || !applyAbilityUpgrade(c, id)) return false;
    const health = world.get(levels.player, 'health');
    if (health) {
      const hp = (c.augments?.maxHp ?? 0) - previousHp, shield = (c.augments?.maxShield ?? 0) - previousShield;
      health.maxHp += hp; health.hp = Math.min(health.maxHp, health.hp + hp);
      health.maxShield += shield; health.shield = Math.min(health.maxShield, health.shield + shield);
    }
    this.character = c.def;
    state.experience.pending--;
    this.upgradeOptions = [];
    if (state.experience.pending > 0) this.offerUpgrade();
    else this.setMenuOpen(false);
    return true;
  }

  /** A fresh run. A run still in progress is recorded as abandoned first. */
  startRun(characterId: string, seed: number = newSeed()): void {
    const { levels, hud, profile, game } = this.deps;
    this.endRun();
    this.clearTimer();
    levels.reset();
    hud.reset();

    const base = getCharacter(characterId);
    const character = appearanceFor(base, profile.lookFor(base.id));
    profile.setLastCharacter(character.id);
    this.character = character;
    this.seed = seed;
    this.elapsed = 0;
    this.over = false;
    this.recorded = false;
    this.active = true;
    this.seenProgress = '';
    this.upgradeOptions = [];
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
      experience: state.experience.total,
      experienceLevel: state.experience.level,
      upgrades: levels.player === null ? [] : [...(world.get(levels.player, 'character')?.upgrades ?? [])],
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
