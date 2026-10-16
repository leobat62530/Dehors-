/**
 * Short synthesised sounds on WebAudio. No file, no dependency. The context opens on the first
 * user gesture, pauses when the tab is hidden, and respects the mute setting.
 */
export type SoundKind = 'kick' | 'bounce' | 'coin' | 'obstacle' | 'wall' | 'crash' | 'barrier' | 'rocket' | 'buy' | 'record' | 'tap' | 'trophy' | 'helmet';

export class Sounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.8;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;

  /** Call from a pointer handler: browsers refuse audio before a gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  play(kind: SoundKind, intensity = 1): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const k = Math.min(1, Math.max(0.2, intensity));
    switch (kind) {
      case 'kick':
        this.noise(0.12, 0.5, 900);
        this.tone(110, 0.18, 'sine', 0.6, 50);
        break;
      case 'bounce':
        this.tone(320 + 300 * k, 0.12, 'triangle', 0.35 * k, 480 + 300 * k);
        break;
      case 'coin':
        this.tone(1320, 0.07, 'square', 0.12);
        this.tone(1760, 0.12, 'square', 0.12, undefined, 0.07);
        break;
      case 'obstacle':
        this.tone(180, 0.25, 'sawtooth', 0.3, 90);
        break;
      case 'wall':
        this.noise(0.25, 0.6, 1800);
        this.tone(90, 0.3, 'sine', 0.5, 40);
        break;
      case 'crash':
        this.noise(0.4, 0.7, 600);
        this.tone(70, 0.5, 'sine', 0.6, 30);
        break;
      case 'barrier':
        this.noise(0.6, 0.8, 300);
        this.tone(60, 0.8, 'sine', 0.7, 25);
        break;
      case 'rocket':
        this.noise(0.5, 0.4, 2500);
        this.tone(200, 0.5, 'sawtooth', 0.25, 800);
        break;
      case 'buy':
        this.tone(880, 0.1, 'square', 0.15);
        this.tone(1320, 0.16, 'square', 0.15, undefined, 0.1);
        break;
      case 'record':
      case 'trophy':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.25, undefined, i * 0.11));
        break;
      case 'tap':
        this.tone(600, 0.04, 'square', 0.08);
        break;
      case 'helmet':
        // The helmet cracks: a sharp snap, then two falling notes.
        this.noise(0.08, 0.9, 5000);
        this.tone(1400, 0.12, 'square', 0.25, 400);
        this.tone(900, 0.3, 'triangle', 0.3, 180, 0.06);
        break;
    }
  }

  /**
   * Skid loop while the character scrapes the ground: `level` 0 stops it, otherwise it sets the
   * loudness and pitch. Safe to call every frame; the loop is created on first use and reused.
   */
  skid(level: number): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running' || !this.enabled) level = 0;
    if (level <= 0) {
      if (this.skidGain) this.skidGain.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.05);
      return;
    }
    const ctx = this.ctx!;
    if (!this.skidGain) {
      const length = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master!);
      src.start();
      this.skidGain = g;
      this.skidFilter = filter;
    }
    const k = Math.min(1, level);
    this.skidFilter!.frequency.setTargetAtTime(600 + 1800 * k, ctx.currentTime, 0.05);
    this.skidGain.gain.setTargetAtTime(0.12 + 0.4 * k, ctx.currentTime, 0.05);
  }

  private tone(freq: number, seconds: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + seconds);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  private noise(seconds: number, gain: number, cutoff: number): void {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start();
  }
}
