// A tiny Web Audio synth and step sequencer that plays the themes in
// themes.ts. Browsers only allow sound after the first click or key press, so
// the music starts on the first interaction. (Kiosk PCs can skip that with
// Chrome/Edge's --autoplay-policy=no-user-gesture-required.)
import { THEMES, type Theme, type ThemeId, type Wave } from './themes';

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const STEPS_PER_BAR = 16;
const BARS = 4;
const MUTE_KEY = 'picklerange.muted';

function midiToHz(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

/** Small seeded RNG so each theme's melody is always the same. */
function seeded(seed: number): () => number {
  let a = seed * 9301 + 49297;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

class Music {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Sound effects have their own volume and stay on when the music is muted. */
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private theme: Theme | null = null;
  private themeId: ThemeId | null = null;
  private melody: number[] = [];
  private step = 0;
  private nextTime = 0;
  private muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage blocked: default to sound on.
    }
    const unlock = () => this.ensureContext();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Switches to a theme (restarting it from the top if it changed). */
  play(id: ThemeId): void {
    if (id === this.themeId) return;
    this.themeId = id;
    this.theme = THEMES[id];
    this.melody = this.makeMelody(this.theme);
    this.step = 0;
    if (this.ctx) {
      // Short fade so switching games doesn't click.
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
      this.master.gain.linearRampToValueAtTime(this.targetVolume(), now + 0.6);
      this.nextTime = now + 0.05;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Not persisted; fine.
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.targetVolume(), this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private targetVolume(): number {
    return this.muted || !this.theme ? 0 : 0.32 * this.theme.volume;
  }

  private ensureContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.targetVolume();
    // Gentle compression keeps the mix even on cheap projector speakers.
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(comp);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.nextTime = this.ctx.currentTime + 0.05;
    window.setInterval(() => this.schedule(), TICK_MS);
  }

  /** A seeded melody: one scale degree per lead slot over the 4 bars (-1 = rest). */
  private makeMelody(theme: Theme): number[] {
    const rand = seeded(theme.seed);
    const slots = (STEPS_PER_BAR * BARS) / theme.leadEvery;
    const notes: number[] = [];
    let degree = 0;
    for (let i = 0; i < slots; i++) {
      if (rand() < 0.22) {
        notes.push(-1);
        continue;
      }
      // Mostly stepwise motion, with the odd leap.
      degree += rand() < 0.75 ? Math.round((rand() - 0.5) * 3) : Math.round((rand() - 0.5) * 7);
      degree = Math.max(-2, Math.min(9, degree));
      notes.push(degree);
    }
    return notes;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme || this.muted) {
      if (ctx) this.nextTime = Math.max(this.nextTime, ctx.currentTime);
      return;
    }
    const stepDur = 60 / theme.bpm / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      const swing = this.step % 2 === 1 ? theme.swing * stepDur : 0;
      this.playStep(theme, this.step, this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (STEPS_PER_BAR * BARS);
    }
  }

  private noteOf(theme: Theme, degree: number, octave = 0): number {
    const len = theme.scale.length;
    const oct = Math.floor(degree / len);
    const idx = ((degree % len) + len) % len;
    return theme.root + theme.scale[idx] + 12 * oct + octave;
  }

  private playStep(theme: Theme, step: number, t: number, stepDur: number): void {
    const inBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const chord = theme.progression[bar % theme.progression.length];
    const hit = (pattern: string) => pattern.length > 0 && pattern[inBar % pattern.length] === 'x';

    if (hit(theme.kick)) this.kick(t);
    if (hit(theme.snare)) this.snare(t);
    if (hit(theme.hat)) this.hat(t);

    const b = theme.bass[inBar % theme.bass.length];
    if (b === 'x' || b === 'o') {
      const degree = chord + (b === 'o' ? 4 : 0);
      this.tone(theme.bassWave, midiToHz(this.noteOf(theme, degree, -12)), t, stepDur * 1.8, 0.22, 900);
    }

    if (theme.pad && inBar === 0) {
      for (const d of [0, 2, 4]) {
        this.tone(theme.pad, midiToHz(this.noteOf(theme, chord + d)), t, stepDur * STEPS_PER_BAR, 0.045, 1400, true);
      }
    }

    if (theme.lead !== 'none' && inBar % theme.leadEvery === 0) {
      let degree: number;
      if (theme.lead === 'arp') {
        const chordTones = [0, 2, 4, 7];
        degree = chord + chordTones[(inBar / theme.leadEvery) % chordTones.length];
      } else {
        const slot = Math.floor(step / theme.leadEvery) % this.melody.length;
        degree = this.melody[slot];
        if (degree < 0) return;
      }
      const length = stepDur * theme.leadEvery * (theme.leadWave === 'sine' ? 1.6 : 0.9);
      this.tone(theme.leadWave, midiToHz(this.noteOf(theme, degree, theme.leadOctave)), t, length, 0.09, 3200);
    }
  }

  /** One note with an envelope, through a low-pass filter. */
  private tone(wave: Wave, hz: number, t: number, dur: number, gain: number, cutoff: number, soft = false): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = hz;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    const attack = soft ? dur * 0.3 : 0.005;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

/**
   * Game sound effects:
   * hit = bright two-note blip, big = rising fanfare (bullseye, bonus, combo),
   * miss = soft low "whomp", bad = buzzer (bomb, no-shoot, lost life).
   */
  sfx(kind: 'hit' | 'big' | 'miss' | 'bad'): void {
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const note = (wave: Wave, hz: number, at: number, dur: number, gain: number, toHz?: number) => {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(hz, at);
      if (toHz) osc.frequency.exponentialRampToValueAtTime(toHz, at + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(gain, at + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(env).connect(this.sfxGain);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };
    switch (kind) {
      case 'hit':
        note('triangle', 880, t, 0.12, 0.5);
        note('triangle', 1320, t + 0.06, 0.18, 0.45);
        break;
      case 'big':
        // C–E–G–C arpeggio with a bright square on top, then a shimmer.
        [523, 659, 784, 1047].forEach((hz, i) => {
          note('square', hz, t + i * 0.08, 0.3, 0.22);
          note('triangle', hz * 2, t + i * 0.08, 0.35, 0.18);
        });
        note('sine', 2093, t + 0.32, 0.8, 0.2);
        this.noiseBurstTo(this.sfxGain, t + 0.32, 0.6, 0.12, 'highpass', 6000);
        break;
      case 'miss':
        note('sine', 260, t, 0.35, 0.5, 90);
        this.noiseBurstTo(this.sfxGain, t, 0.12, 0.15, 'lowpass', 600);
        break;
      case 'bad':
        note('square', 140, t, 0.45, 0.28);
        note('sawtooth', 147, t, 0.45, 0.2);
        break;
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env.gain.setValueAtTime(0.6, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private noiseBurst(t: number, dur: number, gain: number, type: BiquadFilterType, freq: number): void {
    this.noiseBurstTo(this.master, t, dur, gain, type, freq);
  }

  private noiseBurstTo(out: AudioNode, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(env).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number): void {
    this.noiseBurst(t, 0.16, 0.35, 'bandpass', 1800);
  }

  private hat(t: number): void {
    this.noiseBurst(t, 0.04, 0.12, 'highpass', 7000);
  }
}

export const music = new Music();
