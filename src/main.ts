import { SoundManager } from './audio/SoundManager';
import { Game } from './core/Game';
import { GameState } from './game/GameState';
import { LevelManager } from './game/LevelManager';
import { ProjectilePool } from './entities/projectiles';
import { InputManager } from './input/InputManager';
import { NoiseField } from './noise/NoiseField';
import { AISystem } from './systems/AISystem';
import { AudioSystem } from './systems/AudioSystem';
import { DashTrailSystem } from './systems/DashTrailSystem';
import { FogSystem } from './systems/FogSystem';
import { HealthSystem } from './systems/HealthSystem';
import { HudSystem } from './systems/HudSystem';
import { InputSystem } from './systems/InputSystem';
import { InteractSystem } from './systems/InteractSystem';
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

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

const game = new Game();
const render = new RenderSystem(game.app, game.world);
const input = new InputManager(host);
const noise = new NoiseField();
const audio = new SoundManager();
const state = new GameState();
const projectiles = new ProjectilePool(game.world, render);

const physics = new PhysicsSystem();
const ai = new AISystem(render, noise, audio);
const weapons = new WeaponSystem(render, noise, projectiles, audio);
const projectileHits = new ProjectileSystem(render, projectiles, audio);
const interact = new InteractSystem(render, noise, state, audio);
const vision = new VisionRaycastSystem();
const fog = new FogSystem(render);
const hud = new HudSystem(render, state, fog);

// `?seed=123` replays a run (every floor derives from it); otherwise each load is new.
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const baseSeed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : Date.now() >>> 0;

const levels = new LevelManager({
  world: game.world,
  renderer: render,
  state,
  noise,
  pool: projectiles,
  audio,
  fog,
  vision,
  mapUsers: [physics, ai, weapons, projectileHits],
  levelUsers: [interact, projectileHits, hud],
  baseSeed,
});
interact.onDescend = () => levels.requestDescend();

// Pipeline order. The LevelManager goes first so floor swaps happen between steps. Physics goes before
// Locomotion so its prev-state snapshot precedes the angle change; AI runs before both so bot intents are
// fresh; Projectile sweeps the segment Physics just travelled; Interact reads the intents Input filled.
game
  .addSystem(levels)
  .addSystem(new InputSystem(input, render, state))
  .addSystem(ai)
  .addSystem(physics)
  .addSystem(new LocomotionSystem())
  .addSystem(weapons)
  .addSystem(projectileHits)
  .addSystem(new NoiseEmitterSystem(noise, audio))
  .addSystem(new NoisePropagationSystem(noise))
  .addSystem(interact)
  .addSystem(new PickupSystem(state, audio))
  .addSystem(new HealthSystem(render, audio))
  .addSystem(new DashTrailSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(vision)
  .addSystem(fog)
  .addSystem(new AudioSystem(audio))
  .addSystem(new RippleRenderSystem(render, noise))
  .addSystem(hud)
  .addSystem(render);
await game.start(host);
levels.start();

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV) Object.assign(window, { game, noise, state, levels, projectiles, audio });
