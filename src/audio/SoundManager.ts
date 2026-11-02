import type { WeaponType } from '../types';

export interface SoundPos {
  x: number;
  y: number;
}

interface ToneSpec {
  type: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  delay?: number;
  at?: SoundPos;
}

interface NoiseSpec {
  dur: number;
  gain: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  delay?: number;
  at?: SoundPos;
}

/** Sounds farther than this from the listener are skipped; closer ones fade with the square of distance. */
const HEARING_RANGE = 900;

/**
 * Procedural sound: every effect is built from oscillators, a white-noise buffer and gain/filter
 * envelopes. No audio files. Positioned sounds are panned and attenuated against the listener
 * (the player), so a distant firefight is faint and off to one side. The context starts on the
 * first key or pointer press (browser autoplay rules). Press M to mute.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.5;
  /** Called when the M key flips mute. */
  onMuteChange: ((muted: boolean) => void) | null = null;
  private readonly listener: SoundPos = { x: 0, y: 0 };

  constructor() {
    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      unlock();
      // Typing an "m" into the profile name must not mute the game.
      if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) this.toggleMute();
    });
  }

  setListener(x: number, y: number): void {
    this.listener.x = x;
    this.listener.y = y;
  }

  /** Master volume, 0..1. */
  setVolume(volume: number): void {
    this.volume = volume;
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  /** The M key. Reports the change so the saved setting follows it. */
  toggleMute(): void {
    this.setMuted(!this.muted);
    this.onMuteChange?.(this.muted);
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  // --- the sound set ---------------------------------------------------------------------

  /** Frequency ramp 1200 Hz -> 200 Hz over 0.1 s through a band-pass; other guns vary around it. */
  playLaserShoot(type: WeaponType, at?: SoundPos): void {
    switch (type) {
      case 'SMG':
        this.tone({ type: 'square', from: 1000, to: 250, dur: 0.07, gain: 0.16, filter: { type: 'bandpass', freq: 900, q: 3 }, at });
        break;
      case 'SHOTGUN':
        this.burst({ dur: 0.2, gain: 0.35, filter: { type: 'lowpass', freq: 1800 }, at });
        this.tone({ type: 'square', from: 320, to: 70, dur: 0.16, gain: 0.25, filter: { type: 'lowpass', freq: 700 }, at });
        break;
      case 'RAILGUN':
        this.tone({ type: 'sawtooth', from: 2400, to: 60, dur: 0.45, gain: 0.3, filter: { type: 'bandpass', freq: 1200, q: 2 }, at });
        this.burst({ dur: 0.12, gain: 0.3, filter: { type: 'highpass', freq: 3000 }, at });
        break;
      default:
        this.tone({ type: 'sawtooth', from: 1200, to: 200, dur: 0.1, gain: 0.22, filter: { type: 'bandpass', freq: 700, q: 4 }, at });
    }
  }

  /** White-noise burst with a fast exponential decay (0.05 s). */
  playBulletImpact(at?: SoundPos): void {
    this.burst({ dur: 0.05, gain: 0.22, filter: { type: 'bandpass', freq: 2200, q: 1 }, at });
  }

  /** Low sine thump: 80 Hz for 0.04 s. The grate is a little higher and brighter. */
  playFootstep(surface: 'METAL' | 'GRATE', at?: SoundPos): void {
    const grate = surface === 'GRATE';
    this.tone({ type: 'sine', from: grate ? 110 : 80, dur: 0.04, gain: 0.3, filter: { type: 'lowpass', freq: grate ? 320 : 200 }, at });
  }

  /** Double electronic chime: 880 Hz then 1760 Hz. */
  playDoorUnlock(at?: SoundPos): void {
    this.tone({ type: 'sine', from: 880, dur: 0.16, gain: 0.25, at });
    this.tone({ type: 'sine', from: 1760, dur: 0.2, gain: 0.22, delay: 0.12, at });
  }

  playReload(at?: SoundPos): void {
    this.burst({ dur: 0.03, gain: 0.2, filter: { type: 'highpass', freq: 3500 }, at });
    this.burst({ dur: 0.04, gain: 0.25, filter: { type: 'highpass', freq: 2500 }, delay: 0.16, at });
  }

  playPickup(): void {
    this.tone({ type: 'triangle', from: 660, to: 990, dur: 0.12, gain: 0.22 });
  }

  playPurchase(): void {
    this.tone({ type: 'sine', from: 660, dur: 0.1, gain: 0.2 });
    this.tone({ type: 'sine', from: 880, dur: 0.1, gain: 0.2, delay: 0.08 });
    this.tone({ type: 'sine', from: 1320, dur: 0.16, gain: 0.2, delay: 0.16 });
  }

  playDenied(): void {
    this.tone({ type: 'square', from: 130, to: 90, dur: 0.18, gain: 0.18, filter: { type: 'lowpass', freq: 400 } });
  }

  /** Two-tone alarm when a bot spots the player. */
  playAlert(at?: SoundPos): void {
    this.tone({ type: 'square', from: 600, dur: 0.1, gain: 0.14, at });
    this.tone({ type: 'square', from: 900, dur: 0.14, gain: 0.14, delay: 0.1, at });
  }

  playExplosion(at?: SoundPos): void {
    this.burst({ dur: 0.5, gain: 0.5, filter: { type: 'lowpass', freq: 500 }, at });
    this.tone({ type: 'sine', from: 70, to: 30, dur: 0.5, gain: 0.5, at });
  }

  playDeath(): void {
    this.tone({ type: 'sawtooth', from: 420, to: 40, dur: 0.9, gain: 0.3, filter: { type: 'lowpass', freq: 900 } });
  }

  playElevator(): void {
    this.tone({ type: 'sine', from: 180, to: 760, dur: 0.9, gain: 0.25 });
    this.tone({ type: 'triangle', from: 90, to: 380, dur: 0.9, gain: 0.2 });
  }

  // --- plumbing --------------------------------------------------------------------------

  private unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const limiter = this.ctx.createDynamicsCompressor();
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);

      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.startHum();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Quiet 55 Hz reactor drone with a slow swell. */
  private startHum(): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.2;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.015;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master as GainNode);
    osc.start();
    lfo.start();
  }

  /** Attenuation and stereo pan for a sound at `at`; null when out of earshot. */
  private spatial(at?: SoundPos): { gain: number; pan: number } | null {
    if (!at) return { gain: 1, pan: 0 };
    const dx = at.x - this.listener.x;
    const dy = at.y - this.listener.y;
    const d = Math.hypot(dx, dy);
    if (d > HEARING_RANGE) return null;
    const k = 1 - d / HEARING_RANGE;
    return { gain: k * k, pan: Math.max(-1, Math.min(1, dx / 500)) };
  }

  /** A fresh gain -> panner -> master chain for one sound, or null when silent or not yet unlocked. */
  private route(at?: SoundPos): GainNode | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return null;
    const s = this.spatial(at);
    if (!s || s.gain < 0.01) return null;
    const gain = ctx.createGain();
    gain.gain.value = s.gain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = s.pan;
    gain.connect(pan);
    pan.connect(master);
    return gain;
  }

  private tone(spec: ToneSpec): void {
    const out = this.route(spec.at);
    if (!out) return;
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime + (spec.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.from, t0);
    if (spec.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.to), t0 + spec.dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(spec.gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    this.chain(osc, spec.filter, env, out);
    osc.start(t0);
    osc.stop(t0 + spec.dur + 0.02);
  }

  private burst(spec: NoiseSpec): void {
    const out = this.route(spec.at);
    if (!out || !this.noise) return;
    const ctx = this.ctx as AudioContext;
    const t0 = ctx.currentTime + (spec.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const env = ctx.createGain();
    env.gain.setValueAtTime(spec.gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
    this.chain(src, spec.filter, env, out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + spec.dur + 0.02);
  }

  /** source -> [filter] -> envelope -> out */
  private chain(source: AudioNode, filter: ToneSpec['filter'], env: GainNode, out: AudioNode): void {
    let node = source;
    if (filter) {
      const f = (this.ctx as AudioContext).createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 1;
      source.connect(f);
      node = f;
    }
    node.connect(env);
    env.connect(out);
  }
}
