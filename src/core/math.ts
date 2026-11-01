export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolates along the shortest arc, so 3.1 -> -3.1 does not spin the long way. */
export const lerpAngle = (a: number, b: number, t: number): number =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
