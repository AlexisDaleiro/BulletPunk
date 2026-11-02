import { Container, Graphics, Text, type Renderer } from 'pixi.js';
import { OperativeGraphic } from './OperativeGraphic';
import type { EnemyAppearance } from './enemyAppearances';
import type { AIState, HealthComponent } from '../ecs/components';
import type { WeaponType } from '../types';

export class HostileGraphic extends OperativeGraphic {
  private readonly status = new Container();
  private readonly bars = new Graphics();
  private readonly mark = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: 0xffc0a0, stroke: { color: 0x111922, width: 3 } } });
  private readonly appearance: EnemyAppearance;

  constructor(appearance: EnemyAppearance, weapon: WeaponType, renderer: Renderer) {
    super(appearance, weapon, renderer);
    this.appearance = appearance;
    this.mark.anchor.set(0.5, 1);
    this.mark.y = -4;
    this.status.addChild(this.bars, this.mark);
    this.addChild(this.status);
  }

  animateHostile(dt: number, speed: number, recoil: number, h: HealthComponent, angle: number, state: AIState, reloadProgress: number): void {
    this.animateMotion(dt, speed, recoil, h, reloadProgress);
    const alerted = state === 'COMBAT_ENGAGE' || state === 'ALERT_ACQUIRE';
    const searching = state === 'INVESTIGATE_NOISE' || state === 'SEARCH_LOST_TARGET';
    this.status.position.set(-Math.sin(angle) * 24, -Math.cos(angle) * 24);
    this.status.rotation = -angle;
    this.mark.text = (h.hitFlash ?? 0) > 0 ? this.appearance.name : alerted ? '!' : searching ? '?' : '';
    this.mark.style.fill = alerted ? 0xff9b7d : 0xe8c58b;
    this.bars.clear();
    if (h.hp < h.maxHp && h.hp > 0) {
      this.bars.roundRect(-14, 0, 28, 3, 1).fill(0x18232b).stroke({ color: 0x070e13, width: 1 });
      this.bars.rect(-13, 0.5, 26 * h.hp / h.maxHp, 2).fill(this.appearance.color);
    }
  }
}
