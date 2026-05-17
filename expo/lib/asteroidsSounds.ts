import { Platform } from 'react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AsteroidsSoundKey =
  | 'fire'
  | 'thrust'
  | 'bangLarge'
  | 'bangMedium'
  | 'bangSmall'
  | 'saucerBig'
  | 'saucerSmall'
  | 'extraShip';

const ALL_KEYS: AsteroidsSoundKey[] = [
  'fire',
  'thrust',
  'bangLarge',
  'bangMedium',
  'bangSmall',
  'saucerBig',
  'saucerSmall',
  'extraShip',
];

const POOL_SIZE: Record<AsteroidsSoundKey, number> = {
  fire: 4,
  thrust: 1,
  bangLarge: 3,
  bangMedium: 3,
  bangSmall: 3,
  saucerBig: 1,
  saucerSmall: 1,
  extraShip: 1,
};

const LOOPING: Partial<Record<AsteroidsSoundKey, boolean>> = {
  thrust: true,
  saucerBig: true,
  saucerSmall: true,
};

const TAG = '[asteroidsSounds]';

interface SoundBackend {
  init(): Promise<void>;
  play(key: AsteroidsSoundKey): void;
  setLoop(key: AsteroidsSoundKey, active: boolean): void;
  stopAllLoops(): void;
  isReady(): boolean;
}

/* ============================================================
 * Shared synthesis: produce Float32Array PCM samples for each key.
 * The web backend uses Web Audio API live-graph synthesis;
 * the native backend pre-renders these to WAV files.
 * Both share the same sound design.
 * ========================================================== */
const SAMPLE_RATE = 22050;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function genOscSweep(
  type: 'sine' | 'square' | 'sawtooth',
  freqStart: number,
  freqEnd: number,
  duration: number,
  gain: number,
): Float32Array {
  const n = Math.max(1, Math.floor(SAMPLE_RATE * duration));
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    // exponential frequency interp like Web Audio's exponentialRampToValueAtTime
    const f = freqStart * Math.pow(Math.max(1, freqEnd) / Math.max(1, freqStart), t);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    let s = 0;
    if (type === 'sine') s = Math.sin(phase);
    else if (type === 'square') s = Math.sin(phase) >= 0 ? 1 : -1;
    else {
      // sawtooth
      const p = (phase / (2 * Math.PI)) % 1;
      s = 2 * p - 1;
    }
    // attack/decay envelope: exponential decay from gain to ~0
    const env = i < SAMPLE_RATE * 0.005
      ? (i / (SAMPLE_RATE * 0.005)) * gain
      : gain * Math.pow(0.0001 / Math.max(0.0001, gain), t);
    out[i] = s * env;
  }
  return out;
}

function genNoise(duration: number, gain: number, lowpassHz?: number): Float32Array {
  const n = Math.max(1, Math.floor(SAMPLE_RATE * duration));
  const out = new Float32Array(n);
  // simple one-pole lowpass: y = y_prev + a * (x - y_prev), a = dt / (RC + dt)
  let a = 1;
  if (lowpassHz !== undefined && lowpassHz > 0) {
    const dt = 1 / SAMPLE_RATE;
    const rc = 1 / (2 * Math.PI * lowpassHz);
    a = dt / (rc + dt);
  }
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    const x = Math.random() * 2 - 1;
    y = y + a * (x - y);
    const t = i / n;
    const env = gain * Math.pow(0.0001 / Math.max(0.0001, gain), t);
    out[i] = y * env;
  }
  return out;
}

function genNoiseLoop(durationSec: number, gain: number, lowpassHz: number): Float32Array {
  const n = Math.max(1, Math.floor(SAMPLE_RATE * durationSec));
  const out = new Float32Array(n);
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (2 * Math.PI * lowpassHz);
  const a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    const x = Math.random() * 2 - 1;
    y = y + a * (x - y);
    out[i] = y * gain;
  }
  // crossfade tail to head for seamless loop
  const fade = Math.min(Math.floor(SAMPLE_RATE * 0.02), Math.floor(n / 4));
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    out[i] = out[i] * k + out[n - fade + i] * (1 - k);
  }
  // overwrite tail copy region
  for (let i = 0; i < fade; i += 1) {
    out[n - fade + i] = out[i];
  }
  return out;
}

