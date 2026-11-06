import { Graphics, Text } from 'pixi.js';
import { COLORS, KEY_INFO, TILE_SIZE } from '../config';
import type { CharacterComponent, HealthComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { GameState } from '../game/GameState';
import type { Level } from '../game/Level';
import type { KeyColor } from '../types';
import type { FogSystem } from './FogSystem';
import type { RenderSystem } from './RenderSystem';
import { experienceRequired } from '../run/experience';

const SEGMENTS = 10;
const SEG_W = 14;
const SEG_GAP = 3;
const SEG_H = 7;
const MAGENTA = 0xff007f;
const KEY_ORDER: readonly KeyColor[] = ['red', 'blue', 'gold'];

const MINIMAP_SIZE = 132;
const TOUCH_MINIMAP_SIZE = 92;
const MINIMAP_MARGIN = 8;
/** The minimap is redrawn at most this often (seconds), however fast tiles get explored. */
const MINIMAP_REFRESH = 0.15;
const MINI_FLOOR = 0x14566b;
const MINI_WALL = 0x24424f;
const MINI_SHOP = 0x9a8a1c;

const mono = (size: number, fill: number, align: 'left' | 'center' = 'center') => ({ fontFamily: 'monospace', fontSize: size, fill, align });

/**
 * Screen-space HUD: segmented shield (cyan) and health (magenta), keycard ledger, floor and credits,
 * weapon and ammo, the interact prompt and toasts, a minimap of explored rooms, and the death screen.
 */
export class HudSystem implements System {
  onAbilityStatus: ((text: string, ready: boolean, active: boolean) => void) | null = null;
  /** Current floor, for the minimap; set by the LevelManager. */
  level: Level | null = null;
  private readonly renderer: RenderSystem;
  private readonly state: GameState;
  private readonly fog: FogSystem;
  private readonly bars = new Graphics();
  private readonly mini = new Graphics();
  private readonly dot = new Graphics();
  private readonly info = new Text({ text: '', style: mono(12, COLORS.cyan, 'left') });
  private readonly abilityText = new Text({ text: '', style: mono(11, 0xd8e4df, 'left') });
  private readonly experienceText = new Text({ text: '', style: mono(10, 0xe6bf83, 'left') });
  private readonly weaponText = new Text({ text: '', style: mono(14, COLORS.cyan) });
  private readonly promptText = new Text({ text: '', style: mono(15, COLORS.amber) });
  private readonly toastText = new Text({ text: '', style: mono(16, COLORS.amber) });
  /** Called once when the player's HP reaches zero; the UI shows the game-over screen. */
  onDeath: (() => void) | null = null;
  private width = 1;
  private height = 1;
  private dead = false;
  private miniLevel: Level | null = null;
  private miniVersion = -1;
  private miniFogVersion = -1;
  private miniTimer = 0;
  private miniSize = MINIMAP_SIZE;

  constructor(renderer: RenderSystem, state: GameState, fog: FogSystem) {
    this.renderer = renderer;
    this.state = state;
    this.fog = fog;
  }

  init(): void {
    this.info.position.set(8, 52);
    this.abilityText.position.set(8, 108);
    this.experienceText.position.set(8, 140);
    this.weaponText.anchor.set(0.5, 1);
    this.promptText.anchor.set(0.5, 1);
    this.toastText.anchor.set(0.5, 0);
    this.toastText.style.wordWrap = true;
    this.renderer.hud.addChild(this.bars, this.mini, this.dot, this.info, this.weaponText, this.promptText, this.toastText, this.abilityText, this.experienceText);
  }

  /** Blanks the HUD for a new run: nothing from the last one (death flag, minimap cache, texts) survives. */
  reset(): void {
    this.dead = false;
    this.miniLevel = null;
    this.miniVersion = this.miniFogVersion = -1;
    this.miniTimer = 0;
    this.bars.clear();
    this.mini.clear();
    this.dot.clear();
    this.info.text = this.weaponText.text = this.promptText.text = this.toastText.text = '';
    this.abilityText.text = '';
    this.experienceText.text = '';
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.mini.position.set(width - this.miniSize - MINIMAP_MARGIN, MINIMAP_MARGIN);
    this.weaponText.position.set(width / 2, height - 14);
    this.promptText.position.set(width / 2, height - 100);
    this.toastText.position.set(width / 2, 64);
    this.toastText.style.wordWrapWidth = Math.max(150, Math.min(680, width - 360));
  }

  render(world: World, _alpha: number, frameDt: number): void {
    const miniSize = this.state.touch ? TOUCH_MINIMAP_SIZE : MINIMAP_SIZE;
    if (miniSize !== this.miniSize) {
      this.miniSize = miniSize;
      this.miniLevel = null; // Redraw immediately when changing input mode, even without a resize.
      this.mini.position.set(this.width - miniSize - MINIMAP_MARGIN, MINIMAP_MARGIN);
    }
    const toastSize = this.state.touch ? 11 : 14;
    if (this.toastText.style.fontSize !== toastSize) this.toastText.style.fontSize = toastSize;
    this.weaponText.y = this.height - (this.state.touch ? 94 : 14);
    this.promptText.y = this.height - (this.state.touch ? 170 : 100);
    this.state.tick(frameDt);
    this.miniTimer += frameDt;
    let drawn = false;
    world.each(['team', 'health', 'weaponInventory', 'passiveSynergy', 'transform'], (_entity, team, health, inv, syn, t) => {
      if (drawn || team.team !== 'PLAYER') return;
      drawn = true;
      this.draw(health, inv, syn.passives.length);
      this.drawAbility(world.get(_entity, 'character'), health);
      this.drawExperience();
      this.drawMinimap(t.x, t.y);
    });
    this.drawOverlays(health0(world));
  }

  private drawExperience(): void {
    const xp = this.state.experience, required = experienceRequired(xp.level);
    this.experienceText.text = `NV ${xp.level} · XP ${xp.xp}/${required}`;
    this.bars.roundRect(8, 155, 166, 4, 1).fill({ color: 0xe6bf83, alpha: .15 });
    if (xp.xp > 0) this.bars.roundRect(8, 155, 166 * xp.xp / required, 4, 1).fill({ color: 0xe6bf83, alpha: .9 });
  }

  private drawAbility(c: CharacterComponent | undefined, h: HealthComponent): void {
    if (!c) return;
    const a = c.def.ability;
    const active = c.activeRemaining > 0 && h.hp > 0;
    const ready = c.cooldownRemaining === 0 && h.hp > 0;
    const status = h.hp <= 0 ? 'SIN SEÑAL' : active ? `ACTIVA · ${c.activeRemaining.toFixed(1)} s` : ready ? 'LISTA' : `RECARGA · ${c.cooldownRemaining.toFixed(1)} s`;
    const key = this.state.touch ? 'SKILL' : 'F';
    this.abilityText.text = `${c.def.name} / [${key}] ${a.name}\n${status}${(h.temporaryShield ?? 0) > 0 ? ` · +${Math.ceil(h.temporaryShield!)} ESCUDO` : ''}${c.upgrades?.length ? ` · EVO ${c.upgrades.length}` : ''}`;
    this.abilityText.style.fill = c.def.color;
    const progress = active ? c.activeRemaining / a.duration : 1 - c.cooldownRemaining / a.cooldown;
    this.bars.roundRect(8, 96, 166, 4, 1).fill({ color: c.def.color, alpha: 0.15 });
    if (progress > 0) this.bars.roundRect(8, 96, Math.max(1, 166 * progress), 4, 1).fill({ color: c.def.color, alpha: ready ? 1 : 0.65 });
    this.onAbilityStatus?.(h.hp <= 0 ? 'SKILL\n—' : active ? `ACTIVA\n${Math.ceil(c.activeRemaining)}s` : ready ? 'SKILL' : `SKILL\n${Math.ceil(c.cooldownRemaining)}s`, ready, active);
  }

  private draw(health: HealthComponent, inv: WeaponInventoryComponent, implants: number): void {
    this.bars.clear();
    this.segments(28, health.shield, health.maxShield, COLORS.cyan);
    this.segments(40, health.hp, health.maxHp, MAGENTA);
    this.ledger();

    const infoText = this.state.practice?'PRÁCTICA / BLANCOS REGENERABLES':`FLOOR ${this.state.floor}   ¢ ${this.state.credits}   IMPLANTS ${implants}`;
    if (this.info.text !== infoText) this.info.text = infoText;

    const weapon = inv.slots[inv.activeSlot];
    const reserve = inv.reserve[inv.activeSlot];
    const picker = inv.slots.map((_, i) => (i === inv.activeSlot ? `[${i + 1}]` : ` ${i + 1} `)).join('');
    let text = `${picker}\n${weapon.name}\n${inv.magazine[inv.activeSlot]} / ${Number.isFinite(reserve) ? reserve : '∞'}`;
    if (inv.reloadTimer > 0) text += `\nRELOADING ${Math.round((1 - inv.reloadTimer / weapon.reloadTime) * 100)}%`;
    if (this.weaponText.text !== text) this.weaponText.text = text;

    if (health.hp <= 0 && !this.dead) {
      this.dead = true;
      this.onDeath?.();
    }
  }

  /** Interact prompt and toast. `{E}` becomes the key or button the player actually has. */
  private drawOverlays(alive: boolean): void {
    const key = this.state.touch ? '[HACK]' : '[E]';
    const prompt = alive && this.state.prompt ? this.state.prompt.replace('{E}', key) : '';
    if (this.promptText.text !== prompt) this.promptText.text = prompt;

    const toast = this.state.toastTimer > 0 ? this.state.toastText : '';
    if (this.toastText.text !== toast) this.toastText.text = toast;
    this.toastText.alpha = Math.min(1, this.state.toastTimer / 0.6);
  }

  /** Keycard ledger: a square per card, lit once collected. */
  private ledger(): void {
    KEY_ORDER.forEach((color, i) => {
      const x = 8 + i * 20;
      const info = KEY_INFO[color];
      this.bars.rect(x, 74, 14, 14).fill({ color: info.color, alpha: this.state.keys[color] ? 1 : 0.1 }).stroke({ width: 1, color: info.color, alpha: 0.6 });
    });
  }

  /** Ten pips; each fills in proportion to its share of `max`. */
  private segments(y: number, value: number, max: number, color: number): void {
    if (max <= 0) return;
    for (let i = 0; i < SEGMENTS; i++) {
      const fill = Math.max(0, Math.min(1, (value / max) * SEGMENTS - i));
      const x = 8 + i * (SEG_W + SEG_GAP);
      this.bars.rect(x, y, SEG_W, SEG_H).fill({ color, alpha: 0.15 });
      if (fill > 0) this.bars.rect(x, y, SEG_W * fill, SEG_H).fill(color);
    }
  }

  /** Explored tiles only: floor, walls, locked doors in their card color, the elevator, the shop. */
  private drawMinimap(px: number, py: number): void {
    const level = this.level;
    if (!level) return;
    const map = level.map;
    const scale = this.miniSize / Math.max(map.width, map.height);

    const stale = level !== this.miniLevel || level.version !== this.miniVersion || this.fog.version !== this.miniFogVersion;
    if (stale && (this.miniTimer >= MINIMAP_REFRESH || level !== this.miniLevel)) {
      this.miniTimer = 0;
      this.miniLevel = level;
      this.miniVersion = level.version;
      this.miniFogVersion = this.fog.version;

      const shop = level.dungeon.rooms.find((r) => r.type === 'SHOP');
      const doorColors = new Map<number, number>();
      for (const door of level.dungeon.doors) {
        if (door.unlocked) continue;
        for (const t of door.tiles) doorColors.set(t.y * map.width + t.x, KEY_INFO[door.color].color);
      }

      const groups = new Map<number, number[]>();
      const add = (color: number, x: number, y: number): void => {
        const g = groups.get(color);
        if (g) g.push(x, y);
        else groups.set(color, [x, y]);
      };
      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          const tile = map.get(tx, ty);
          if (tile === 'VOID' || !this.fog.isExplored(tx, ty)) continue;
          const inShop = shop !== undefined && tx >= shop.x && tx < shop.x + shop.width && ty >= shop.y && ty < shop.y + shop.height;
          let color: number;
          if (tile === 'DOOR_LOCKED') color = doorColors.get(ty * map.width + tx) ?? COLORS.amber;
          else if (tile === 'EXIT_ELEVATOR') color = COLORS.amber;
          else if (map.isSolid(tx, ty)) color = MINI_WALL;
          else color = inShop ? MINI_SHOP : MINI_FLOOR;
          add(color, tx * scale, ty * scale);
        }
      }

      this.mini.clear().rect(0, 0, this.miniSize, this.miniSize).fill({ color: 0x000000, alpha: 0.55 }).stroke({ width: 1, color: COLORS.cyan, alpha: 0.5 });
      for (const [color, points] of groups) {
        for (let i = 0; i < points.length; i += 2) this.mini.rect(points[i], points[i + 1], scale + 0.4, scale + 0.4);
        this.mini.fill(color);
      }
    }

    this.dot.clear().circle(this.width - this.miniSize - MINIMAP_MARGIN + (px / TILE_SIZE) * scale, MINIMAP_MARGIN + (py / TILE_SIZE) * scale, 2.6).fill(COLORS.cyan);
  }
}

/** True while the player has HP left (the prompt is hidden on the death screen). */
function health0(world: World): boolean {
  let alive = false;
  world.each(['team', 'health'], (_entity, team, h) => {
    if (team.team === 'PLAYER' && h.hp > 0) alive = true;
  });
  return alive;
}
