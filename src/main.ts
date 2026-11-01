import { Graphics } from 'pixi.js';
import { COLORS, TILE_SIZE } from './config';
import { Game } from './core/Game';
import { createPlayer } from './entities/player';
import { InputManager } from './input/InputManager';
import { NoiseField } from './noise/NoiseField';
import { DashTrailSystem } from './systems/DashTrailSystem';
import { InputSystem } from './systems/InputSystem';
import { LifetimeSystem } from './systems/LifetimeSystem';
import { LocomotionSystem } from './systems/LocomotionSystem';
import { NoiseEmitterSystem } from './systems/NoiseEmitterSystem';
import { NoisePropagationSystem } from './systems/NoisePropagationSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { RenderSystem } from './systems/RenderSystem';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

const game = new Game();
const render = new RenderSystem(game.app, game.world);
const input = new InputManager(host);
const noise = new NoiseField();

// Pipeline order. Physics goes before Locomotion so its prev-state snapshot precedes the angle change.
game
  .addSystem(new InputSystem(input, render))
  .addSystem(new PhysicsSystem())
  .addSystem(new LocomotionSystem())
  .addSystem(new NoiseEmitterSystem(noise))
  .addSystem(new NoisePropagationSystem(noise))
  .addSystem(new DashTrailSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(render);
await game.start(host);

// Placeholder floor until the dungeon arrives in Milestone 3.
const GRID_TILES = 200;
const GRID_SIZE = GRID_TILES * TILE_SIZE;
const grid = new Graphics();
for (let i = 0; i <= GRID_TILES; i++) {
  const p = i * TILE_SIZE;
  grid.moveTo(p, 0).lineTo(p, GRID_SIZE).moveTo(0, p).lineTo(GRID_SIZE, p);
}
grid.stroke({ width: 1, color: COLORS.grid });
render.layers.floor.addChild(grid);

const player = createPlayer(game.world, render, GRID_SIZE / 2, GRID_SIZE / 2);
render.cameraTarget = player;

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV) Object.assign(window, { game, noise, player });
