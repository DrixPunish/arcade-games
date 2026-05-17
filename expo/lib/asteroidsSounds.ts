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
const DEBUG_WEB = false;

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

  /**
   * Build candidate URLs to try fetching the audio from. Metro/Expo asset
   * resolution on web preview environments (especially when iframed) is
   * inconsistent: `asset.uri` may be a relative dev URL that returns 404 when
   * fetched directly. We try several variants and use the first that returns
   * a valid audio response.
   */
  private buildCandidates(key: AsteroidsSoundKey, asset: Asset): string[] {
    const out: string[] = [];
    const push = (u: string | null | undefined) => {
      if (!u) return;
      if (!out.includes(u)) out.push(u);
    };

    const origin: string =
      typeof window !== 'undefined' && window.location ? window.location.origin : '';

    const toAbs = (u: string): string => {
      if (/^https?:\/\//i.test(u) || u.startsWith('blob:') || u.startsWith('data:')) return u;
      if (u.startsWith('/')) return origin + u;
      return origin + '/' + u.replace(/^\.?\//, '');
    };

    if (asset.localUri) push(toAbs(asset.localUri));
    if (asset.uri) push(toAbs(asset.uri));

    // Production export path: assets are copied to /assets/<original-path>
    push(toAbs(`/assets/assets/sounds/${key}.mp3`));
    push(toAbs(`/assets/sounds/${key}.mp3`));
    push(toAbs(`assets/sounds/${key}.mp3`));

    return out;
  }

  private async resolvePlayableUri(key: AsteroidsSoundKey): Promise<string | null> {
    const asset = Asset.fromModule(SOURCES[key]);
    try {
      await asset.downloadAsync();
    } catch (e) {
      console.warn(`${TAG} [web] downloadAsync failed`, key, e);
    }

    console.log(`${TAG} [web] asset`, key, {
      uri: asset.uri,
      localUri: asset.localUri,
      hash: asset.hash,
      type: asset.type,
    });

    const candidates = this.buildCandidates(key, asset);
    console.log(`${TAG} [web] candidates`, key, candidates);

    for (const url of candidates) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn(`${TAG} [web] candidate ${url} -> HTTP ${resp.status}`);
          continue;
        }
        const rawBlob = await resp.blob();
        if (rawBlob.size < 100) {
          console.warn(`${TAG} [web] candidate ${url} too small (${rawBlob.size}B), skipping`);
          continue;
        }
        const blob =
          rawBlob.type && rawBlob.type.startsWith('audio/')
            ? rawBlob
            : new Blob([await rawBlob.arrayBuffer()], { type: 'audio/mpeg' });
        const objUrl = URL.createObjectURL(blob);
        console.log(
          `${TAG} [web] PICKED`,
          key,
          'src=',
          url,
          'size=',
          blob.size,
          'type=',
          blob.type,
          'objectURL=',
          objUrl,
        );
        return objUrl;
      } catch (e) {
        console.warn(`${TAG} [web] candidate ${url} fetch failed`, e);
      }
    }

    console.warn(`${TAG} [web] no playable candidate found for`, key);
    return null;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    console.log(`${TAG} [web] init() starting`);

    const keys = Object.keys(SOURCES) as AsteroidsSoundKey[];
    await Promise.all(
      keys.map(async (key) => {
        try {
          const playableUri = await this.resolvePlayableUri(key);
          if (!playableUri) {
            console.warn(`${TAG} [web] skipping ${key} — no playable URI`);
            return;
          }

          const players: HTMLAudioElement[] = [];
          for (let i = 0; i < POOL_SIZE[key]; i += 1) {
            const audio = new Audio();
            audio.preload = 'auto';
            if (LOOPING[key]) audio.loop = true;
            audio.volume = 1;
            audio.addEventListener('error', () => {
              const err = audio.error;
              console.warn(
                `${TAG} [web] audio error`,
                key,
                `#${i}`,
                'code=',
                err?.code,
                'message=',
                err?.message,
                'src=',
                audio.src,
              );
            });
            audio.addEventListener('canplaythrough', () => {
              if (DEBUG_WEB) console.log(`${TAG} [web] canplaythrough`, key, `#${i}`);
            });
            audio.src = playableUri;
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
    console.log(`${TAG} [web] init() done — keys ready:`, Object.keys(this.pools));
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
