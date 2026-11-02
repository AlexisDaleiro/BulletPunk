import { Container, Sprite, type Renderer, type Texture } from 'pixi.js';

const textures = new Map<string, { texture: Texture; x: number; y: number }>();

/** Bake static painted parts once per skin. Sprites share textures across bots and floors. */
export function cachedArt(key: string, art: Container, renderer: Renderer): Sprite {
  let entry = textures.get(key);
  if (!entry) {
    const bounds = art.getLocalBounds();
    entry = { texture: renderer.generateTexture({ target: art, resolution: 2 }), x: bounds.x, y: bounds.y };
    textures.set(key, entry);
  }
  art.destroy({ children: true, context: true });
  const sprite = new Sprite(entry.texture);
  sprite.position.set(entry.x, entry.y);
  return sprite;
}
