import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunController, type RunDeps } from './RunController.ts';
import { World } from '../ecs/World.ts';
import { GameState } from '../game/GameState.ts';
import { ProfileStore } from '../profile/ProfileStore.ts';
import { createHealth } from '../ecs/components.ts';
import type { CharacterDef } from '../characters/characters.ts';

function fixture() {
  const world = new World(), state = new GameState(), profile = new ProfileStore(null);
  profile.checkUnlocks({ kills: 20, floor: 3, runs: 1 }); profile.equip('NIX', 'skin', 'NEON');
  let paused = true, menus = 0;
  const levels = {
    player: null as number | null,
    reset() { for (const id of world.entities()) world.destroy(id); world.flush(); this.player = null; state.reset(); },
    start(def: CharacterDef) {
      this.player = world.create();
      world.add(this.player, 'character', { def, activeRemaining: 0, cooldownRemaining: 0, activationFlash: 0, recoil: 0, trailTimer: 0 });
      world.add(this.player, 'health', createHealth());
    },
    startTraining(def:CharacterDef){this.start(def);},
  };
  const deps = { world, state, profile, levels, hud: { reset() {}, onDeath: null }, input: { inputMode: 'touch', setActive() {} },
    game: { setPause(_reason: string, value: boolean) { paused = value; }, app: { canvas: { style: { visibility: '' } } } } };
  const run = new RunController(deps as unknown as RunDeps);
  run.onUpgrade = () => { menus++; };
  return { world, state, profile, levels, run, get paused() { return paused; }, get menus() { return menus; } };
}

test('starting and changing floors grant no choice; earned XP pauses for one valid upgrade', () => {
  const f = fixture(), { run, world, state } = f;
  run.startRun('NIX', 123); run.update(world, 1 / 60);
  assert.equal(f.paused, false); assert.equal(f.menus, 0); assert.equal(run.upgradeOptions.length, 0);
  state.floor = 2; run.update(world, 1 / 60); assert.equal(f.menus, 0);
  run.awardExperience(40); run.update(world, 1 / 60); assert.equal(f.menus, 0);
  run.awardExperience(20); run.update(world, 1 / 60);
  assert.equal(f.paused, true); assert.equal(f.menus, 1); assert.equal(run.upgradeOptions.length, 3);
  assert.equal(run.upgradeLevel, 2); assert.equal(run.chooseUpgrade('NOT_OFFERED'), false);
  const first = run.upgradeOptions[0].id;
  assert.equal(run.chooseUpgrade(first), true); assert.equal(f.paused, false);
  assert.equal(run.chooseUpgrade(first), false); assert.equal(state.experience.pending, 0);
  state.floor = 3; run.update(world, 1 / 60); assert.equal(f.menus, 1);
});

test('several earned upgrades are chosen consecutively without resuming combat or losing XP', () => {
  const f = fixture(), { run, world, state } = f;
  run.startRun('NIX', 123); run.awardExperience(245); run.update(world, 1 / 60);
  const elapsed = run.elapsed;
  assert.equal(run.upgradeLevel, 2); assert.equal(state.experience.pending, 2);
  run.chooseUpgrade(run.upgradeOptions[0].id);
  assert.equal(f.paused, true); assert.equal(f.menus, 2); assert.equal(run.upgradeLevel, 3);
  assert.equal(state.experience.pending, 1); assert.equal(state.experience.xp, 95);
  run.chooseUpgrade(run.upgradeOptions[0].id);
  assert.equal(f.paused, false); assert.equal(run.upgradeOptions.length, 0);
  assert.equal(run.elapsed, elapsed); assert.equal(run.snapshot().upgrades.length, 2);
  run.awardExperience(25); run.update(world, 1 / 60);
  assert.equal(run.upgradeLevel, 4); assert.equal(state.experience.xp, 0);
  assert.equal(run.snapshot().experience, 270); assert.equal(run.snapshot().experienceLevel, 4);
});

test('restart clears XP and upgrades while keeping cosmetics; death cannot spend an upgrade', () => {
  const f = fixture(), { run, world, levels, state } = f;
  run.startRun('NIX', 123); run.awardExperience(60); run.update(world, 1 / 60);
  run.chooseUpgrade(run.upgradeOptions.find(u => !u.character)!.id);
  run.restartRun(); run.update(world, 1 / 60);
  assert.deepEqual(state.experience, { level: 1, xp: 0, total: 0, pending: 0 });
  assert.equal(run.snapshot().upgrades.length, 0); assert.equal(run.upgradeOptions.length, 0);
  assert.equal(world.get(levels.player!, 'character')!.def.look!.skin, 'NEON');
  assert.equal(world.get(levels.player!, 'character')!.def.ability.duration, 3);
  run.awardExperience(60); run.update(world, 1 / 60);
  world.get(levels.player!, 'health')!.hp = 0;
  assert.equal(run.chooseUpgrade(run.upgradeOptions[0].id), false);
  run.over = true; assert.equal(run.awardExperience(60), 0);
});


test('practice cannot award XP, unlock cosmetics, report or finalize a real run',()=>{
  const f=fixture(),before=structuredClone(f.profile.value);let reports=0,starts=0;
  const deps=(f.run as unknown as {deps:RunDeps}).deps;deps.onRunReport=()=>reports++;deps.onStart=()=>starts++;
  f.run.startPractice('MORSA');f.state.kills=999;f.state.floor=10;f.run.update(f.world,1);
  assert.equal(f.run.awardExperience(1000),0);f.run.reportProgress();f.run.endRun();f.run.quitToMenu();
  assert.deepEqual(f.profile.value,before);assert.equal(reports,0);assert.equal(starts,0);
  f.run.startRun('NIX',123);assert.equal(f.run.practice,false);assert.equal(starts,1);
});