function genSaucerLoop(baseFreq: number, lfoHz: number, durationSec: number, gain: number): Float32Array {
  // length chosen so it loops seamlessly: integer number of LFO cycles
  const cycles = Math.max(1, Math.round(durationSec * lfoHz));
  const total = cycles / lfoHz;
  const n = Math.max(1, Math.floor(SAMPLE_RATE * total));
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const f = baseFreq + Math.sin(2 * Math.PI * lfoHz * t) * baseFreq * 0.15;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const s = Math.sin(phase) >= 0 ? 1 : -1; // square
    out[i] = s * gain;
  }
  return out;
}

function mix(...buffers: Float32Array[]): Float32Array {
  const len = buffers.reduce((m, b) => Math.max(m, b.length), 0);
  const out = new Float32Array(len);
  for (const b of buffers) {
    for (let i = 0; i < b.length; i += 1) out[i] += b[i];
  }
  // soft clip
  for (let i = 0; i < out.length; i += 1) out[i] = clamp(out[i], -0.98, 0.98);
  return out;
}

function concat(a: Float32Array, b: Float32Array, gapSec: number): Float32Array {
  const gap = Math.max(0, Math.floor(SAMPLE_RATE * gapSec));
  const out = new Float32Array(a.length + gap + b.length);
  out.set(a, 0);
  out.set(b, a.length + gap);
  return out;
}

function synthOneShot(key: AsteroidsSoundKey): Float32Array {
  switch (key) {
    case 'fire':
      return genOscSweep('square', 880, 220, 0.12, 0.25);
    case 'bangLarge':
      return mix(genNoise(0.7, 0.5, 600), genOscSweep('sawtooth', 90, 35, 0.7, 0.35));
    case 'bangMedium':
      return mix(genNoise(0.45, 0.4, 900), genOscSweep('sawtooth', 160, 60, 0.45, 0.3));
    case 'bangSmall':
      return mix(genNoise(0.25, 0.35, 1400), genOscSweep('sawtooth', 260, 110, 0.25, 0.25));
    case 'extraShip':
      return concat(
        genOscSweep('sine', 660, 660, 0.18, 0.3),
        genOscSweep('sine', 880, 880, 0.18, 0.3),
        0.05,
      );
    default:
      return new Float32Array(0);
  }
}

function synthLoop(key: AsteroidsSoundKey): Float32Array {
  switch (key) {
    case 'thrust':
      return genNoiseLoop(0.5, 0.18, 380);
    case 'saucerBig':
      return genSaucerLoop(220, 4, 0.5, 0.18);
    case 'saucerSmall':
      return genSaucerLoop(520, 8, 0.5, 0.18);
    default:
      return new Float32Array(0);
  }
}

