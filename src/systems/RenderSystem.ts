import { Container, Text, type Application } from 'pixi.js';
import { COLORS, VIEW_SPAN } from '../config';
import { lerp, lerpAngle } from '../core/math';
import type { System } from '../ecs/System';
import type { Entity, World } from '../ecs/World';

/** Spec render order 1-5, back to front. Post-process (6) and HUD (7) wrap them below. */
export type LayerName = 'floor' | 'shadows' | 'entities' | 'vision' | 'ripples';

export class RenderSystem implements System {
  readonly layers: Record<LayerName, Container> = {
    floor: new Container(),
    shadows: new Container(),
    entities: new Container(),
    vision: new Container(),
    ripples: new Container(),
  };
  /** Camera space: holds layers 1-5, moved and scaled every frame. */
  readonly scene = new Container();
  /** Layer 6: filter host (CRT/bloom attach here), so filters see the whole world, not the HUD. */
  readonly post = new Container();
  /** Layer 7: screen space, never touched by the camera. */
  readonly hud = new Container();
  cameraTarget: Entity | null = null;

  private readonly app: Application;
  private width = 1;
  private height = 1;
  private readonly stats = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 12, fill: COLORS.cyan },
  });
  private statsTimer = 0;

  constructor(app: Application, world: World) {
    this.app = app;
    this.scene.addChild(
      this.layers.floor,
      this.layers.shadows,
      this.layers.entities,
      this.layers.vision,
      this.layers.ripples,
    );
    this.stats.position.set(8, 8);
    world.store('renderable').onRemove = (_, r) => r.node.destroy({ children: true });
  }

  init(): void {
    this.post.addChild(this.scene);
    this.hud.addChild(this.stats);
    this.app.stage.addChild(this.post, this.hud);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Puts `node` on a layer and links it to `entity`; destroying the entity destroys the node. */
  attach(world: World, entity: Entity, layer: LayerName, node: Container): void {
    this.layers[layer].addChild(node);
    world.add(entity, 'renderable', { node });
  }

  render(world: World, alpha: number, frameDt: number): void {
    world.each(['transform', 'renderable'], (_, t, r) => {
      r.node.position.set(lerp(t.prevX, t.x, alpha), lerp(t.prevY, t.y, alpha));
      r.node.rotation = lerpAngle(t.prevAngle, t.angle, alpha);
    });

    const target = this.cameraTarget === null ? undefined : world.get(this.cameraTarget, 'transform');
    const cx = target ? lerp(target.prevX, target.x, alpha) : 0;
    const cy = target ? lerp(target.prevY, target.y, alpha) : 0;
    const zoom = Math.min(this.width, this.height) / VIEW_SPAN;
    this.scene.scale.set(zoom);
    this.scene.position.set(this.width / 2 - cx * zoom, this.height / 2 - cy * zoom);

    this.statsTimer += frameDt;
    if (this.statsTimer >= 0.5) {
      this.statsTimer = 0;
      this.stats.text = `${Math.round(this.app.ticker.FPS)} FPS  ${world.entityCount} ENT`;
    }
  }
}
