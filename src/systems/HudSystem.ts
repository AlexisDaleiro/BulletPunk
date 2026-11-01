import { Graphics, Text } from 'pixi.js';
import { COLORS } from '../config';
import type { HealthComponent, WeaponInventoryComponent } from '../ecs/components';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RenderSystem } from './RenderSystem';

const SEGMENTS = 10;
const SEG_W = 14;
const SEG_GAP = 3;
const SEG_H = 7;
const MAGENTA = 0xff007f;

const mono = (size: number, fill: number) => ({ fontFamily: 'monospace', fontSize: size, fill, align: 'center' as const });

/** Screen-space HUD: segmented shield (cyan) and health (magenta), weapon and ammo, death screen. */
export class HudSystem implements System {
  private readonly renderer: RenderSystem;
  private readonly bars = new Graphics();
  private readonly weaponText = new Text({ text: '', style: mono(14, COLORS.cyan) });
  private readonly deathText = new Text({
    text: 'SIGNAL LOST\nPRESS ANY KEY OR TAP TO RESTART',
    style: mono(26, COLORS.red),
  });
  private dead = false;

  constructor(renderer: RenderSystem) {
    this.renderer = renderer;
  }

  init(): void {
    this.weaponText.anchor.set(0.5, 1);
    this.deathText.anchor.set(0.5);
    this.deathText.visible = false;
    this.renderer.hud.addChild(this.bars, this.weaponText, this.deathText);
  }

  resize(width: number, height: number): void {
    this.weaponText.position.set(width / 2, height - 14);
    this.deathText.position.set(width / 2, height / 2);
  }

  render(world: World): void {
    let drawn = false;
    world.each(['team', 'health', 'weaponInventory'], (_entity, team, health, inv) => {
      if (drawn || team.team !== 'PLAYER') return;
      drawn = true;
      this.draw(health, inv);
    });
  }

  private draw(health: HealthComponent, inv: WeaponInventoryComponent): void {
    this.bars.clear();
    this.segments(28, health.shield, health.maxShield, COLORS.cyan);
    this.segments(40, health.hp, health.maxHp, MAGENTA);

    const weapon = inv.slots[inv.activeSlot];
    const reserve = inv.reserve[inv.activeSlot];
    const picker = inv.slots.map((_, i) => (i === inv.activeSlot ? `[${i + 1}]` : ` ${i + 1} `)).join('');
    let text = `${picker}\n${weapon.name}\n${inv.magazine[inv.activeSlot]} / ${Number.isFinite(reserve) ? reserve : '∞'}`;
    if (inv.reloadTimer > 0) text += `\nRELOADING ${Math.round((1 - inv.reloadTimer / weapon.reloadTime) * 100)}%`;
    if (this.weaponText.text !== text) this.weaponText.text = text;

    if (health.hp <= 0 && !this.dead) {
      this.dead = true;
      this.deathText.visible = true;
      // Short delay so the key or tap that killed you does not instantly restart.
      setTimeout(() => {
        const restart = (): void => location.reload();
        window.addEventListener('keydown', restart, { once: true });
        window.addEventListener('pointerdown', restart, { once: true });
      }, 700);
    }
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
}
