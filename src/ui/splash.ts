import type { CharacterDef } from '../characters/characters';
import { el } from './dom';

export const SPLASH_ROOT = `${import.meta.env.BASE_URL}art/splash/`;

/** Marketing artwork stays independent of the tactical sprites used in the simulation. */
export function operativeSplash(def: CharacterDef, className: string, decorative = false): HTMLImageElement {
  const image = el('img', className);
  image.src = `${SPLASH_ROOT}${def.id.toLowerCase()}.webp`;
  image.alt = decorative ? '' : `Splash art de ${def.name}, ${def.role.toLowerCase()}`;
  image.decoding = 'async';
  image.draggable = false;
  image.width = 1024;
  image.height = 1536;
  return image;
}

/** CSS transforms animate only a few composited layers, with a reduced-motion alternative. */
export function cinematicBackdrop(): HTMLElement {
  const root = el('div', 'cinematic-backdrop');
  root.setAttribute('aria-hidden', 'true');
  const art = el('div', 'cinematic-art');
  art.style.backgroundImage = `url("${SPLASH_ROOT}title.webp")`;
  root.append(art, el('div', 'cinematic-haze'), el('div', 'cinematic-rain'), el('div', 'cinematic-grain'));
  return root;
}
