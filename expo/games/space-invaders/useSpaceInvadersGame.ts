import { useCallback, useRef, useState } from 'react';
import { CONFIG, GameStatus } from '../../lib/gameConfig';
import { clamp, rectsHit } from '../../lib/math';
import { useGameLoop } from '../../hooks/useGameLoop';

export type Invader = {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
  points: 10 | 20 | 30;
};
export type BunkerBlock = { id: string; x: number; y: number; alive: boolean };
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
  invaders: Invader[];
  bunkers: BunkerBlock[];
  playerBullet: Bullet | null;
  enemyBullets: Bullet[];
  ufo: UFO;
};

const W = 360;
const H = 560;
const PLAYER_Y = 500;
const CELL = 24;
const BLOCK = 8;

const INVADER_W = 18;
const INVADER_H = 16;
const PLAYER_W = 32;
const PLAYER_H = 16;
const BULLET_W = 4;
const BULLET_H = 12;
const UFO_W = 36;
const UFO_H = 16;

const INVADER_TOTAL = CONFIG.invaders.rows * CONFIG.invaders.cols;

const makeInvaders = (wave: number): Invader[] =>
  Array.from({ length: INVADER_TOTAL }, (_, i) => {
    const row = Math.floor(i / CONFIG.invaders.cols);
    const col = i % CONFIG.invaders.cols;
    const points: 10 | 20 | 30 = row === 0 ? 30 : row < 3 ? 20 : 10;
    return { id: `${wave}-${row}-${col}`, row, col, x: 42 + col * CELL, y: 72 + row * 24, alive: true, points };
  });

