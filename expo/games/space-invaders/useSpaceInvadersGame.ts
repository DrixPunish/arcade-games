import { useCallback, useRef, useState } from 'react';
import { CONFIG, GameStatus } from '../../lib/gameConfig';
import { clamp, rectsHit } from '../../lib/math';
import { useGameLoop } from '../../hooks/useGameLoop';
import { BUNKER, bitmapCols, bitmapRows, InvaderKind } from './sprites';

export type Invader = {
  id: string;
  kind: InvaderKind;
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
  points: 10 | 20 | 30;
};
export type BunkerBlock = { id: string; x: number; y: number; alive: boolean };
export type Explosion = { id: string; x: number; y: number; t: number };
type Bullet = { x: number; y: number };
type UFO = { x: number; y: number; dir: 1 | -1; active: boolean };

export type InvadersState = {
  status: GameStatus;
  score: number;
  lives: number;
  wave: number;
  playerX: number;
  /** Invincibilité restante après avoir perdu une vie (secondes). */
  invincible: number;
  /** 0 ou 1 : bascule à chaque pas de la formation, comme sur la borne. */
  animFrame: 0 | 1;
  invaders: Invader[];
  bunkers: BunkerBlock[];
  explosions: Explosion[];
  playerBullet: Bullet | null;
  enemyBullets: Bullet[];
  ufo: UFO;
};

const W = 360;
const H = 560;
const PLAYER_Y = 500;
const CELL = 24;
const ROW_GAP = 22;

/** Un pixel de sprite vaut 1,5 unité de terrain pour les envahisseurs. */
const INVADER_PIXEL = 1.5;
const INVADER_H = 8 * INVADER_PIXEL;
const INVADER_SIZE: Record<InvaderKind, number> = {
  squid: 8 * INVADER_PIXEL,
  crab: 11 * INVADER_PIXEL,
  octopus: 12 * INVADER_PIXEL,
};
/** Largeur du plus large : sert à centrer les autres dans leur colonne. */
const INVADER_MAX_W = INVADER_SIZE.octopus;

const PLAYER_PIXEL = 2.5;
const PLAYER_W = 13 * PLAYER_PIXEL;
const PLAYER_H = 8 * PLAYER_PIXEL;

const UFO_PIXEL = 2.4;
const UFO_W = 16 * UFO_PIXEL;
const UFO_H = 7 * UFO_PIXEL;

const BULLET_W = 3;
const BULLET_H = 12;

/** Le bunker est une grille de morceaux destructibles taillée dans sa silhouette. */
const BUNKER_PIXEL = 4;
const BUNKER_COLS = bitmapCols(BUNKER);
const BUNKER_ROWS = bitmapRows(BUNKER);
const BUNKER_W = BUNKER_COLS * BUNKER_PIXEL;
const BUNKER_Y = 396;
const BUNKER_GAP = (W - 2 * 42 - CONFIG.invaders.bunkerCount * BUNKER_W) /
  (CONFIG.invaders.bunkerCount - 1);

const EXPLOSION_TIME = 0.28;

const INVADER_TOTAL = CONFIG.invaders.rows * CONFIG.invaders.cols;

const kindForRow = (row: number): InvaderKind =>
  row === 0 ? 'squid' : row < 3 ? 'crab' : 'octopus';
const pointsForKind = (kind: InvaderKind): 10 | 20 | 30 =>
  kind === 'squid' ? 30 : kind === 'crab' ? 20 : 10;

export const invaderWidth = (invader: Invader): number => INVADER_SIZE[invader.kind];

const makeInvaders = (wave: number): Invader[] =>
  Array.from({ length: INVADER_TOTAL }, (_, i) => {
    const row = Math.floor(i / CONFIG.invaders.cols);
    const col = i % CONFIG.invaders.cols;
    const kind = kindForRow(row);
    // Chaque famille est centrée dans sa colonne : la formation reste alignée
    // malgré des largeurs différentes.
    const inset = (INVADER_MAX_W - INVADER_SIZE[kind]) / 2;
    return {
      id: `${wave}-${row}-${col}`,
      kind,
      row,
      col,
      x: 40 + col * CELL + inset,
      y: 72 + row * ROW_GAP,
      alive: true,
      points: pointsForKind(kind),
    };
  });

