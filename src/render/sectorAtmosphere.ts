import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE as T } from '../config';
import type { Dungeon } from '../world/DungeonGenerator';

const ACCENT = { MILITARY: 0xdab271, URBAN: 0x71b5c3, LAB: 0x8cdbcb } as const;
const LABELS: Record<string, string> = { ENTRY: 'INGRESO', SECURITY: 'SEGURIDAD', LAB: 'BIO / LAB', DEPOT: 'CARGA', WORKSHOP: 'MANTENIMIENTO', MEDICAL: 'CLÍNICA', EXTRACTION: 'EXTRACCIÓN', TECH: 'TELEMETRÍA', SERVICE: 'SERVICIO' };

/** Painted once per floor, below actors and fog: no new collision or vision geometry. */
export function sectorAtmosphere(dungeon: Dungeon): Container {
  const root = new Container();
  const paint = new Graphics();
  root.addChild(paint);
  for (const [index, room] of dungeon.rooms.entries()) {
    const color = ACCENT[room.sector];
    const x = (room.x + 1) * T, y = (room.y + 1) * T;
    const label = new Text({ text: `${String(index + 1).padStart(2, '0')} / ${LABELS[room.kind] ?? room.kind}`, style: { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, fill: color } });
    label.position.set(x + 8, y + 9);
    label.alpha = .32;
    root.addChild(label);
    for (let ty = room.y; ty < room.y + room.height; ty++) {
      for (let tx = room.x; tx < room.x + room.width; tx++) {
        if (dungeon.map.get(tx, ty) !== 'FLOOR') continue;
        const seed = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
        const px = tx * T, py = ty * T;
        const wall = dungeon.map.blocksSight(tx, ty - 1);
        if (wall && seed % 3 === 0) {
          // Recessed wall strips reflect onto the nearest plate.
          paint.rect(px + 7, py + 2, T - 14, 2).fill({ color, alpha: .65 });
          paint.poly([px + 7, py + 5, px + T - 7, py + 5, px + T - 2, py + 23, px + 2, py + 23]).fill({ color, alpha: .045 });
        }
        if (room.sector === 'MILITARY' && wall && seed % 4 === 0) {
          for (let k = 0; k < 4; k++) paint.poly([px + 4 + k * 10, py + 7, px + 9 + k * 10, py + 7, px + 5 + k * 10, py + 14, px + k * 10, py + 14]).fill({ color, alpha: .23 });
        } else if (room.sector === 'URBAN' && seed % 11 === 0) {
          // Oil pools, with a thin broken highlight rather than a glowing floor.
          paint.ellipse(px + 24, py + 26, 18, 9).fill({ color: 0x070e17, alpha: .32 });
          paint.moveTo(px + 12, py + 22).quadraticCurveTo(px + 22, py + 17, px + 34, py + 23).stroke({ color, width: .8, alpha: .22 });
          paint.moveTo(px + 16, py + 28).lineTo(px + 29, py + 28).stroke({ color: 0xd9b17c, width: .8, alpha: .15 });
        } else if (room.sector === 'LAB' && seed % 7 === 0) {
          paint.moveTo(px + 4, py + 8).lineTo(px + 17, py + 8).lineTo(px + 25, py + 16).lineTo(px + 25, py + 36).stroke({ color, alpha: .15, width: 1 });
          paint.circle(px + 25, py + 36, 2).stroke({ color, alpha: .3, width: 1 });
        }
        if (seed % 17 === 0) {
          // Service access grilles: static, directional texture across all sectors.
          paint.roundRect(px + 10, py + 15, 27, 19, 2).fill({ color: 0x080e13, alpha: .45 }).stroke({ color: 0x879b9e, width: 1, alpha: .16 });
          for (let k = 0; k < 5; k++) paint.moveTo(px + 14 + k * 4.5, py + 18).lineTo(px + 14 + k * 4.5, py + 30).stroke({ color: 0x738b92, width: 1.4, alpha: .19 });
        }
      }
    }
  }
  return root;
}
