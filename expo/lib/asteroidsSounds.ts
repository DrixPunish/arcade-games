import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

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
  fire: require('../assets/sounds/fire.wav'),
  thrust: require('../assets/sounds/thrust.wav'),
  bangLarge: require('../assets/sounds/bangLarge.wav'),
  bangMedium: require('../assets/sounds/bangMedium.wav'),
  bangSmall: require('../assets/sounds/bangSmall.wav'),
  saucerBig: require('../assets/sounds/saucerBig.wav'),
  saucerSmall: require('../assets/sounds/saucerSmall.wav'),
  extraShip: require('../assets/sounds/extraShip.wav'),
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
 * WEB BACKEND — HTML5 Audio
 * expo-audio's require() loading is unreliable on web preview.
 * We use the browser-native HTMLAudioElement which works with
 * the URL resolved by Metro/expo-asset.
 * ========================================================== */
class WebSoundBackend implements SoundBackend {
  private pools: Partial<Record<AsteroidsSoundKey, { players: HTMLAudioElement[]; cursor: number }>> = {};
  private loopActive: Partial<Record<AsteroidsSoundKey, boolean>> = {};
  private ready: boolean = false;

  async init(): Promise<void> {
    if (this.ready) return;
    console.log(`${TAG} [web] init() starting`);

    const keys = Object.keys(SOURCES) as AsteroidsSoundKey[];
    await Promise.all(
      keys.map(async (key) => {
        try {
          const asset = Asset.fromModule(SOURCES[key]);
          await asset.downloadAsync();
          const uri = asset.localUri || asset.uri;
          console.log(`${TAG} [web] resolved`, key, '=>', uri);

          const players: HTMLAudioElement[] = [];
          for (let i = 0; i < POOL_SIZE[key]; i += 1) {
            const audio = new Audio(uri);
            audio.preload = 'auto';
            if (LOOPING[key]) audio.loop = true;
            audio.volume = 1;
            audio.addEventListener('error', (e) => {
              console.warn(`${TAG} [web] audio error`, key, `#${i}`, e);
            });
            // Force load
            try {
              audio.load();
            } catch {}
            players.push(audio);
          }
          this.pools[key] = { players, cursor: 0 };
        } catch (e) {
          console.warn(`${TAG} [web] failed to load`, key, e);
        }
      }),
    );

    this.ready = true;
    console.log(`${TAG} [web] init() done`);
  }

  private playOne(audio: HTMLAudioElement, key: AsteroidsSoundKey): void {
    try {
      audio.currentTime = 0;
    } catch {}
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => console.warn(`${TAG} [web] play() rejected`, key, e?.message ?? e));
    }
  }

  play(key: AsteroidsSoundKey): void {
    if (!this.ready) {
      console.warn(`${TAG} [web] play(${key}) before init`);
      return;
    }
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) {
      console.warn(`${TAG} [web] play(${key}) no pool`);
      return;
    }
    const audio = pool.players[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.players.length;
    this.playOne(audio, key);
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    if (!this.ready) return;
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    if (this.loopActive[key] === active) return;
    this.loopActive[key] = active;
    const audio = pool.players[0];
    if (active) {
      this.playOne(audio, key);
    } else {
      try {
        audio.pause();
      } catch (e) {
        console.warn(`${TAG} [web] pause failed`, key, e);
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

    (Object.keys(SOURCES) as AsteroidsSoundKey[]).forEach((key) => {
      const players: any[] = [];
      for (let i = 0; i < POOL_SIZE[key]; i += 1) {
        try {
          const p = ExpoAudio.createAudioPlayer(SOURCES[key]);
          if (LOOPING[key]) p.loop = true;
          p.volume = 1;
          players.push(p);
        } catch (e) {
          console.warn(`${TAG} [native] createAudioPlayer FAILED`, key, e);
        }
      }
      this.pools[key] = { players, cursor: 0 };
    });

    this.ready = true;
    console.log(`${TAG} [native] init() done`);
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