function encodeWav(samples: Float32Array): Uint8Array {
  const numFrames = samples.length;
  const dataSize = numFrames * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < numFrames; i += 1) {
    const s = clamp(samples[i], -1, 1);
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

/* ============================================================
 * WEB BACKEND — Web Audio API live synth
 * ========================================================== */
class WebSoundBackend implements SoundBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ready: boolean = false;
  private loops: Map<AsteroidsSoundKey, { stop: () => void }> = new Map();

  async init(): Promise<void> {
    if (this.ready) return;
    console.log(`${TAG} [web] init() starting (Web Audio synth)`);
    try {
      const Ctor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) {
        console.warn(`${TAG} [web] AudioContext unavailable`);
        return;
      }
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.ready = true;
      console.log(`${TAG} [web] AudioContext ready, state=`, this.ctx.state);
    } catch (e) {
      console.warn(`${TAG} [web] AudioContext init failed`, e);
    }
  }

  private ensureRunning(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch((e) => console.warn(`${TAG} [web] resume failed`, e));
    }
  }

  private envOsc(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gain: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private envNoise(duration: number, gain: number, lowpass?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    if (lowpass !== undefined) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      src.connect(lp);
      lp.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  private playKey(key: AsteroidsSoundKey): void {
    switch (key) {
      case 'fire':
        this.envOsc('square', 880, 220, 0.12, 0.25);
        break;
      case 'bangLarge':
        this.envNoise(0.7, 0.5, 600);
        this.envOsc('sawtooth', 90, 35, 0.7, 0.35);
        break;
      case 'bangMedium':
        this.envNoise(0.45, 0.4, 900);
        this.envOsc('sawtooth', 160, 60, 0.45, 0.3);
        break;
      case 'bangSmall':
        this.envNoise(0.25, 0.35, 1400);
        this.envOsc('sawtooth', 260, 110, 0.25, 0.25);
        break;
      case 'extraShip':
        this.envOsc('sine', 660, 660, 0.18, 0.3);
        setTimeout(() => this.envOsc('sine', 880, 880, 0.18, 0.3), 180);
        break;
      default:
        break;
    }
  }

  play(key: AsteroidsSoundKey): void {
    if (!this.ready || !this.ctx) return;
    this.ensureRunning();
    try {
      this.playKey(key);
    } catch (e) {
      console.warn(`${TAG} [web] play(${key}) failed`, e);
    }
  }

  private startLoop(key: AsteroidsSoundKey): { stop: () => void } | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return null;

    if (key === 'thrust') {
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g = ctx.createGain();
      g.gain.value = 0.18;
      src.connect(lp);
      lp.connect(g);
      g.connect(master);
      src.start();
      return {
        stop: () => {
          try { src.stop(); } catch {}
          try { g.disconnect(); } catch {}
        },
      };
    }

    const baseFreq = key === 'saucerBig' ? 220 : 520;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = baseFreq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = key === 'saucerBig' ? 4 : 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = baseFreq * 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.18;
    osc.connect(g);
    g.connect(master);
    osc.start();
    lfo.start();
    return {
      stop: () => {
        try { osc.stop(); } catch {}
        try { lfo.stop(); } catch {}
        try { g.disconnect(); } catch {}
      },
    };
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    if (!this.ready || !this.ctx) return;
    this.ensureRunning();
    const existing = this.loops.get(key);
    if (active) {
      if (existing) return;
      const handle = this.startLoop(key);
      if (handle) this.loops.set(key, handle);
    } else {
      if (!existing) return;
      existing.stop();
      this.loops.delete(key);
    }
  }

  stopAllLoops(): void {
    this.loops.forEach((l) => l.stop());
    this.loops.clear();
  }

  isReady(): boolean {
    return this.ready;
  }
}

/* ============================================================
 * NATIVE BACKEND — pre-render synth → WAV files in cache,
 * play via expo-audio. No bundled audio assets required.
 * ========================================================== */
class NativeSoundBackend implements SoundBackend {
  private pools: Partial<Record<AsteroidsSoundKey, { players: any[]; cursor: number }>> = {};
  private loopActive: Partial<Record<AsteroidsSoundKey, boolean>> = {};
  private ready: boolean = false;

