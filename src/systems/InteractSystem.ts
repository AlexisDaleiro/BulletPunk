import type { SoundManager } from '../audio/SoundManager';
import { addAmmo, giveWeapon } from '../combat/loadout';
import { isWeaponId } from '../combat/weapons';
import { COLORS, KEY_INFO, TILE_SIZE } from '../config';
import type {
  HealthComponent,
  InteractableComponent,
  PassiveSynergyComponent,
  TransformComponent,
  WeaponInventoryComponent,
} from '../ecs/components';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';
import { spawnFlash } from '../entities/effects';
import { createPickup } from '../entities/pickups';
import { rollChest, type LootContext, type Reward } from '../rewards/rewards';
import type { Level } from '../game/Level';
import type { GameState } from '../game/GameState';
import type { NoiseField } from '../noise/NoiseField';
import { addImplant, IMPLANTS, isImplantId } from '../shop/implants';
import type { Door } from '../world/locks';
import type { RenderSystem } from './RenderSystem';

const T = TILE_SIZE;
/** How close (px, to the nearest door tile or the elevator) the player must stand. */
const DOOR_REACH = 78;
/** How close (px) to a chest, pedestal or terminal. */
const PROP_REACH = 58;
/** A secret wall is pushed from right next to it. */
const SECRET_REACH = TILE_SIZE * 1.15;

interface Candidate {
  dist: number;
  /** Prompt text; `{E}` is replaced by the HUD with the interact key or button name. */
  label: string;
  run: () => void;
}

/**
 * Everything the interact key (E / the HACK button) can do: unlock doors, open chests, buy from
 * the shop, repair at a medical station, use the security terminal, push a suspicious wall panel
 * (no prompt: spotting it is the player's job) and call the elevator. Each step
 * it offers the nearest option as `state.prompt` and runs it when the player presses interact.
 */
export class InteractSystem implements System {
  /** Current floor; set by the LevelManager. */
  level: Level | null = null;
  /** Called when the player takes the elevator with the Core Override Key. */
  onDescend: (() => void) | null = null;
  private readonly renderer: RenderSystem;
  private readonly field: NoiseField;
  private readonly state: GameState;
  private readonly audio: SoundManager;

  constructor(renderer: RenderSystem, field: NoiseField, state: GameState, audio: SoundManager) {
    this.renderer = renderer;
    this.field = field;
    this.state = state;
    this.audio = audio;
  }

  update(world: World): void {
    this.state.prompt = null;
    const level = this.level;
    if (!level) return;

    world.each(
      ['playerControlled', 'transform', 'intent', 'weaponInventory', 'health', 'passiveSynergy'],
      (player, _tag, t, intent, inv, health, syn) => {
        const options = this.options(world, level, player, t, inv, health, syn);
        if (options.length === 0) {
          if (intent.wantsInteract) this.pushWall(level, t);
          return;
        }
        options.sort((a, b) => a.dist - b.dist);
        this.state.prompt = options[0].label;
        if (intent.wantsInteract) options[0].run();
      },
    );
  }

  private options(
    world: World,
    level: Level,
    player: Entity,
    t: TransformComponent,
    inv: WeaponInventoryComponent,
    health: HealthComponent,
    syn: PassiveSynergyComponent,
  ): Candidate[] {
    const out: Candidate[] = [];

    for (const door of level.dungeon.doors) {
      if (door.unlocked) continue;
      let dist = Infinity;
      for (const tile of door.tiles) dist = Math.min(dist, Math.hypot((tile.x + 0.5) * T - t.x, (tile.y + 0.5) * T - t.y));
      if (dist > DOOR_REACH) continue;
      const has = this.state.keys[door.color];
      out.push({
        dist,
        label: has ? `{E} UNLOCK ${door.color.toUpperCase()} DOOR` : `${KEY_INFO[door.color].name} REQUIRED`,
        run: () => this.openDoor(level, door, player, t),
      });
    }

    const el = level.dungeon.elevator;
    const elevatorDist = Math.hypot((el.x + 0.5) * T - t.x, (el.y + 0.5) * T - t.y);
    if (elevatorDist <= DOOR_REACH) {
      out.push({
        dist: elevatorDist,
        label: this.state.keys.gold ? `{E} DESCEND TO FLOOR ${this.state.floor + 1}` : `${KEY_INFO.gold.name} REQUIRED`,
        run: () => this.useElevator(),
      });
    }

    world.each(['interactable', 'transform'], (entity, ic, pt) => {
      if (ic.used) return;
      const dist = Math.hypot(pt.x - t.x, pt.y - t.y);
      if (dist > PROP_REACH) return;
      switch (ic.kind) {
        case 'CHEST':
          out.push({ dist, label: `{E} OPEN ${ic.label}`, run: () => this.openChest(world, entity, ic, pt, player, inv, health, syn) });
          break;
        case 'SHOP_ITEM':
          out.push({ dist, label: `{E} BUY ${ic.label} - ${ic.cost}¢`, run: () => this.buy(world, entity, ic, inv, syn) });
          break;
        case 'MEDIC':
          out.push({ dist, label: `{E} REPAIR - ${ic.cost}¢`, run: () => this.repair(world, entity, ic, health) });
          break;
        case 'TERMINAL':
          out.push({ dist, label: '{E} USE SECURITY TERMINAL', run: () => this.useTerminal(world, entity, ic, level, pt, player) });
          break;
      }
    });
    return out;
  }

  private openDoor(level: Level, door: Door, player: Entity, t: TransformComponent): void {
    const info = KEY_INFO[door.color];
    if (!this.state.keys[door.color]) {
      this.deny(`${info.name} REQUIRED`);
      return;
    }
    this.state.keys[door.color] = false; // cards are single-use
    level.unlockDoor(door);
    this.field.emit('UTILITY', t.x, t.y, player);
    this.audio.playDoorUnlock(t);
    this.state.toast('DOOR UNLOCKED');
  }

