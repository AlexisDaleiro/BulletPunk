import { Graphics, Sprite, Texture } from 'pixi.js';
import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import type { RenderSystem } from './RenderSystem';
import { visualQuality } from '../render/visualQuality';
import { canSee, raycastTiles } from '../world/raycast';
import type { TileMap } from '../world/TileMap';

/** Threat cues survive every quality setting. Hidden enemies never emit light or markers. */
export class TacticalReadabilitySystem implements System {
  visibleThreats = 0;
  lightCount = 0;
  map: TileMap | null = null;
  private readonly markers = new Graphics();
  private readonly lights: Sprite[] = [];
  private readonly renderer: RenderSystem;
  private shownMap: TileMap | null = null;
  constructor(renderer: RenderSystem) {
    this.renderer = renderer;
  }
  init(): void {
    this.renderer.layers.vision.addChild(this.markers);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#ffffff66');
    gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = Texture.from(canvas);
    for (let i = 0; i < 12; i++) {
      const light = new Sprite(texture);
      light.anchor.set(0.5);
      light.blendMode = 'add';
      light.visible = false;
      this.renderer.layers.floor.addChild(light);
      this.lights.push(light);
    }
  }
  render(world: World): void {
    this.visibleThreats = 0;
    this.lightCount = 0;
    this.markers.clear();
    for (const light of this.lights) light.visible = false;
    const map = this.map,
      id = this.renderer.cameraTarget;
    if (!map || id === null) return;
    if (this.shownMap !== map) {
      this.shownMap = map;
      for (const light of this.lights)
        this.renderer.layers.floor.setChildIndex(light, this.renderer.layers.floor.children.length - 1);
    }
    const p = world.get(id, 'transform'),
      v = world.get(id, 'vision');
    if (!p || !v) return;
    let lit = 0;
    const glow = (x: number, y: number, color: number, size: number, alpha: number): void => {
      if (lit >= Math.min(this.lights.length, visualQuality.budget.lights)) return;
      const node = this.lights[lit++];
      this.lightCount = lit;
      node.visible = true;
      node.position.set(x, y);
      node.width = node.height = size;
      node.tint = color;
      node.alpha = alpha;
    };
    const character = world.get(id, 'character');
    if (visualQuality.preset !== 'FLUID') glow(p.x, p.y, character?.def.color ?? 0x90ceb5, 85, 0.07);
    world.each(['aiController', 'transform', 'health', 'renderable', 'weaponInventory'], (_e, ai, t, h, r, inv) => {
      if (!r.node.visible || h.hp <= 0) return;
      if (
        !canSee(
          map,
          p.x,
          p.y,
          p.angle,
          v.fov + (world.get(id, 'passiveSynergy')?.stats.visionAngleBonus ?? 0),
          v.effectiveRange ?? v.range,
          t.x,
          t.y,
        )
      )
        return;
      this.visibleThreats++;
      const half = world.get(_e, 'collider')?.halfSize ?? 14;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          this.markers
            .moveTo(t.x + sx * (half + 5), t.y + sy * (half - 1))
            .lineTo(t.x + sx * (half + 5), t.y + sy * (half + 5))
            .lineTo(t.x + sx * (half - 1), t.y + sy * (half + 5))
            .stroke({ color: 0xf59b7d, width: 1, alpha: 0.55 });
      if (ai.state === 'ALERT_ACQUIRE') {
        const angle = Math.atan2(ai.lastSeenY - t.y, ai.lastSeenX - t.x),
          reach = Math.min(160, Math.hypot(ai.lastSeenY - t.y, ai.lastSeenX - t.x));
        const ex = t.x + Math.cos(angle) * reach,
          ey = t.y + Math.sin(angle) * reach,
          hit = raycastTiles((x, y) => map.isSolid(x, y), t.x, t.y, ex, ey),
          fraction = hit?.t ?? 1;
        this.markers
          .moveTo(t.x, t.y)
          .lineTo(t.x + (ex - t.x) * fraction, t.y + (ey - t.y) * fraction)
          .stroke({ color: 0xffc38c, width: 2, alpha: 0.4 });
        this.markers.circle(t.x, t.y, half + 10).stroke({ color: 0xffbd86, width: 2, alpha: 0.8 });
        this.markers.poly([t.x, t.y - 30, t.x - 4, t.y - 22, t.x + 4, t.y - 22]).fill(0xffd0a1);
      }
      if (visualQuality.preset !== 'FLUID' && (world.get(_e, 'enemyVisual')?.recoil ?? 0) > 0.25)
        glow(t.x, t.y, 0xffa15d, 75, 0.18);
      if (inv.reloadTimer > 0)
        this.markers
          .arc(
            t.x,
            t.y,
            half + 8,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - inv.reloadTimer / inv.slots[inv.activeSlot].reloadTime),
          )
          .stroke({ color: 0xe6b97a, width: 1.6, alpha: 0.8 });
    });
    world.each(['interactable', 'transform'], (_e, item, t) => {
      if (
        item.used ||
        Math.hypot(t.x - p.x, t.y - p.y) > 190 ||
        !canSee(map, p.x, p.y, p.angle, v.fov, v.effectiveRange ?? v.range, t.x, t.y)
      )
        return;
      const color = item.kind === 'TERMINAL' ? 0x8fc5ff : item.kind === 'MEDIC' ? 0x9cdbb6 : 0xe4c38b;
      this.markers
        .poly([t.x, t.y - 24, t.x + 4, t.y - 20, t.x, t.y - 16, t.x - 4, t.y - 20])
        .stroke({ color, width: 1.5, alpha: 0.9 });
      if (visualQuality.preset !== 'FLUID') glow(t.x, t.y, color, 65, 0.08);
    });
    if ((character?.recoil ?? 0) > 0.2 && visualQuality.preset !== 'FLUID')
      glow(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 0xffd69b, 110, 0.2);
  }
}
