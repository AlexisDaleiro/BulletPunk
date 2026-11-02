import type { SoundManager } from '../audio/SoundManager';
import { CHARACTERS, type CharacterDef } from '../characters/characters';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { createPlayer } from '../entities/player';
import type { ProjectilePool } from '../entities/projectiles';
import type { NoiseField } from '../noise/NoiseField';
import { TilemapView } from '../render/TilemapRenderer';
import type { FogSystem } from '../systems/FogSystem';
import type { RenderSystem } from '../systems/RenderSystem';
import type { VisionRaycastSystem } from '../systems/VisionRaycastSystem';
import { generateDungeon } from '../world/DungeonGenerator';
import type { TileMap } from '../world/TileMap';
import { extractWallEdges } from '../world/wallEdges';
import type { GameState } from './GameState';
import { Level } from './Level';
import { populateFloor } from './populate';

export interface LevelDeps {
  world: World;
  renderer: RenderSystem;
  state: GameState;
  noise: NoiseField;
  pool: ProjectilePool;
  audio: SoundManager;
  fog: FogSystem;
  vision: VisionRaycastSystem;
  /** Systems that read the current floor's tiles. */
  mapUsers: { map: TileMap | null }[];
  /** Systems that also need the Level itself (to change tiles or draw the minimap). */
  levelUsers: { level: Level | null }[];
}

/** Floor N's seed is the run seed plus (N - 1) of these, so every floor of a run is reproducible. */
const SEED_STEP = 7919;
/** HP the player recovers when taking the elevator. */
const DESCEND_HEAL = 30;

/**
 * Builds floors and swaps between them. It is the first system in the pipeline, so a requested
 * descent happens at the start of a fixed step, never in the middle of another system's loop.
 * The player entity survives every swap (HP, weapons, implants); everything else is rebuilt.
 */
export class LevelManager implements System {
  player: Entity | null = null;
  level: Level | null = null;
  character: CharacterDef = CHARACTERS[0];
  private baseSeed = 0;
  private pending: number | null = null;
  private readonly deps: LevelDeps;
  private readonly view: TilemapView;

  constructor(deps: LevelDeps) {
    this.deps = deps;
    this.view = new TilemapView(deps.renderer.layers.floor);
  }

  /** Begins a run as `character`. Call `reset()` first when a run was already going. */
  start(character: CharacterDef, baseSeed: number): void {
    this.character = character;
    this.baseSeed = baseSeed;
    this.load(1);
  }

  /** Tears the run down: every entity (the player too), floor state and run state. Nothing carries over. */
  reset(): void {
    const { world, renderer, state, noise, pool, vision, mapUsers, levelUsers } = this.deps;
    this.pending = null;
    for (const entity of world.entities()) world.destroy(entity);
    world.flush();
    this.player = null;
    this.level = null;
    renderer.cameraTarget = null;
    pool.reset();
    noise.events.length = 0;
    vision.segments = [];
    for (const user of mapUsers) user.map = null;
    for (const user of levelUsers) user.level = null;
    state.reset();
  }

  requestDescend(): void {
    this.pending = this.deps.state.floor + 1;
  }

  update(): void {
    if (this.pending === null) return;
    const floor = this.pending;
    this.pending = null;
    this.load(floor);
  }

  private load(floor: number): void {
    const { world, renderer, state, noise, pool, audio, fog, vision, mapUsers, levelUsers } = this.deps;
    const baseSeed = this.baseSeed;
    state.floor = floor;
    state.resetKeys();
    state.prompt = null;

    for (const entity of world.entities()) if (entity !== this.player) world.destroy(entity);
    world.flush();
    pool.reset();
    noise.events.length = 0;

    const seed = floor === 1 ? baseSeed : (baseSeed + (floor - 1) * SEED_STEP) >>> 0;
    const dungeon = generateDungeon(seed, { floor });
    const level = new Level(dungeon, this.view, (l) => {
      vision.segments = extractWallEdges(l.map);
    });
    this.level = level;
    for (const user of mapUsers) user.map = dungeon.map;
    for (const user of levelUsers) user.level = level;
    fog.setMap(dungeon.map);

    if (this.player === null) {
      this.player = createPlayer(world, renderer, dungeon.spawn.x, dungeon.spawn.y, this.character);
      renderer.cameraTarget = this.player;
    } else {
      const t = world.get(this.player, 'transform');
      if (t) {
        t.x = t.prevX = dungeon.spawn.x;
        t.y = t.prevY = dungeon.spawn.y;
        t.vx = t.vy = 0;
      }
      const h = world.get(this.player, 'health');
      if (h) h.hp = Math.min(h.maxHp, h.hp + DESCEND_HEAL);
      audio.playElevator();
    }

    const bots = populateFloor(world, renderer, dungeon);
    const hasShop = dungeon.rooms.some((r) => r.type === 'SHOP');
    console.info(`floor ${floor} (seed ${seed}): ${dungeon.rooms.length} rooms, ${bots} bots, ${dungeon.doors.length} locks, ${dungeon.plan.chests.length} chests, ${dungeon.plan.secrets.length} secrets`);
    if (floor === 1) {
      state.toast(state.touch ? 'STICKS MOVE AND AIM · SKILL ABILITY · HACK INTERACT · ODD WALLS CAN BE PUSHED' : 'WASD MOVE · F ABILITY · SPACE DASH · Q SWAP · E INTERACT · ODD WALLS CAN BE PUSHED', 5);
    } else {
      state.toast(`FLOOR ${floor}${hasShop ? ' · SHOP ON THIS LEVEL' : ''}`, 3.5);
    }
  }
}
