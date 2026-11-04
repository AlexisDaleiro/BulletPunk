import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TILE_SIZE as T } from '../config';
import type { Dungeon } from '../world/DungeonGenerator';
import { lineOfSight } from '../world/raycast';

export interface CombatSource { x: number; y: number }
let vaporTexture: Texture | null = null;
function vapor(): Texture {
  if (vaporTexture) return vaporTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#dbe5dacc'); gradient.addColorStop(.4, '#b5d6d766'); gradient.addColorStop(1, '#a7bdc500');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  return vaporTexture = Texture.from(canvas);
}

/** Bounded ambient rigs below the fog. Reuses geometry and textures, without per-frame particles. */
export class LiveScenery extends Container {
  private readonly fans: Container[] = [];
  private readonly steam: { node: Sprite; x: number; y: number; phase: number }[] = [];
  private readonly monitors: { scan: Graphics; screen: Graphics; x: number; y: number; phase: number }[] = [];
  private readonly alarms: { beam: Graphics; lamp: Graphics; x: number; y: number; energy: number }[] = [];
  private time = 0;
  private readonly dungeon: Dungeon;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(dungeon: Dungeon) {
    super(); this.dungeon = dungeon;
    for (const [index, room] of dungeon.rooms.entries()) {
      if (this.fans.length + this.monitors.length >= 48) break;
      let point: { x: number; y: number } | null = null;
      for (let x = room.x + room.width - 2; x > room.x; x--) {
        if (dungeon.map.get(x, room.y + 1) === 'FLOOR') { point = { x: (x + .5) * T, y: (room.y + 1.5) * T }; break; }
      }
      if (!point) continue;
      const { x, y } = point;
      if (['WORKSHOP', 'SERVICE', 'DEPOT', 'ENTRY'].includes(room.kind)) {
        const base = new Graphics().roundRect(x - 14, y - 14, 28, 28, 3).fill(0x18252b).stroke({ color: 0x687e80, width: 1, alpha: .6 });
        const rotor = new Container(); rotor.position.set(x, y);
        const blades = new Graphics();
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          const points = [[2, -2], [12, -5], [10, 3], [2, 3]].flatMap(([px, py]) => [Math.cos(a) * px - Math.sin(a) * py, Math.sin(a) * px + Math.cos(a) * py]);
          blades.poly(points).fill(0x778c8c);
        }
        blades.circle(0, 0, 3).fill(0x24373e);
        rotor.addChild(blades); this.fans.push(rotor); this.addChild(base, rotor);
        if (room.kind !== 'ENTRY') {
          this.addChild(new Graphics().moveTo(x - 33, y - 8).lineTo(x - 25, y - 8).lineTo(x - 25, y + 13).lineTo(x - 18, y + 13).stroke({ color: 0x586c6e, width: 4 }).stroke({ color: 0x9aa9a0, width: 1, alpha: .5 }));
          for (let k = 0; k < 3; k++) {
          const node = new Sprite(vapor()); node.anchor.set(.5); node.tint = 0xc0d4ce;
          this.steam.push({ node, x: x - 19, y: y + 13, phase: index * .37 + k / 3 }); this.addChild(node);
          }
        }
      } else {
        const monitor = new Graphics().roundRect(x - 15, y - 10, 30, 20, 2).fill(0x18262b).stroke({ color: 0x6b8b8e, width: 1 });
        const screen = new Graphics().rect(x - 12, y - 7, 24, 14).fill({ color: 0x84cfc0, alpha: .16 });
        const scan = new Graphics();
        for (let i = 0; i < 4; i++) scan.rect(-10, -5 + i * 3, 5 + (index + i * 7) % 15, 1).fill({ color: 0x99e3cd, alpha: .7 });
        scan.position.set(x, y); this.monitors.push({ scan, screen, x, y, phase: index }); this.addChild(monitor, screen, scan);
      }
      if (room.sector === 'MILITARY' || room.kind === 'SECURITY' || room.kind === 'ENTRY') {
        const beam = new Graphics().poly([0, 0, 74, -21, 88, 0, 74, 21]).fill({ color: 0xf18b69, alpha: .055 });
        beam.position.set(x, y + 23);
        const lamp = new Graphics().circle(0, 0, 5).fill(0xf6b473).circle(0, 0, 2).fill(0xffead1); lamp.position.set(x, y + 23);
        this.alarms.push({ beam, lamp, x, y, energy: 0 }); this.addChild(beam, lamp);
      }
    }
  }

  tick(dt: number, sources: readonly CombatSource[]): void {
    this.time += dt;
    for (const [i, fan] of this.fans.entries()) fan.rotation = this.reduced ? 0 : this.time * (2.2 + i % 3 * .35);
    for (const puff of this.steam) {
      const phase = this.reduced ? .4 : (this.time * .28 + puff.phase) % 1;
      puff.node.position.set(puff.x + Math.sin(phase * 4) * 8, puff.y - phase * 40);
      puff.node.scale.set(.25 + phase * .55);
      puff.node.alpha = Math.sin(phase * Math.PI) * .17;
    }
    for (const monitor of this.monitors) {
      const active = this.nearCombat(monitor, sources);
      monitor.screen.tint = active ? 0xffb688 : 0xffffff;
      monitor.scan.alpha = active ? .95 : this.reduced ? .55 : .4 + Math.sin(this.time * 2 + monitor.phase) * .15;
      monitor.scan.x = monitor.x + (this.reduced ? 0 : Math.sin(this.time * .8 + monitor.phase) * 1.5);
    }
    for (const alarm of this.alarms) {
      alarm.energy = Math.max(this.nearCombat(alarm, sources) ? 1 : 0, alarm.energy - dt * .6);
      alarm.beam.rotation = this.reduced ? .5 : this.time * (alarm.energy > .1 ? 3 : .35);
      alarm.beam.alpha = .12 + alarm.energy * .88;
      alarm.lamp.tint = alarm.energy > .1 ? 0xff7f69 : 0x819e98;
      alarm.lamp.alpha = .3 + alarm.energy * (this.reduced ? .6 : .45 + Math.sin(this.time * 10) * .2);
    }
  }

  private nearCombat(point: CombatSource, sources: readonly CombatSource[]): boolean {
    return sources.some(source => Math.hypot(source.x - point.x, source.y - point.y) < 330
      && lineOfSight(this.dungeon.map, source.x, source.y, point.x, point.y));
  }
}
