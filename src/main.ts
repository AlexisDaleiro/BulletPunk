import { Game } from './core/Game';
import { createPlayer } from './entities/player';
import { InputManager } from './input/InputManager';
import { NoiseField } from './noise/NoiseField';
import { buildTilemapGraphics } from './render/TilemapRenderer';
import { DashTrailSystem } from './systems/DashTrailSystem';
import { InputSystem } from './systems/InputSystem';
import { LifetimeSystem } from './systems/LifetimeSystem';
import { LocomotionSystem } from './systems/LocomotionSystem';
import { NoiseEmitterSystem } from './systems/NoiseEmitterSystem';
import { NoisePropagationSystem } from './systems/NoisePropagationSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { RenderSystem } from './systems/RenderSystem';
import { generateDungeon } from './world/DungeonGenerator';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

const game = new Game();
const render = new RenderSystem(game.app, game.world);
const input = new InputManager(host);
const noise = new NoiseField();
const physics = new PhysicsSystem();

// Pipeline order. Physics goes before Locomotion so its prev-state snapshot precedes the angle change.
game
  .addSystem(new InputSystem(input, render))
  .addSystem(physics)
  .addSystem(new LocomotionSystem())
  .addSystem(new NoiseEmitterSystem(noise))
  .addSystem(new NoisePropagationSystem(noise))
  .addSystem(new DashTrailSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(render);
await game.start(host);

// `?seed=123` replays a dungeon; otherwise each load is new.
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : Date.now() >>> 0;
const dungeon = generateDungeon(seed);
console.info(`dungeon seed ${seed}: ${dungeon.rooms.length} rooms`);
physics.map = dungeon.map;
render.layers.floor.addChild(buildTilemapGraphics(dungeon.map));

const player = createPlayer(game.world, render, dungeon.spawn.x, dungeon.spawn.y);
render.cameraTarget = player;

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV) Object.assign(window, { game, noise, player, dungeon });