  async init(): Promise<void> {
    if (this.ready) return;
    console.log(`${TAG} [native] init() starting (synth → WAV) on`, Platform.OS);

    const ExpoAudio = require('expo-audio') as typeof import('expo-audio');
    const ExpoFS = require('expo-file-system') as typeof import('expo-file-system');

    try {
      await ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
        interruptionModeAndroid: 'duckOthers',
      });
      console.log(`${TAG} [native] setAudioModeAsync OK`);
    } catch (e) {
      console.warn(`${TAG} [native] setAudioModeAsync FAILED`, e);
    }

    for (const key of ALL_KEYS) {
      try {
        const samples = LOOPING[key] ? synthLoop(key) : synthOneShot(key);
        if (samples.length === 0) {
          console.warn(`${TAG} [native] empty samples for`, key);
          continue;
        }
        const wav = encodeWav(samples);

        const file = new ExpoFS.File(ExpoFS.Paths.cache, `asteroids_${key}.wav`);
        try { file.delete(); } catch {}
        try {
          file.create();
        } catch (e) {
          console.warn(`${TAG} [native] file.create() failed`, key, e);
        }
        try {
          file.write(wav);
        } catch (e) {
          console.warn(`${TAG} [native] file.write() failed`, key, e);
          continue;
        }
        const uri = file.uri;
        console.log(`${TAG} [native] wrote WAV`, key, `${wav.byteLength}B`, uri);

        const players: any[] = [];
        for (let i = 0; i < POOL_SIZE[key]; i += 1) {
          try {
            const p = ExpoAudio.createAudioPlayer({ uri });
            if (LOOPING[key]) p.loop = true;
            p.volume = 1;
            players.push(p);
          } catch (e) {
            console.warn(`${TAG} [native] createAudioPlayer FAILED`, key, e);
          }
        }
        this.pools[key] = { players, cursor: 0 };
      } catch (e) {
        console.warn(`${TAG} [native] synth/write FAILED`, key, e);
      }
    }

    this.ready = true;
    console.log(`${TAG} [native] init() done — keys ready:`, Object.keys(this.pools));
  }

  private playOne(player: any, key: AsteroidsSoundKey, fromLoop: boolean): void {
    try {
      if (!fromLoop) {
        try {
          const sp = player.seekTo(0);
          if (sp && typeof sp.catch === 'function') {
            sp.catch((e: unknown) => console.warn(`${TAG} [native] seekTo failed`, key, e));
          }
        } catch {}
      }
      player.play();
    } catch (e) {
      console.warn(`${TAG} [native] play() threw`, key, e);
    }
  }

  play(key: AsteroidsSoundKey): void {
    if (!this.ready) return;
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    const player = pool.players[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.players.length;
    this.playOne(player, key, false);
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    if (!this.ready) return;
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    if (this.loopActive[key] === active) return;
    this.loopActive[key] = active;
    const player = pool.players[0];
    if (active) {
      this.playOne(player, key, true);
    } else {
      try {
        player.pause();
      } catch (e) {
        console.warn(`${TAG} [native] pause failed`, key, e);
      }
    }
  }

  stopAllLoops(): void {
    (Object.keys(this.loopActive) as AsteroidsSoundKey[]).forEach((key) => {
      if (this.loopActive[key]) this.setLoop(key, false);
    });
  }

  isReady(): boolean {
    return this.ready;
  }
}

/* ============================================================
 * Public manager — picks backend per platform
 * ========================================================== */
class AsteroidsSoundManager {
  private backend: SoundBackend;
  private initStarted: boolean = false;

  constructor() {
    this.backend = Platform.OS === 'web' ? new WebSoundBackend() : new NativeSoundBackend();
  }

  init(): void {
    if (this.initStarted) return;
    this.initStarted = true;
    this.backend.init().catch((e) => console.warn(`${TAG} init() rejected`, e));
  }

  play(key: AsteroidsSoundKey): void {
    this.backend.play(key);
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    this.backend.setLoop(key, active);
  }

  stopAllLoops(): void {
    this.backend.stopAllLoops();
  }

  isReady(): boolean {
    return this.backend.isReady();
  }
}

let singleton: AsteroidsSoundManager | null = null;

export function getAsteroidsSounds(): AsteroidsSoundManager {
  if (!singleton) singleton = new AsteroidsSoundManager();
  return singleton;
}

export type { AsteroidsSoundManager };
