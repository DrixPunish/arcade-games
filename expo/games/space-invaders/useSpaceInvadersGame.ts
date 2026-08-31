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

        let next: InvadersState = {
          ...s,
          invaders: s.invaders.map((i) => ({ ...i })),
          bunkers: s.bunkers.map((b) => ({ ...b })),
          enemyBullets: s.enemyBullets.map((b) => ({ ...b })),
          ufo: { ...s.ufo },
        };
        next.invincible = Math.max(0, next.invincible - dt);

        // --- Joueur ---
        const vx = (move.current.right ? 1 : 0) - (move.current.left ? 1 : 0);
        next.playerX = clamp(
          next.playerX + vx * CONFIG.invaders.playerSpeed * dt,
          PLAYER_W / 2,
          W - PLAYER_W / 2,
        );

        // --- Projectiles ---
        if (next.playerBullet) {
          const y = next.playerBullet.y - CONFIG.invaders.bulletSpeed * dt;
          next.playerBullet = y < 0 ? null : { x: next.playerBullet.x, y };
        }
        next.enemyBullets = next.enemyBullets
          .map((b) => ({ x: b.x, y: b.y + CONFIG.invaders.enemyBulletSpeed * dt }))
          .filter((b) => b.y < H);

        // --- Avancée de la formation (plus rapide à mesure qu'elle se vide) ---
        timers.current.step += dt;
        const alive = next.invaders.filter((i) => i.alive);
        const interval = Math.max(
          0.08,
          0.62 - (1 - alive.length / INVADER_TOTAL) * 0.5 - next.wave * 0.025,
        );
        if (timers.current.step > interval) {
          timers.current.step = 0;
          const edge = alive.some(
            (i) =>
              (dir.current === 1 && i.x > W - INVADER_W - 10) || (dir.current === -1 && i.x < 18),
          );
          if (edge) {
            dir.current = dir.current === 1 ? -1 : 1;
            next.invaders.forEach((i) => {
              i.y += 18;
            });
          } else {
            next.invaders.forEach((i) => {
              i.x += dir.current * 10;
            });
          }
        }

        // --- Tir ennemi : la colonne la plus basse d'une colonne au hasard ---
        timers.current.fire += dt;
        if (
          timers.current.fire > Math.max(0.45, 1.25 - next.wave * 0.06) &&
          next.enemyBullets.length < CONFIG.invaders.maxEnemyBullets &&
          alive.length > 0
        ) {
          timers.current.fire = 0;
          const cols = [...new Set(alive.map((i) => i.col))];
          const col = cols[Math.floor(Math.random() * cols.length)];
          const shooter = alive.filter((i) => i.col === col).sort((a, b) => b.y - a.y)[0];
          if (shooter) next.enemyBullets.push({ x: shooter.x + INVADER_W / 2, y: shooter.y + INVADER_H });
        }

        // --- OVNI ---
        timers.current.ufo += dt;
        if (!next.ufo.active && timers.current.ufo > 9) {
          timers.current.ufo = 0;
          const d: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
          next.ufo = { active: true, dir: d, x: d === 1 ? -38 : W + 38, y: 36 };
        }
        if (next.ufo.active) {
          next.ufo.x += next.ufo.dir * 95 * dt;
          if (next.ufo.x < -55 || next.ufo.x > W + 55) next.ufo.active = false;
        }

        // --- Tir du joueur ---
        if (next.playerBullet) {
          const pb = {
            x: next.playerBullet.x - BULLET_W / 2,
            y: next.playerBullet.y,
            w: BULLET_W,
            h: BULLET_H,
          };
          const hit = next.invaders.find(
            (i) => i.alive && rectsHit(pb, { x: i.x, y: i.y, w: INVADER_W, h: INVADER_H }),
          );
          if (hit) {
            hit.alive = false;
            next.score += hit.points;
            next.playerBullet = null;
          }
          const bunker = next.bunkers.find(
            (b) => b.alive && rectsHit(pb, { x: b.x, y: b.y, w: BLOCK, h: BLOCK }),
          );
          if (bunker) {
            bunker.alive = false;
            next.playerBullet = null;
          }
          if (
            next.playerBullet &&
            next.ufo.active &&
            rectsHit(pb, { x: next.ufo.x - UFO_W / 2, y: next.ufo.y - UFO_H / 2, w: UFO_W, h: UFO_H })
          ) {
            next.ufo.active = false;
            next.score += CONFIG.invaders.ufoPoints;
            next.playerBullet = null;
          }
        }

        // --- Tirs ennemis : bunkers puis joueur ---
        let playerHit = false;
        next.enemyBullets = next.enemyBullets.filter((b) => {
          const br = { x: b.x - BULLET_W / 2, y: b.y, w: BULLET_W, h: BULLET_H };
          const bunker = next.bunkers.find(
            (bb) => bb.alive && rectsHit(br, { x: bb.x, y: bb.y, w: BLOCK, h: BLOCK }),
          );
          if (bunker) {
            bunker.alive = false;
            return false;
          }
          if (
            next.invincible <= 0 &&
            rectsHit(br, {
              x: next.playerX - PLAYER_W / 2,
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
        if (playerHit) {
          // Une seule vie par touche : on vide le ciel et on rend le joueur
          // invulnérable le temps de repartir.
          next.lives -= 1;
          next.invincible = CONFIG.invaders.respawnInvincible;
          next.enemyBullets = [];
          next.playerBullet = null;
        }

        // --- Fin de partie / vague suivante ---
        const stillAlive = next.invaders.filter((i) => i.alive);
        if (next.lives <= 0 || stillAlive.some((i) => i.y + INVADER_H >= PLAYER_Y - PLAYER_H)) {
          next.status = 'gameOver';
        } else if (stillAlive.length === 0) {
          const wave = next.wave + 1;
          resetWaveTimers();
          next = {
            ...next,
            wave,
            invaders: makeInvaders(wave),
            bunkers: makeBunkers(),
            playerBullet: null,
            enemyBullets: [],
            invincible: CONFIG.invaders.respawnInvincible,
          };
        }
        return next;
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
