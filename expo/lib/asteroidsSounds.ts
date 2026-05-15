import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

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

type Pool = { players: AudioPlayer[]; cursor: number };

/**
 * Asteroids sound manager.
 * - Pools are built synchronously so play() works as soon as init() returns.
 * - setAudioModeAsync runs in parallel (best-effort).
 * - All play/loop calls are wrapped to swallow autoplay rejections on web.
 */
export class AsteroidsSoundManager {
  private pools: Partial<Record<AsteroidsSoundKey, Pool>> = {};
  private ready: boolean = false;
  private loopActive: Partial<Record<AsteroidsSoundKey, boolean>> = {};

  init(): void {
    if (this.ready) return;

    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch((e) => {
      console.log('[asteroidsSounds] setAudioModeAsync failed', e);
    });

    (Object.keys(SOURCES) as AsteroidsSoundKey[]).forEach((key) => {
      const players: AudioPlayer[] = [];
      const size = POOL_SIZE[key];
      for (let i = 0; i < size; i += 1) {
        try {
          const p = createAudioPlayer(SOURCES[key]);
          if (LOOPING[key]) {
            p.loop = true;
          }
          p.volume = 1;
          players.push(p);
        } catch (e) {
          console.log('[asteroidsSounds] createAudioPlayer failed', key, e);
        }
      }
      this.pools[key] = { players, cursor: 0 };
    });

    this.ready = true;
  }

  play(key: AsteroidsSoundKey): void {
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    const player = pool.players[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.players.length;
    try {
      try {
        player.seekTo(0);
      } catch {}
      const maybe = player.play() as unknown as Promise<void> | void;
      if (maybe && typeof (maybe as Promise<void>).catch === 'function') {
        (maybe as Promise<void>).catch(() => {});
      }
    } catch (e) {
      if (Platform.OS === 'web') return;
      console.log('[asteroidsSounds] play failed', key, e);
    }
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    if (this.loopActive[key] === active) return;
    this.loopActive[key] = active;
    const player = pool.players[0];
    try {
      if (active) {
        try {
          player.seekTo(0);
        } catch {}
        const maybe = player.play() as unknown as Promise<void> | void;
        if (maybe && typeof (maybe as Promise<void>).catch === 'function') {
          (maybe as Promise<void>).catch(() => {});
        }
      } else {
        player.pause();
      }
    } catch (e) {
      if (Platform.OS === 'web') return;
      console.log('[asteroidsSounds] setLoop failed', key, e);
    }
  }

  stopAll(): void {
    (Object.keys(this.pools) as AsteroidsSoundKey[]).forEach((key) => {
      const pool = this.pools[key];
      if (!pool) return;
      pool.players.forEach((p) => {
        try {
          p.pause();
        } catch {}
      });
      this.loopActive[key] = false;
    });
  }

  release(): void {
    (Object.keys(this.pools) as AsteroidsSoundKey[]).forEach((key) => {
      const pool = this.pools[key];
      if (!pool) return;
      pool.players.forEach((p) => {
        try {
          p.release();
        } catch {}
      });
    });
    this.pools = {};
    this.ready = false;
  }
}
