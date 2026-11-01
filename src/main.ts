import { Graphics } from 'pixi.js';
import { COLORS, TILE_SIZE } from './config';
import { Game } from './core/Game';
import { createTransform } from './ecs/components';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { RenderSystem } from './systems/RenderSystem';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

const game = new Game();
const render = new RenderSystem(game.app, game.world);
game.addSystem(new PhysicsSystem()).addSystem(render);
await game.start(host);

// Foundation smoke scene, replaced by the dungeon in Milestone 3: a scrolling grid and one
// camera-followed entity prove the fixed step, interpolation, camera and layers all work.
const GRID_TILES = 200;
const GRID_SIZE = GRID_TILES * TILE_SIZE;
const grid = new Graphics();
for (let i = 0; i <= GRID_TILES; i++) {
  const p = i * TILE_SIZE;
  grid.moveTo(p, 0).lineTo(p, GRID_SIZE).moveTo(0, p).lineTo(GRID_SIZE, p);
}
grid.stroke({ width: 1, color: COLORS.grid });
render.layers.floor.addChild(grid);

const scout = game.world.create();
const transform = createTransform(GRID_SIZE / 2, GRID_SIZE / 2);
transform.vx = 90;
game.world.add(scout, 'transform', transform);
const body = new Graphics().poly([16, 0, -10, -10, -5, 0, -10, 10]).fill(COLORS.cyan);
body.blendMode = 'add';
render.attach(game.world, scout, 'entities', body);
render.cameraTarget = scout;
