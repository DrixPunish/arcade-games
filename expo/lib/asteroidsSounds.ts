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

const TAG = '[asteroidsSounds]';

/**
 * Singleton Asteroids sound manager.
 * Module-level so it survives React remounts and dev double-mount.
 */
class AsteroidsSoundManager {
  private pools: Partial<Record<AsteroidsSoundKey, Pool>> = {};
  private ready: boolean = false;
  private audioModeSet: boolean = false;
  private loopActive: Partial<Record<AsteroidsSoundKey, boolean>> = {};

  init(): void {
    if (this.ready) {
      console.log(`${TAG} init() skipped — already ready`);
      return;
    }
    console.log(`${TAG} init() starting on`, Platform.OS);

    if (!this.audioModeSet) {
      this.audioModeSet = true;
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
        interruptionModeAndroid: 'duckOthers',
      })
        .then(() => console.log(`${TAG} setAudioModeAsync OK`))
        .catch((e) => console.warn(`${TAG} setAudioModeAsync FAILED`, e));
    }

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
          console.log(`${TAG} created player`, key, `#${i}`, 'isLoaded=', p.isLoaded);
        } catch (e) {
          console.warn(`${TAG} createAudioPlayer FAILED`, key, e);
        }
      }
      this.pools[key] = { players, cursor: 0 };
    });

    this.ready = true;
    console.log(`${TAG} init() done — ready`);
  }

  private playPlayer(player: AudioPlayer, key: AsteroidsSoundKey, fromLoop: boolean): void {
    const start = (): void => {
      try {
        if (!fromLoop) {
          try {
            // seekTo returns a Promise; we don't need to await for non-looping sfx
            const sp = player.seekTo(0) as unknown as Promise<void> | void;
            if (sp && typeof (sp as Promise<void>).catch === 'function') {
              (sp as Promise<void>).catch((e) =>
                console.warn(`${TAG} seekTo failed`, key, e),
              );
            }
          } catch (e) {
            console.warn(`${TAG} seekTo threw`, key, e);
          }
        }
        player.play();
      } catch (e) {
        console.warn(`${TAG} play() threw`, key, e);
      }
    };

    if (player.isLoaded) {
      start();
      return;
    }

    // Wait until the player is loaded before first play
    console.log(`${TAG} ${key} not loaded yet — waiting for playbackStatusUpdate`);
    let fired = false;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (fired) return;
      if (status?.isLoaded) {
        fired = true;
        try {
          sub.remove();
        } catch {}
        start();
      }
    });
    // Fallback timer
    setTimeout(() => {
      if (fired) return;
      fired = true;
      try {
        sub.remove();
      } catch {}
      if (player.isLoaded) start();
      else console.warn(`${TAG} ${key} still not loaded after 1500ms — giving up`);
    }, 1500);
  }

  play(key: AsteroidsSoundKey): void {
    if (!this.ready) {
      console.warn(`${TAG} play(${key}) called before init()`);
      return;
    }
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) {
      console.warn(`${TAG} play(${key}) no pool`);
      return;
    }
    const player = pool.players[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.players.length;
    this.playPlayer(player, key, false);
  }

  setLoop(key: AsteroidsSoundKey, active: boolean): void {
    if (!this.ready) return;
    const pool = this.pools[key];
    if (!pool || pool.players.length === 0) return;
    if (this.loopActive[key] === active) return;
    this.loopActive[key] = active;
    const player = pool.players[0];
    if (active) {
      this.playPlayer(player, key, true);
    } else {
      try {
        player.pause();
      } catch (e) {
        console.warn(`${TAG} pause failed`, key, e);
      }
    }
  }

  stopAllLoops(): void {
    (Object.keys(this.loopActive) as AsteroidsSoundKey[]).forEach((key) => {
      if (this.loopActive[key]) {
        this.setLoop(key, false);
      }
    });
  }

  isReady(): boolean {
    return this.ready;
  }
}

let singleton: AsteroidsSoundManager | null = null;

export function getAsteroidsSounds(): AsteroidsSoundManager {
  if (!singleton) {
    singleton = new AsteroidsSoundManager();
  }
  return singleton;
}

export type { AsteroidsSoundManager };
