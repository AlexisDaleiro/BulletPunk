import { Game } from './core/Game';
import { populateEnemies } from './entities/enemies';
import { ProjectilePool } from './entities/projectiles';
import { createPlayer } from './entities/player';
import { InputManager } from './input/InputManager';
import { NoiseField } from './noise/NoiseField';
import { buildTilemapGraphics } from './render/TilemapRenderer';
import { AISystem } from './systems/AISystem';
import { DashTrailSystem } from './systems/DashTrailSystem';
import { FogSystem } from './systems/FogSystem';
import { HealthSystem } from './systems/HealthSystem';
import { HudSystem } from './systems/HudSystem';
import { InputSystem } from './systems/InputSystem';
import { LifetimeSystem } from './systems/LifetimeSystem';
import { LocomotionSystem } from './systems/LocomotionSystem';
import { NoiseEmitterSystem } from './systems/NoiseEmitterSystem';
import { NoisePropagationSystem } from './systems/NoisePropagationSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { PickupSystem } from './systems/PickupSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { RenderSystem } from './systems/RenderSystem';
import { RippleRenderSystem } from './systems/RippleRenderSystem';
import { VisionRaycastSystem } from './systems/VisionRaycastSystem';
import { WeaponSystem } from './systems/WeaponSystem';
import { generateDungeon } from './world/DungeonGenerator';
import { extractWallEdges } from './world/wallEdges';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

const game = new Game();
const render = new RenderSystem(game.app, game.world);
const input = new InputManager(host);
const noise = new NoiseField();
const projectiles = new ProjectilePool(game.world, render);

const physics = new PhysicsSystem();
const ai = new AISystem(render, noise);
const weapons = new WeaponSystem(render, noise, projectiles);
const projectileHits = new ProjectileSystem(render, projectiles);
const vision = new VisionRaycastSystem();
const fog = new FogSystem(render);

// Pipeline order. Physics goes before Locomotion so its prev-state snapshot precedes the angle change;
// AI runs before both so bot intents are fresh; Projectile sweeps the segment Physics just travelled.
game
  .addSystem(new InputSystem(input, render))
  .addSystem(ai)
  .addSystem(physics)
  .addSystem(new LocomotionSystem())
  .addSystem(weapons)
  .addSystem(projectileHits)
  .addSystem(new NoiseEmitterSystem(noise))
  .addSystem(new NoisePropagationSystem(noise))
  .addSystem(new PickupSystem())
  .addSystem(new HealthSystem(render))
  .addSystem(new DashTrailSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(vision)
  .addSystem(fog)
  .addSystem(new RippleRenderSystem(render, noise))
  .addSystem(new HudSystem(render))
  .addSystem(render);
await game.start(host);

// `?seed=123` replays a dungeon; otherwise each load is new.
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : Date.now() >>> 0;
const dungeon = generateDungeon(seed);
for (const system of [physics, ai, weapons, projectileHits]) system.map = dungeon.map;
vision.segments = extractWallEdges(dungeon.map);
fog.setMap(dungeon.map);
render.layers.floor.addChild(buildTilemapGraphics(dungeon.map));

const player = createPlayer(game.world, render, dungeon.spawn.x, dungeon.spawn.y);
render.cameraTarget = player;
const enemies = populateEnemies(game.world, render, dungeon);
console.info(`dungeon seed ${seed}: ${dungeon.rooms.length} rooms, ${enemies} bots`);

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV) Object.assign(window, { game, noise, player, dungeon, projectiles });
