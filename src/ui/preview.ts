import type { Renderer } from 'pixi.js';
import { createOperativeGraphic } from '../entities/player';

/** The operative's in-game graphic drawn once into a canvas, for the character cards. */
export function operativePreview(renderer: Renderer, color: number): HTMLCanvasElement {
  const graphic = createOperativeGraphic(color);
  const canvas = renderer.extract.canvas({ target: graphic, resolution: 3 }) as HTMLCanvasElement;
  graphic.destroy({ children: true });
  return canvas;
}
