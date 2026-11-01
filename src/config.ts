export const TILE_SIZE = 48;

/** Simulation step. Systems' `update` always receives exactly this dt. */
export const FIXED_DT = 1 / 60;
/** Longest real frame the loop will catch up on (avoids spiral of death after tab pause). */
export const MAX_FRAME_DT = 0.1;

export const MAX_PIXEL_RATIO = 2;
/** World pixels visible along the shorter screen side; camera zoom derives from it. */
export const VIEW_SPAN = 720;

export const COLORS = {
  background: 0x05060a,
  cyan: 0x00e5ff,
  grid: 0x10202e,
} as const;