const makeBunkers = (): BunkerBlock[] => {
  const out: BunkerBlock[] = [];
  const lastCol = CONFIG.invaders.bunkerCols - 1;
  const lastRow = CONFIG.invaders.bunkerRows - 1;
  const doorCol = Math.floor(CONFIG.invaders.bunkerCols / 2);
  for (let b = 0; b < CONFIG.invaders.bunkerCount; b += 1) {
    for (let r = 0; r < CONFIG.invaders.bunkerRows; r += 1) {
      for (let c = 0; c < CONFIG.invaders.bunkerCols; c += 1) {
        // Coins supérieurs arrondis + porte au centre de la base.
        if ((r === 0 && (c === 0 || c === lastCol)) || (r === lastRow && c === doorCol)) continue;
        out.push({ id: `${b}-${r}-${c}`, x: 42 + b * 82 + c * BLOCK, y: 388 + r * BLOCK, alive: true });
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
  invaders: makeInvaders(1),
  bunkers: makeBunkers(),
  playerBullet: null,
  enemyBullets: [],
  ufo: { x: -40, y: 38, dir: 1, active: false },
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

  const resetWaveTimers = (): void => {
    timers.current = { step: 0, fire: 0, ufo: 0 };
    dir.current = 1;
  };

  const update = useCallback(
    (dt: number) =>
      setState((s) => {
        if (s.status !== 'running') return s;

        // `invaders` et `bunkers` gardent leur référence tant que rien ne les
        // touche : l'écran mémoïse ces deux listes (~135 nœuds SVG) et n'a donc
        // rien à redessiner sur la grande majorité des frames.
        let invaders = s.invaders;
        let bunkers = s.bunkers;
        let score = s.score;
        let lives = s.lives;
        let invincible = Math.max(0, s.invincible - dt);
        let playerBullet = s.playerBullet;
        let enemyBullets = s.enemyBullets;
        let ufo = s.ufo;

        const killInvader = (index: number): void => {
          invaders = invaders.map((inv, i) => (i === index ? { ...inv, alive: false } : inv));
        };
        const breakBunker = (index: number): void => {
          bunkers = bunkers.map((b, i) => (i === index ? { ...b, alive: false } : b));
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

        // --- Avancée de la formation (plus rapide à mesure qu'elle se vide) ---
        timers.current.step += dt;
        const aliveCount = invaders.reduce((n, i) => (i.alive ? n + 1 : n), 0);
        const interval = Math.max(
          0.08,
          0.62 - (1 - aliveCount / INVADER_TOTAL) * 0.5 - s.wave * 0.025,
        );
        if (timers.current.step > interval) {
          timers.current.step = 0;
          const edge = invaders.some(
            (i) =>
              i.alive &&
              ((dir.current === 1 && i.x > W - INVADER_W - 10) || (dir.current === -1 && i.x < 18)),
          );
          if (edge) {
            dir.current = dir.current === 1 ? -1 : 1;
            invaders = invaders.map((i) => ({ ...i, y: i.y + 18 }));
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
            enemyBullets = [...enemyBullets, { x: shooter.x + INVADER_W / 2, y: shooter.y + INVADER_H }];
          }
        }

        // --- OVNI ---
        timers.current.ufo += dt;
        if (!ufo.active && timers.current.ufo > 9) {
          timers.current.ufo = 0;
          const d: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
          ufo = { active: true, dir: d, x: d === 1 ? -38 : W + 38, y: 36 };
        } else if (ufo.active) {
          const x = ufo.x + ufo.dir * 95 * dt;
          ufo = x < -55 || x > W + 55 ? { ...ufo, x, active: false } : { ...ufo, x };
        }

        // --- Tir du joueur ---
        if (playerBullet) {
          const pb = { x: playerBullet.x - BULLET_W / 2, y: playerBullet.y, w: BULLET_W, h: BULLET_H };
          const hitIndex = invaders.findIndex(
            (i) => i.alive && rectsHit(pb, { x: i.x, y: i.y, w: INVADER_W, h: INVADER_H }),
          );
          if (hitIndex >= 0) {
            score += invaders[hitIndex].points;
            killInvader(hitIndex);
            playerBullet = null;
          }
          const bunkerIndex = bunkers.findIndex(
            (b) => b.alive && rectsHit(pb, { x: b.x, y: b.y, w: BLOCK, h: BLOCK }),
          );
          if (bunkerIndex >= 0) {
            breakBunker(bunkerIndex);
            playerBullet = null;
          }
          if (
            playerBullet &&
            ufo.active &&
            rectsHit(pb, { x: ufo.x - UFO_W / 2, y: ufo.y - UFO_H / 2, w: UFO_W, h: UFO_H })
          ) {
            ufo = { ...ufo, active: false };
            score += CONFIG.invaders.ufoPoints;
            playerBullet = null;
          }
        }

        // --- Tirs ennemis : bunkers puis joueur ---
        let playerHit = false;
        if (enemyBullets.length > 0) {
          enemyBullets = enemyBullets.filter((b) => {
            const br = { x: b.x - BULLET_W / 2, y: b.y, w: BULLET_W, h: BULLET_H };
            const bunkerIndex = bunkers.findIndex(
              (bb) => bb.alive && rectsHit(br, { x: bb.x, y: bb.y, w: BLOCK, h: BLOCK }),
            );
            if (bunkerIndex >= 0) {
              breakBunker(bunkerIndex);
              return false;
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
              return false;
            }
            return true;
          });
        }
        if (playerHit) {
          // Une seule vie par touche : on vide le ciel et on rend le joueur
          // invulnérable le temps de repartir.
          lives -= 1;
          invincible = CONFIG.invaders.respawnInvincible;
          enemyBullets = [];
          playerBullet = null;
        }

        // --- Fin de partie / vague suivante ---
        let status: GameStatus = s.status;
        let wave = s.wave;
        const stillAlive = invaders.filter((i) => i.alive);
        if (lives <= 0 || stillAlive.some((i) => i.y + INVADER_H >= PLAYER_Y - PLAYER_H)) {
          status = 'gameOver';
        } else if (stillAlive.length === 0) {
          wave += 1;
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
          invaders,
          bunkers,
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
        setState((s) =>
          s.playerBullet || s.status !== 'running'
            ? s
            : { ...s, playerBullet: { x: s.playerX, y: PLAYER_Y - 18 } },
        ),
      pause: () =>
        setState((s) => ({
          ...s,
          status: s.status === 'paused' ? 'running' : s.status === 'running' ? 'paused' : s.status,
        })),
      restart: () => {
        move.current = { left: false, right: false };
        hold.current = { dir: 0, time: 0 };
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
  BLOCK,
  INVADER_W,
  INVADER_H,
  PLAYER_W,
  PLAYER_H,
  BULLET_W,
  BULLET_H,
  UFO_W,
  UFO_H,
};
