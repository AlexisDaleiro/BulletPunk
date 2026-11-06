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
import { KILL_XP } from './run/experience';
import { SettingsStore } from './settings/SettingsStore';
import { AISystem } from './systems/AISystem';
import { AimGuideSystem } from './systems/AimGuideSystem';
import { AudioSystem } from './systems/AudioSystem';
import { DashTrailSystem } from './systems/DashTrailSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { CharacterSystem } from './systems/CharacterSystem';
import { PresentationSystem } from './systems/PresentationSystem';
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
import { Accounts } from './cloud/Accounts';
import { RunSaves } from './run/RunSaves';
import { TrainingSystem } from './systems/TrainingSystem';
import { TacticalReadabilitySystem } from './systems/TacticalReadabilitySystem';
import { FrameBudget, QUALITY, visualQuality } from './render/visualQuality';

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
const environment = new EnvironmentSystem(render, noise, audio, state);
const vision = new VisionRaycastSystem();
const fog = new FogSystem(render);
const aimGuide = new AimGuideSystem(render);
const tactical = new TacticalReadabilitySystem(render);
const characters = new CharacterSystem(render, noise, audio);
const hud = new HudSystem(render, state, fog);
hud.onAbilityStatus = (text, ready, active) => input.setAbilityStatus(text, ready, active);
const health = new HealthSystem(render, audio);
const pickups = new PickupSystem(state, audio, render);
health.onKill = (elite) => {
  if (run.practice) return;
  state.kills++;
  run.awardExperience(elite ? KILL_XP.elite : KILL_XP.normal);
  if (elite) state.toast('BASTIÓN NEUTRALIZADO · BOTÍN DE ÉLITE', 3);
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
  mapUsers: [physics, ai, weapons, projectileHits, pickups, aimGuide, characters, tactical],
  levelUsers: [interact, projectileHits, hud, environment],
});
interact.onDescend = () => levels.requestDescend();
const accounts = new Accounts(profile, settings);
const run = new RunController({
  game,
  world: game.world,
  levels,
  state,
  hud,
  input,
  profile,
  canStart: () => accounts.canPlay,
  reportGeneration: () => accounts.sync.generation,
  onRunReport: (report) => saves.report(report),
  onStart: () => saves.newRun(replaceSaved),
});
let replaceSaved = false;
const saves: RunSaves = new RunSaves({
  accounts,
  run,
  game,
  input,
  world: game.world,
  levels,
  state,
  pool: projectiles,
  renderer: render,
  fog,
  environment,
  noise,
  vision,
  isMenuOpen: (): boolean => ui.isOpen,
});
accounts.beforeIdentityChange = () => saves.leaveAccount();

// Pipeline order. The LevelManager goes first so floor swaps happen between steps. Physics goes before
// Locomotion so its prev-state snapshot precedes the angle change; AI runs before both so bot intents are
// fresh; Projectile sweeps the segment Physics just travelled; Interact reads the intents Input filled.
game
  .addSystem(levels)
  .addSystem(run)
  .addSystem(new TrainingSystem(run, health))
  .addSystem(new InputSystem(input, render, state))
  .addSystem(ai)
  .addSystem(physics)
  .addSystem(characters)
  .addSystem(new LocomotionSystem())
  .addSystem(weapons)
  .addSystem(projectileHits)
  .addSystem(new NoiseEmitterSystem(noise, audio))
  .addSystem(new NoisePropagationSystem(noise))
  .addSystem(interact)
  .addSystem(environment)
  .addSystem(pickups)
  .addSystem(health)
  .addSystem(new DashTrailSystem(render))
  .addSystem(new PresentationSystem(render))
  .addSystem(new LifetimeSystem())
  .addSystem(vision)
  .addSystem(fog)
  .addSystem(aimGuide)
  .addSystem(tactical)
  .addSystem(new AudioSystem(audio))
  .addSystem(new RippleRenderSystem(render, noise))
  .addSystem(hud)
  .addSystem(render)
  .addSystem(saves);

// --- settings apply live; the M key writes back to them ----------------------------------
const frameBudget = new FrameBudget();
let qualityPreference = '';
const applyQuality = (): void => {
  game.setPixelRatio(Math.min(settings.value.pixelRatio, QUALITY[visualQuality.preset].resolution));
  document.documentElement.dataset.quality = visualQuality.preset;
  window.dispatchEvent(new Event('bulletpunk:quality'));
};
const applySettings = (s: Readonly<typeof settings.value>): void => {
  audio.setVolume(s.volume);
  audio.setMuted(s.muted);
  input.configureTouch(s);
  const preference = `${s.quality}:${s.adaptiveQuality}:${settings.qualitySelection}`;
  if (preference !== qualityPreference) {
    qualityPreference = preference;
    visualQuality.preset = s.quality;
    frameBudget.reset();
  }
  applyQuality();
  render.showStats = s.showFps;
};
audio.onMuteChange = (muted) => settings.update({ muted });
settings.subscribe(applySettings);
game.onFrame = (frameMs) => {
  if (!settings.value.adaptiveQuality) return;
  const next = frameBudget.sample(frameMs, visualQuality.preset);
  if (next !== visualQuality.preset) {
    visualQuality.preset = next;
    applyQuality();
  }
};

// Nothing runs until a run starts: the menu reason holds the game and the input.
game.setPause('menu', true);
input.setActive(false);
await game.start(host, settings.value.antialias);
applySettings(settings.value);

initLandscape((portrait) => game.setPause('portrait', portrait));
const syncHidden = (): void => game.setPause('hidden', document.hidden);
document.addEventListener('visibilitychange', syncHidden);
syncHidden();

// `?seed=123` replays a run (every floor derives from it); it applies to the first run of the page load.
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const urlSeed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : undefined;

let pendingSeed = urlSeed;
const ui: UI = new UI({
  startPractice: async () => {
    if (run.active && !run.practice) await saves.suspend();
    run.startPractice(profile.value.lastCharacter);
    ui.close();
    game.refresh();
  },
  saves,
  startNew: (characterId, seed, replace) => {
    replaceSaved = replace;
    run.startRun(characterId, seed);
    replaceSaved = false;
  },
  accounts,
  run,
  settings,
  profile,
  bootAntialias: settings.value.antialias,
  takeSeed: () => {
    const seed = pendingSeed;
    pendingSeed = undefined;
    return seed;
  },
});
game.app.canvas.style.visibility = 'hidden';
ui.open('title');
saves.onReady = () => {
  ui.close();
  run.continueRestored();
};
saves.onNotice = () => ui.open(run.active ? 'pause' : 'title');
accounts.onProgressReset = () => {
  if (run.active) {
    run.invalidateRun();
    ui.open('title');
  }
};
void accounts.init();

run.onGameOver = (info) => ui.openGameOver(info);

// Handles for poking at the running game from the devtools console.
if (import.meta.env.DEV)
  Object.assign(window, {
    game,
    noise,
    state,
    levels,
    projectiles,
    audio,
    run,
    profile,
    settings,
    render,
    ui,
    accounts,
    saves,
    projectileHits,
    tactical,
    visualQuality,
  });
