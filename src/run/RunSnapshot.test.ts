import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCharacter } from '../characters/characters.ts';
import {
  createHealth,
  createLocomotion,
  createPassiveSynergy,
  createTransform,
  createVision,
} from '../ecs/components.ts';
import { createExperience } from './experience.ts';
import { layoutHash, parseRunSnapshot, type RunSnapshot } from './RunSnapshot.ts';

function fixture(): RunSnapshot {
  const { polygon: _, ...vision } = createVision();
  return {
    version: 1,
    worldVersion: 1,
    savedAt: new Date().toISOString(),
    run: {
      runId: crypto.randomUUID(),
      seed: 4294967295,
      elapsed: 20,
      reportSeq: 4,
      generation: 0,
      characterId: 'NIX',
      upgradeOptions: ['NIX_ECHO', 'LONG_CYCLE', 'BALLISTICS'],
    },
    level: {
      floor: 1,
      credits: 8,
      kills: 2,
      experience: { ...createExperience(), level: 2, pending: 1 },
      keys: { red: false, blue: true, gold: false },
      width: 96,
      height: 96,
      layoutHash: layoutHash(['FLOOR', 'WALL']),
      pendingFloor: null,
      tiles: [{ x: 2, y: 3, tile: 'RUBBLE' }],
      doors: [true],
      found: ['secret-1'],
      obstacleHp: [[5, 12]],
    },
    entities: [
      {
        id: 0,
        kind: 'player',
        data: {
          transform: createTransform(20, 40),
          health: createHealth(),
          locomotion: createLocomotion(),
          passiveSynergy: createPassiveSynergy(),
          team: { team: 'PLAYER' },
          character: {
            def: getCharacter('NIX'),
            activeRemaining: 1,
            cooldownRemaining: 8,
            activationFlash: 0,
            recoil: 0,
            trailTimer: 0,
          },
        },
        vision,
        weapons: {
          slots: ['PLASMA_PISTOL'],
          activeSlot: 0,
          magazine: [3],
          reserve: [null],
          reloadTimer: 0.5,
          fireCooldown: 0,
        },
      },
    ],
    fog: [0, 1, 2],
    noise: { nextId: 10, events: [] },
    environment: { hint: 0, alarms: [] },
  };
}

test('checkpoint JSON round trip preserves infinite-ammo sentinel, offers and unsigned seeds without shared state', () => {
  const original = fixture(),
    result = parseRunSnapshot(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(result, original);
  result.entities[0].data.health!.hp = 1;
  assert.notEqual(result.entities[0].data.health!.hp, original.entities[0].data.health!.hp);
});

test('unsupported, incomplete or corrupt checkpoints are rejected before restoring a world', () => {
  const mutations: ((s: RunSnapshot) => void)[] = [
    (s) => {
      s.version++;
    },
    (s) => {
      s.worldVersion++;
    },
    (s) => {
      s.entities = [];
    },
    (s) => {
      s.entities.push(structuredClone(s.entities[0]));
    },
    (s) => {
      s.entities[0].data.health!.hp = 0;
    },
    (s) => {
      s.entities[0].data.transform!.x = Infinity;
    },
    (s) => {
      s.entities[0].weapons!.slots[0] = 'MISSING_WEAPON';
    },
    (s) => {
      s.entities[0].weapons!.slots[0] = 'ARC_SMG';
    },
    (s) => {
      s.entities[0].weapons!.activeSlot = 2;
    },
    (s) => {
      s.level.tiles[0].x = 1000;
    },
    (s) => {
      s.level.obstacleHp[0][0] = -1;
    },
    (s) => {
      s.fog.push(99999);
    },
    (s) => {
      s.level.experience.pending = 2;
    },
    (s) => {
      s.run.upgradeOptions[0] = 'BRASA_NOVA';
    },
    (s) => {
      s.environment.alarms = [[99, { left: 1, pulse: 1 }]];
    },
    (s) => {
      s.entities.push({
        id: 1,
        kind: 'hazard',
        data: {
          transform: createTransform(10, 10),
          hazard: { kind: 'LASER', x: 0, y: 0, w: 10, h: 10, disabled: false, clock: 0, active: false, hit: [999] },
        },
      });
    },
  ];
  for (const mutate of mutations) {
    const s = fixture();
    mutate(s);
    assert.throws(() => parseRunSnapshot(s), /guardado está dañado/);
  }
  const poisoned = JSON.parse(JSON.stringify(fixture()));
  poisoned.entities[0].data.__proto__ = null;
  Object.defineProperty(poisoned, '__proto__', { value: {}, enumerable: true });
  assert.throws(() => parseRunSnapshot(poisoned));
});
