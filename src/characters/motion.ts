export interface MotionStyle { stride: number; step: number; bob: number; sway: number; reloadTilt: number; handReach: number }
const STYLES: Record<string, MotionStyle> = {
  NIX: { stride: .085, step: 4.2, bob: .35, sway: .018, reloadTilt: -.65, handReach: 8 },
  BRASA: { stride: .052, step: 3.1, bob: 1.1, sway: .035, reloadTilt: -.12, handReach: 17 },
  VECTOR: { stride: .06, step: 3.7, bob: .3, sway: .012, reloadTilt: -.3, handReach: 12 },
  SUTURA: { stride: .067, step: 3.4, bob: .55, sway: .022, reloadTilt: -.5, handReach: 10 },
  VOLT: { stride: .092, step: 4.5, bob: .8, sway: .045, reloadTilt: .48, handReach: 15 },
  MORSA: { stride: .043, step: 2.6, bob: 1.25, sway: .04, reloadTilt: .24, handReach: 19 },
};
export const motionStyle = (id: string): MotionStyle => STYLES[id] ?? STYLES.SUTURA;
