import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

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

const SOURCES: Record<AsteroidsSoundKey, number> = {
  fire: require('../assets/sounds/fire.mp3'),
  thrust: require('../assets/sounds/thrust.mp3'),
  bangLarge: require('../assets/sounds/bangLarge.mp3'),
  bangMedium: require('../assets/sounds/bangMedium.mp3'),
  bangSmall: require('../assets/sounds/bangSmall.mp3'),
  saucerBig: require('../assets/sounds/saucerBig.mp3'),
  saucerSmall: require('../assets/sounds/saucerSmall.mp3'),
  extraShip: require('../assets/sounds/extraShip.mp3'),
};

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
 * WEB BACKEND — Web Audio API synthesizer
 *
 * Reason: Metro/Expo bundled audio assets are not reliably resolvable on
 * the Rork web preview (static host with no Metro server) nor in some
 * Expo Go web contexts. Rather than depending on fragile asset URLs we
 * synthesize retro Asteroids-style SFX directly with the Web Audio API.
 * Zero file dependency, works in every web environment.
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
      // White noise lowpassed = engine rumble
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
          try {
            src.stop();
          } catch {}
          try {
            g.disconnect();
          } catch {}
        },
      };
    }

    // Saucer loops: pulsating tone
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
        try {
          osc.stop();
        } catch {}
        try {
          lfo.stop();
        } catch {}
        try {
          g.disconnect();
        } catch {}
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
 * NATIVE BACKEND — expo-audio
 * ========================================================== */
class NativeSoundBackend implements SoundBackend {
  // Use 'any' so the web bundle never tries to resolve expo-audio types/runtime.
  private pools: Partial<Record<AsteroidsSoundKey, { players: any[]; cursor: number }>> = {};
  private loopActive: Partial<Record<AsteroidsSoundKey, boolean>> = {};
  private ready: boolean = false;

  async init(): Promise<void> {
    if (this.ready) return;
    console.log(`${TAG} [native] init() starting on`, Platform.OS);

    // Lazy require so web bundle does not pull expo-audio
    const ExpoAudio = require('expo-audio') as typeof import('expo-audio');

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

    const keys = Object.keys(SOURCES) as AsteroidsSoundKey[];
    await Promise.all(
      keys.map(async (key) => {
        try {
          const asset = Asset.fromModule(SOURCES[key]);
          await asset.downloadAsync();
          const uri = asset.localUri ?? asset.uri;
          if (!uri) {
            console.warn(`${TAG} [native] no URI for`, key);
            return;
          }
          console.log(`${TAG} [native] asset ready`, key, uri);

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
          console.warn(`${TAG} [native] asset load FAILED`, key, e);
        }
      }),
    );

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