  private useElevator(): void {
    if (!this.state.keys.gold) {
      this.deny(`${KEY_INFO.gold.name} REQUIRED`);
      return;
    }
    this.state.toast('DESCENDING...', 1.5);
    this.onDescend?.();
  }

  private openChest(world: World, chest: Entity, ic: InteractableComponent, pt: TransformComponent, player: Entity, inv: WeaponInventoryComponent, health: HealthComponent, syn: PassiveSynergyComponent): void {
    const c = world.get(chest, 'chest');
    if (!c || ic.used || c.state !== 'CLOSED') return;
    ic.used = true;
    c.state = 'OPENING';
    c.t = 0;
    this.field.emit('UTILITY', pt.x, pt.y, player);
    this.audio.playChestOpen(pt, c.family === 'SPECIAL' ? c.tier : 0);
    spawnFlash(world, this.renderer, pt.x, pt.y, c.family === 'SPECIAL' ? [COLORS.cyan, COLORS.amber, 0xff4fa3][c.tier - 1] : 0xfff0c2, 26 + 6 * c.tier, 0.35);

    const ctx: LootContext = {
      hp: health.hp, maxHp: health.maxHp, shield: health.shield, maxShield: health.maxShield,
      weapons: inv.slots.map((s) => s.id), usesAmmo: inv.reserve.some(Number.isFinite), implants: syn.passives.map((p) => p.id),
    };
    const rewards = rollChest(c.family, c.category, c.tier, c.seed, this.state.floor, ctx);
    const spots = this.freeSpots(this.level as Level, pt, rewards.length);
    rewards.forEach((r: Reward, i) => createPickup(world, this.renderer, spots[i].x, spots[i].y, { kind: r.kind, id: r.id, amount: r.amount }));
    this.state.toast(c.family === 'SPECIAL' ? `${ic.label} OPENED` : `${ic.label} OPENED`);
  }

  /** Nearest walkable tile centers around a point (never the chest's own tile), so loot never lands inside an obstacle. */
  private freeSpots(level: Level, from: TransformComponent, n: number): { x: number; y: number }[] {
    const cx = Math.floor(from.x / T);
    const cy = Math.floor(from.y / T);
    const out: { x: number; y: number }[] = [];
    for (let r = 1; r <= 3 && out.length < n; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || out.length >= n || level.map.isSolid(cx + dx, cy + dy)) continue;
          out.push({ x: (cx + dx + 0.5) * T, y: (cy + dy + 0.5) * T });
        }
      }
    }
    while (out.length < n) out.push({ x: from.x, y: from.y });
    return out;
  }

  /** Pushes the suspicious panel right next to the player, if there is one. No prompt ever points at it. */
  private pushWall(level: Level, t: TransformComponent): void {
    for (const s of level.dungeon.plan.secrets) {
      if (level.found.has(s.id)) continue;
      if (Math.hypot((s.wall.x + 0.5) * T - t.x, (s.wall.y + 0.5) * T - t.y) > SECRET_REACH) continue;
      level.revealSecret(s);
      return;
    }
  }

  private buy(world: World, item: Entity, ic: InteractableComponent, inv: WeaponInventoryComponent, syn: PassiveSynergyComponent): void {
    if (this.state.credits < ic.cost) {
      this.deny(`NEED ${ic.cost}¢`);
      return;
    }
    const [kind, id] = ic.payload.split(':');
    if (kind === 'WEAPON' && isWeaponId(id)) giveWeapon(inv, id, 2);
    else if (kind === 'IMPLANT' && isImplantId(id)) addImplant(syn, IMPLANTS[id]);
    else if (kind === 'AMMO' && !addAmmo(inv, 2)) {
      this.deny('NO AMMO NEEDED');
      return;
    }
    this.state.credits -= ic.cost;
    world.destroy(item);
    this.state.toast(`${ic.label} ACQUIRED`);
    this.audio.playPurchase();
  }

  private repair(world: World, station: Entity, ic: InteractableComponent, health: HealthComponent): void {
    if (health.hp >= health.maxHp && health.shield >= health.maxShield) {
      this.state.toast('SYSTEMS NOMINAL');
      return;
    }
    if (this.state.credits < ic.cost) {
      this.deny(`NEED ${ic.cost}¢`);
      return;
    }
    this.state.credits -= ic.cost;
    health.hp = health.maxHp;
    health.shield = health.maxShield;
    ic.used = true;
    const r = world.get(station, 'renderable');
    if (r) r.node.alpha = 0.45;
    this.state.toast('SYSTEMS RESTORED');
    this.audio.playPurchase();
  }

  private useTerminal(world: World, node: Entity, ic: InteractableComponent, level: Level, pt: TransformComponent, player: Entity): void {
    ic.used = true;
    const r = world.get(node, 'renderable');
    if (r) r.node.alpha = 0.55;
    const shutters = level.openShutters();
    let lasers = 0;
    world.each(['hazard'], (_e, h) => {
      if (h.kind === 'LASER' && !h.disabled) {
        h.disabled = true;
        lasers++;
      }
    });
    this.field.emit('UTILITY', pt.x, pt.y, player);
    this.audio.playDoorUnlock(pt);
    this.state.toast(shutters + lasers > 0 ? `${shutters > 0 ? 'VAULT SHUTTER OPEN' : ''}${shutters > 0 && lasers > 0 ? ' · ' : ''}${lasers > 0 ? 'TRIPWIRES OFFLINE' : ''}` : 'NOTHING TO UNLOCK');
  }

  private deny(text: string): void {
    this.state.toast(text);
    this.audio.playDenied();
  }
}
