import { SoundManager } from './audio/SoundManager';
import { Game } from './core/Game';
import { GameState } from './game/GameState';
import { LevelManager } from './game/LevelManager';
import { ProjectilePool } from './entities/projectiles';
import { InputManager } from './input/InputManager';
import { initLandscape } from './input/landscape';
import { NoiseField } from './noise/NoiseField';
import { ProfileStore } from './profile/ProfileStore';
import { RunController } from './run/RunController';
import { SettingsStore } from './settings/SettingsStore';
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
import { UI } from './ui/UI';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element missing');

// --- the world: built once, then reused by every run -------------------------------------
const settings = new SettingsStore();
const profile = new ProfileStore();
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
const health = new HealthSystem(render, audio);
health.onKill = () => {
  state.kills++;
};

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
});
interact.onDescend = () => levels.requestDescend();
const run = new RunController({ game, world: game.world, levels, state, hud, input, profile });

// Pipeline order. The LevelManager goes first so floor swaps happen between steps. Physics goes before
// Locomotion so its prev-state snapshot precedes the angle change; AI runs before both so bot intents are
// fresh; Projectile sweeps the segment Physics just travelled; Interact reads the intents Input filled.
game
  .addSystem(levels)
  .addSystem(run)
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
  .addSystem(health)
  .addSystem(new DashTrailSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(vision)
  .addSystem(fog)
  .addSystem(new AudioSystem(audio))
  .addSystem(new RippleRenderSystem(render, noise))
  .addSystem(hud)
  .addSystem(render);

// --- settings apply live; the M key writes back to them ----------------------------------
const applySettings = (s: Readonly<typeof settings.value>): void => {
  audio.setVolume(s.volume);
  audio.setMuted(s.muted);
  game.setPixelRatio(s.pixelRatio);
  render.showStats = s.showFps;
};
audio.onMuteChange = (muted) => settings.update({ muted });
settings.subscribe(applySettings);

// Nothing runs until a run starts: the menu reason holds the game and the input.
game.setPause('menu', true);
input.setActive(false);
await game.start(host, settings.value.antialias);
applySettings(settings.value);

initLandscape((portrait) => game.setPause('portrait', portrait));
const syncHidden = (): void => game.setPause('hidden', document.hidden);
document.addEventListener('visibilitychange', syncHidden);
syncHidden();
// A tab closed mid-run still counts as an abandoned run.
window.addEventListener('pagehide', () => run.endRun());

// `?seed=123` replays a run (every floor derives from it); it applies to the first run of the page load.
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const urlSeed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : undefined;

let pendingSeed = urlSeed;
const ui = new UI({
  run,
  settings,
  profile,
  renderer: game.app.renderer,
  bootAntialias: settings.value.antialias,
  takeSeed: () => {
    const seed = pendingSeed;
    pendingSeed = undefined;
    return seed;
  },
});
game.app.canvas.style.visibility = 'hidden';
ui.open('title');

run.onGameOver = (info) => ui.openGameOver(info);

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV) Object.assign(window, { game, noise, state, levels, projectiles, audio, run, profile, settings, render, ui });
