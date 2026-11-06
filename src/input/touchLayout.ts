import { TOUCH_ACTIONS, type TouchAction, type TouchSettings } from '../settings/Settings.ts';

export interface TouchPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Same layout for the live overlay and its editor. Positions are normalized and mirrored as a unit. */
export function touchLayout(
  width: number,
  height: number,
  settings: TouchSettings,
): Record<TouchAction, TouchPlacement> {
  const size = Math.max(44, Math.min(50, height * 0.12) * settings.touchScale),
    gap = 6;
  const right = width - 12 - size / 2,
    bottom = height - 12 - size / 2;
  const defaults = {
    swap: [right - 2 * (size + gap), bottom - size - gap],
    reload: [right - size - gap, bottom - size - gap],
    interact: [right, bottom - size - gap],
    ability: [right - size - gap, bottom],
    dash: [Math.min(128, width * 0.16) + size / 2, bottom],
  };
  const result = {} as Record<TouchAction, TouchPlacement>;
  for (const action of TOUCH_ACTIONS) {
    const custom = settings.touchPositions[action],
      w = action === 'ability' ? size * 3 + gap * 2 : size;
    let x = custom ? custom.x * width : defaults[action][0],
      y = custom ? custom.y * height : defaults[action][1];
    if (settings.touchLeftHanded) x = width - x;
    x = Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, x));
    y = Math.max(size / 2 + 54, Math.min(height - size / 2 - 8, y));
    result[action] = { x, y, width: w, height: size };
  }
  return result;
}