const makeBunkers = (): BunkerBlock[] => {
  const out: BunkerBlock[] = [];
  for (let b = 0; b < CONFIG.invaders.bunkerCount; b += 1) {
    const originX = 42 + b * (BUNKER_W + BUNKER_GAP);
    for (let r = 0; r < BUNKER_ROWS; r += 1) {
      for (let c = 0; c < BUNKER_COLS; c += 1) {
        if (BUNKER[r][c] !== 'X') continue;
        out.push({
          id: `${b}-${r}-${c}`,
          x: originX + c * BUNKER_PIXEL,
          y: BUNKER_Y + r * BUNKER_PIXEL,
          alive: true,
        });
      }
    }
  }
  return out;
};

const initial = (): InvadersState => ({
  status: 'running',
  score: 0,
  lives: CONFIG.initialLives,
  wave: 1,
  playerX: W / 2,
  invincible: 0,
  animFrame: 0,
  invaders: makeInvaders(1),
  bunkers: makeBunkers(),
  explosions: [],
  playerBullet: null,
  enemyBullets: [],
  ufo: { x: -40, y: 40, dir: 1, active: false },
});

export function useSpaceInvadersGame(): {
  state: InvadersState;
  controls: {
    left: (v: boolean) => void;
    right: (v: boolean) => void;
    fire: () => void;
    pause: () => void;
    restart: () => void;
  };
} {
  const [state, setState] = useState<InvadersState>(initial);
  const move = useRef({ left: false, right: false });
  /** Durée de maintien de la direction en cours, pour la rampe d'accélération. */
  const hold = useRef({ dir: 0, time: 0 });
  const timers = useRef({ step: 0, fire: 0, ufo: 0 });
  const dir = useRef<1 | -1>(1);
  const explosionId = useRef(0);
  /** Nombre de tirs depuis le début de la vague : indexe le score de la soucoupe. */
  const shots = useRef(0);
  const bonusLifeGiven = useRef(false);

  const resetWaveTimers = (): void => {
    timers.current = { step: 0, fire: 0, ufo: 0 };
    dir.current = 1;
  };

  const update = useCallback(
    (dt: number) =>
      setState((s) => {
        if (s.status !== 'running') return s;

        // `invaders` et `bunkers` gardent leur référence tant que rien ne les
        // touche : l'écran mémoïse ces deux listes et n'a donc rien à
        // redessiner sur la grande majorité des frames.
        let invaders = s.invaders;
        let bunkers = s.bunkers;
        let explosions = s.explosions;
        let animFrame = s.animFrame;
        let score = s.score;
        let lives = s.lives;
        let invincible = Math.max(0, s.invincible - dt);
        let playerBullet = s.playerBullet;
        let enemyBullets = s.enemyBullets;
        let ufo = s.ufo;

        const boom = (x: number, y: number): void => {
          explosionId.current += 1;
          explosions = [...explosions, { id: `boom-${explosionId.current}`, x, y, t: 0 }];
        };

        // --- Joueur : vitesse qui monte avec la durée du maintien ---
        const vx = (move.current.right ? 1 : 0) - (move.current.left ? 1 : 0);
        if (vx === 0 || vx !== hold.current.dir) hold.current = { dir: vx, time: 0 };
        else hold.current.time += dt;
        const ramp = Math.min(1, hold.current.time / CONFIG.invaders.playerAccelTime);
        const speed =
          CONFIG.invaders.playerSpeedStart +
          (CONFIG.invaders.playerSpeed - CONFIG.invaders.playerSpeedStart) * ramp;
        const playerX = clamp(s.playerX + vx * speed * dt, PLAYER_W / 2, W - PLAYER_W / 2);

        // --- Projectiles ---
        if (playerBullet) {
          const y = playerBullet.y - CONFIG.invaders.bulletSpeed * dt;
          playerBullet = y < 0 ? null : { x: playerBullet.x, y };
        }
        if (enemyBullets.length > 0) {
          enemyBullets = enemyBullets
            .map((b) => ({ x: b.x, y: b.y + CONFIG.invaders.enemyBulletSpeed * dt }))
            .filter((b) => b.y < H);
        }
        if (explosions.length > 0) {
          explosions = explosions
            .map((e) => ({ ...e, t: e.t + dt }))
            .filter((e) => e.t < EXPLOSION_TIME);
        }

        // --- Avancée de la formation (plus rapide à mesure qu'elle se vide) ---
        timers.current.step += dt;
        const aliveCount = invaders.reduce((n, i) => (i.alive ? n + 1 : n), 0);
        const interval = Math.max(
          0.08,
          0.62 - (1 - aliveCount / INVADER_TOTAL) * 0.5 - s.wave * 0.025,
        );
        if (timers.current.step > interval) {
          timers.current.step = 0;
          // L'animation bascule à chaque pas : c'est le pas qui fait « marcher »
          // les envahisseurs, comme sur la borne.
          animFrame = animFrame === 0 ? 1 : 0;
          const edge = invaders.some(
            (i) =>
              i.alive &&
              ((dir.current === 1 && i.x + INVADER_SIZE[i.kind] > W - 12) ||
                (dir.current === -1 && i.x < 12)),
          );
          if (edge) {
            dir.current = dir.current === 1 ? -1 : 1;
            invaders = invaders.map((i) => ({ ...i, y: i.y + 14 }));
          } else {
            const step = dir.current * 10;
            invaders = invaders.map((i) => ({ ...i, x: i.x + step }));
          }
        }

        // --- Tir ennemi : le plus bas d'une colonne au hasard ---
        timers.current.fire += dt;
        if (
          timers.current.fire > Math.max(0.45, 1.25 - s.wave * 0.06) &&
          enemyBullets.length < CONFIG.invaders.maxEnemyBullets &&
          aliveCount > 0
        ) {
          timers.current.fire = 0;
          const alive = invaders.filter((i) => i.alive);
          const cols = [...new Set(alive.map((i) => i.col))];
          const col = cols[Math.floor(Math.random() * cols.length)];
          const shooter = alive.filter((i) => i.col === col).sort((a, b) => b.y - a.y)[0];
          if (shooter) {
            enemyBullets = [
              ...enemyBullets,
              { x: shooter.x + INVADER_SIZE[shooter.kind] / 2, y: shooter.y + INVADER_H },
            ];
          }
        }

        // --- Soucoupe mystère ---
        timers.current.ufo += dt;
        if (!ufo.active && timers.current.ufo > 9) {
          timers.current.ufo = 0;
          const d: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
          ufo = { active: true, dir: d, x: d === 1 ? -UFO_W : W + UFO_W, y: 40 };
        } else if (ufo.active) {
          const x = ufo.x + ufo.dir * 95 * dt;
          const gone = x < -UFO_W * 2 || x > W + UFO_W * 2;
          ufo = gone ? { ...ufo, x, active: false } : { ...ufo, x };
        }

        // --- Tir du joueur ---
        if (playerBullet) {
          const pb = { x: playerBullet.x - BULLET_W / 2, y: playerBullet.y, w: BULLET_W, h: BULLET_H };
          const hitIndex = invaders.findIndex(
            (i) =>
              i.alive &&
              rectsHit(pb, { x: i.x, y: i.y, w: INVADER_SIZE[i.kind], h: INVADER_H }),
          );
          if (hitIndex >= 0) {
            const hit = invaders[hitIndex];
            score += hit.points;
            boom(hit.x + INVADER_SIZE[hit.kind] / 2, hit.y + INVADER_H / 2);
            invaders = invaders.map((inv, i) => (i === hitIndex ? { ...inv, alive: false } : inv));
            playerBullet = null;
          }
          const bunkerIndex = bunkers.findIndex(
            (b) => b.alive && rectsHit(pb, { x: b.x, y: b.y, w: BUNKER_PIXEL, h: BUNKER_PIXEL }),
          );
          if (bunkerIndex >= 0) {
            bunkers = bunkers.map((b, i) => (i === bunkerIndex ? { ...b, alive: false } : b));
            playerBullet = null;
          }
          if (
            playerBullet &&
            ufo.active &&
            rectsHit(pb, { x: ufo.x - UFO_W / 2, y: ufo.y - UFO_H / 2, w: UFO_W, h: UFO_H })
          ) {
            ufo = { ...ufo, active: false };
            const table = CONFIG.invaders.ufoPoints;
            score += table[shots.current % table.length];
            boom(ufo.x, ufo.y);
            playerBullet = null;
          }
        }

        // --- Tirs ennemis : bunkers puis joueur ---
        let playerHit = false;
        if (enemyBullets.length > 0) {
          const survivors: Bullet[] = [];
          for (const b of enemyBullets) {
            const br = { x: b.x - BULLET_W / 2, y: b.y, w: BULLET_W, h: BULLET_H };
            const bunkerIndex = bunkers.findIndex(
              (bb) => bb.alive && rectsHit(br, { x: bb.x, y: bb.y, w: BUNKER_PIXEL, h: BUNKER_PIXEL }),
            );
            if (bunkerIndex >= 0) {
              bunkers = bunkers.map((bb, i) => (i === bunkerIndex ? { ...bb, alive: false } : bb));
              continue;
            }
            if (
              invincible <= 0 &&
              rectsHit(br, {
                x: playerX - PLAYER_W / 2,
                y: PLAYER_Y - PLAYER_H / 2,
                w: PLAYER_W,
                h: PLAYER_H,
              })
            ) {
              playerHit = true;
              continue;
            }
            survivors.push(b);
          }
          enemyBullets = survivors;
        }
        if (playerHit) {
          // Une seule vie par touche : on vide le ciel et on rend le joueur
          // invulnérable le temps de repartir.
          lives -= 1;
          invincible = CONFIG.invaders.respawnInvincible;
          boom(playerX, PLAYER_Y);
          enemyBullets = [];
          playerBullet = null;
        }

        // --- Vie bonus, une seule fois dans la partie ---
        if (!bonusLifeGiven.current && score >= CONFIG.invaders.bonusLifeAt) {
          bonusLifeGiven.current = true;
          lives += 1;
        }

        // --- Fin de partie / vague suivante ---
        let status: GameStatus = s.status;
        let wave = s.wave;
        const stillAlive = invaders.filter((i) => i.alive);
        if (lives <= 0 || stillAlive.some((i) => i.y + INVADER_H >= PLAYER_Y - PLAYER_H)) {
          status = 'gameOver';
        } else if (stillAlive.length === 0) {
          wave += 1;
          shots.current = 0;
          resetWaveTimers();
          invaders = makeInvaders(wave);
          bunkers = makeBunkers();
          playerBullet = null;
          enemyBullets = [];
          invincible = CONFIG.invaders.respawnInvincible;
        }

        return {
          status,
          score,
          lives,
          wave,
          playerX,
          invincible,
          animFrame,
          invaders,
          bunkers,
          explosions,
          playerBullet,
          enemyBullets,
          ufo,
        };
      }),
    [],
  );

  useGameLoop(state.status === 'running', update);

  return {
    state,
    controls: {
      left: (v) => {
        move.current.left = v;
      },
      right: (v) => {
        move.current.right = v;
      },
      fire: () =>
        setState((s) => {
          if (s.playerBullet || s.status !== 'running') return s;
          shots.current += 1;
          return { ...s, playerBullet: { x: s.playerX, y: PLAYER_Y - PLAYER_H } };
        }),
      pause: () =>
        setState((s) => ({
          ...s,
          status: s.status === 'paused' ? 'running' : s.status === 'running' ? 'paused' : s.status,
        })),
      restart: () => {
        move.current = { left: false, right: false };
        hold.current = { dir: 0, time: 0 };
        shots.current = 0;
        bonusLifeGiven.current = false;
        resetWaveTimers();
        setState(initial());
      },
    },
  };
}

export const INVADERS_DIMENSIONS = {
  W,
  H,
  PLAYER_Y,
  PLAYER_W,
  PLAYER_H,
  PLAYER_PIXEL,
  INVADER_PIXEL,
  INVADER_H,
  INVADER_SIZE,
  UFO_W,
  UFO_H,
  UFO_PIXEL,
  BULLET_W,
  BULLET_H,
  BUNKER_PIXEL,
};
