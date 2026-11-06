import type { QualityPreset } from '../settings/Settings.ts';
export const QUALITY = {
  FLUID: { label: 'Fluido', resolution: 1, particles: 64, motes: 0, lights: 8, reflections: false, steam: false },
  BALANCED: {
    label: 'Equilibrado',
    resolution: 1.5,
    particles: 112,
    motes: 12,
    lights: 18,
    reflections: true,
    steam: true,
  },
  CINEMATIC: {
    label: 'Cinemático',
    resolution: 2,
    particles: 160,
    motes: 24,
    lights: 36,
    reflections: true,
    steam: true,
  },
} as const;
export const visualQuality = {
  preset: 'BALANCED' as QualityPreset,
  get budget() {
    return QUALITY[this.preset];
  },
};
/** Only sustained slow gameplay can reduce quality. Simulation and preferences never change. */
export class FrameBudget {
  private samples: number[] = [];
  private cooldown = 0;
  reset(): void {
    this.samples = [];
    this.cooldown = 0;
  }
  sample(ms: number, current: QualityPreset): QualityPreset {
    if (!Number.isFinite(ms) || ms <= 0 || ms > 180) return current;
    if (this.cooldown > 0) {
      this.cooldown -= ms;
      return current;
    }
    this.samples.push(ms);
    if (this.samples.length < 180) return current;
    const sorted = this.samples.sort((a, b) => a - b),
      p90 = sorted[Math.floor(sorted.length * 0.9)];
    this.samples = [];
    this.cooldown = 10000;
    return p90 > 25 ? (current === 'CINEMATIC' ? 'BALANCED' : 'FLUID') : current;
  }
}
