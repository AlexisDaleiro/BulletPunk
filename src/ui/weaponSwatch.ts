import type { WeaponDefinition } from '../types';
import { weaponVisual } from '../characters/weaponVisual';

/** A readable menu swatch of the selected weapon finish, using the same model proportions. */
export function weaponSwatch(weapon: WeaponDefinition, finish: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 76;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${weapon.name}, acabado ${finish}`);
  const ctx = canvas.getContext('2d')!;
  const model = weaponVisual(weapon);
  ctx.translate(12, 30); ctx.scale(5.2, 5.2);
  const shell = finish === 'COPPER' ? '#b58055' : finish === 'ION' ? '#243d53' : '#7b9295';
  const glow = finish === 'ION' ? '#7df3ef' : finish === 'COPPER' ? '#f5d19b' : `#${model.color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = .7; ctx.strokeStyle = '#071219'; ctx.fillStyle = shell;
  ctx.fillRect(2, -2, 10, 5); ctx.strokeRect(2, -2, 10, 5);
  ctx.fillRect(9, -model.width / 2, model.length - 12, model.width); ctx.strokeRect(9, -model.width / 2, model.length - 12, model.width);
  ctx.fillRect(11, 3, 4, 5); ctx.strokeRect(11, 3, 4, 5);
  if (model.style === 'BELT') { ctx.beginPath(); ctx.ellipse(15, 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (model.style === 'LANCE' || model.style === 'HEAVY_RAIL') { ctx.fillRect(11, -model.width / 2 - 3, 10, 3); ctx.strokeRect(11, -model.width / 2 - 3, 10, 3); }
  if (model.style === 'SUPPRESSED') { ctx.fillStyle = '#16272d'; ctx.fillRect(model.length - 19, -3.5, 12, 7); ctx.strokeRect(model.length - 19, -3.5, 12, 7); }
  ctx.fillStyle = glow;
  ctx.fillRect(11, -.7, model.length - 21, 1.4);
  if (model.style === 'ARC') for (let i = 0; i < 3; i++) ctx.fillRect(14 + i * 3, -4, .9, 8);
  return canvas;
}
