import type { Renderer } from 'pixi.js';
import { OperativeGraphic } from '../characters/OperativeGraphic';
import type { CharacterDef } from '../characters/characters';
import { WEAPONS } from '../combat/weapons';
import { Container, Graphics } from 'pixi.js';

/** The operative's in-game graphic drawn once into a canvas, for the character cards. */
export function operativePreview(renderer: Renderer, def: CharacterDef): HTMLCanvasElement {
  const stage = new Container();
  stage.addChild(new Graphics().rect(0, 0, 180, 160).fill({ color: 0x000000, alpha: 0 }));
  const graphic = new OperativeGraphic(def, WEAPONS[def.weapon].type, renderer);
  graphic.position.set(90, 95);
  graphic.rotation = -Math.PI / 2 + 0.25;
  graphic.scale.set(2.2);
  stage.addChild(graphic);
  const canvas = renderer.extract.canvas({ target: stage, resolution: 2 }) as HTMLCanvasElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.destroy({ children: true });
  return canvas;
}
