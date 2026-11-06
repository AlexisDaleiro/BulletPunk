import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE as T } from '../config';
import type { Dungeon } from '../world/DungeonGenerator';
/** Static materials are quieter than interactables and combat warnings. */
export function districtMarkings(d: Dungeon): Container {
  const root = new Container(),
    paint = new Graphics();
  root.addChild(paint);
  for (const [rn, r] of d.rooms.entries()) {
    if (r.width < 6 || r.height < 6) continue;
    const x = (r.x + 1) * T,
      y = (r.y + r.height - 2) * T,
      w = (r.width - 2) * T;
    const color = r.sector === 'LAB' ? 0x9ed6d4 : r.sector === 'MILITARY' ? 0xd3b278 : 0x9faaa3;
    if (r.sector === 'LAB') {
      paint.roundRect(x + 4, y - 18, w - 8, 18, 5).fill({ color: 0x749da5, alpha: 0.08 });
      paint
        .moveTo(x + 5, y - 22)
        .lineTo(x + w - 5, y - 22)
        .stroke({ color, width: 1.5, alpha: 0.28 });
      for (let i = 0; i < 3; i++) paint.circle(x + 14 + i * 9, y - 9, 2).fill({ color, alpha: 0.4 });
    } else if (r.sector === 'MILITARY') {
      for (let i = 0; i < Math.min(w - 20, 150); i += 16)
        paint.poly([x + i, y, x + i + 8, y, x + i + 16, y + 10, x + i + 8, y + 10]).fill({ color, alpha: 0.2 });
      paint
        .moveTo(x, y - 35)
        .lineTo(x, y - 25)
        .lineTo(x + 35, y - 25)
        .stroke({ color, width: 2, alpha: 0.2 });
    } else {
      paint
        .moveTo(x + 10, y + 10)
        .lineTo(x + w - 10, y + 10)
        .stroke({ color: 0xa4bbaf, width: 2, alpha: 0.18 });
      for (let i = 0; i < 3; i++)
        paint
          .moveTo(x + 30 + i * 14, y - 12)
          .lineTo(x + 22 + i * 14, y - 4)
          .stroke({ color, width: 3, alpha: 0.2 });
    }
    if (rn % 2 === 0) {
      const sign = new Text({
        text: `${r.sector === 'LAB' ? 'L' : r.sector === 'MILITARY' ? 'M' : 'U'} / ${String(rn + 1).padStart(2, '0')}`,
        style: { fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', fill: color, letterSpacing: 2 },
      });
      sign.position.set(x + w - 85, y - 15);
      sign.alpha = 0.24;
      root.addChild(sign);
    }
  }
  return root;
}
