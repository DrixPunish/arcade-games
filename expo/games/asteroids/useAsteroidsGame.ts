import { useCallback, useRef, useState } from 'react';
import { CONFIG, GameStatus } from '../../lib/gameConfig';
import { dist, uid, Vec, wrap } from '../../lib/math';
import { useGameLoop } from '../../hooks/useGameLoop';

type Size = 'large' | 'medium' | 'small';
type Asteroid = Vec & { id: string; vx: number; vy: number; size: Size; r: number };
type Bullet = Vec & { id: string; vx: number; vy: number; life: number; enemy?: boolean };
type Saucer = Vec & { id: string; vx: number; vy: number; kind: 'large' | 'small'; fire: number };
type Ship = Vec & { vx: number; vy: number; angle: number; invincible: number };
type DeathFx = { active: boolean; t: number; x: number; y: number; final: boolean };

export type AsteroidsState = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  ship: Ship;
  asteroids: Asteroid[];
  bullets: Bullet[];
  saucers: Saucer[];
  death: DeathFx;
};

const W = 360;
const H = 560;
/** Marge au-delà de laquelle une soucoupe a fini sa traversée et disparaît. */
const SAUCER_EXIT = 40;
const SAUCER_RADIUS = 18;

const asteroidCount = (level: number): number =>
  level === 1 ? 4 : level === 2 ? 5 : level === 3 ? 7 : level === 4 ? 9 : 11;

const baseShip = (): Ship => ({
  x: W / 2,
  y: H / 2,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  invincible: CONFIG.asteroids.respawnInvincible,
});

const clearDeath = (): DeathFx => ({ active: false, t: 0, x: W / 2, y: H / 2, final: false });

/**
 * Astéroïde posé sur un bord du terrain, à l'intérieur du champ : le monde
 * s'enroule, donc un spawn hors-champ se téléporterait aussitôt de l'autre côté.
 */
const spawnAsteroid = (level: number): Asteroid => {
  const side = Math.floor(Math.random() * 4);
  const inset = 26;
  const x = side === 0 ? inset : side === 1 ? W - inset : Math.random() * W;
  const y = side === 2 ? inset : side === 3 ? H - inset : Math.random() * H;
  const heading = Math.random() * Math.PI * 2;
  const speed = 34 + Math.random() * (38 + level * 5);
  return {
    id: uid('ast'),
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    size: 'large',
    r: 30,
  };
};

const makeAsteroids = (level: number): Asteroid[] =>
  Array.from({ length: asteroidCount(level) }, () => {
    let asteroid = spawnAsteroid(level);
    for (
      let guard = 0;
      guard < 12 &&
      dist(asteroid, { x: W / 2, y: H / 2 }) < CONFIG.asteroids.asteroidSpawnSafeRadius;
      guard += 1
    ) {
      asteroid = spawnAsteroid(level);
    }
    return asteroid;
  });

const initial = (): AsteroidsState => ({
  status: 'running',
  score: 0,
  lives: CONFIG.initialLives,
  level: 1,
  ship: baseShip(),
  asteroids: makeAsteroids(1),
  bullets: [],
  saucers: [],
  death: clearDeath(),
});

const points = (size: Size): number => (size === 'large' ? 20 : size === 'medium' ? 50 : 100);

/** La soucoupe traverse l'écran de part en part puis sort (elle ne s'enroule pas). */
const spawnSaucer = (kind: 'large' | 'small'): Saucer => {
  const fromLeft = Math.random() > 0.5;
  const speed = kind === 'small' ? 96 : 74;
  return {
    id: uid('saucer'),
    x: fromLeft ? -24 : W + 24,
    y: 60 + Math.random() * (H - 120),
    vx: fromLeft ? speed : -speed,
    vy: (Math.random() - 0.5) * 26,
    kind,
    fire: CONFIG.asteroids.saucerFireEvery,
  };
};

export function useAsteroidsGame(): {
  state: AsteroidsState;
  controls: {
    rotateLeft: (v: boolean) => void;
    rotateRight: (v: boolean) => void;
    thrust: (v: boolean) => void;
    fire: () => void;
    hyperspace: () => void;
    pause: () => void;
    restart: () => void;
  };
} {
  const [state, setState] = useState<AsteroidsState>(initial);
  const input = useRef({ l: false, r: false, t: false });
  const largeDestroyed = useRef(0);
  const extraLivesGiven = useRef(0);

  const beginDeath = (n: AsteroidsState): void => {
    input.current = { l: false, r: false, t: false };
    const final = n.lives <= 1;
    n.lives -= 1;
    n.death = { active: true, t: 0, x: n.ship.x, y: n.ship.y, final };
    n.ship = { ...n.ship, vx: 0, vy: 0, invincible: Number.POSITIVE_INFINITY };
    n.bullets = n.bullets.filter((b) => !b.enemy);
  };

  const update = useCallback(
    (dt: number) =>
      setState((s) => {
        if (s.status !== 'running') return s;

        const n: AsteroidsState = {
          ...s,
          ship: { ...s.ship },
          death: { ...s.death },
          asteroids: s.asteroids.map((a) => ({ ...a })),
          bullets: s.bullets.map((b) => ({ ...b })),
          saucers: s.saucers.map((sc) => ({ ...sc })),
        };

        // --- Animation de mort : le décor continue, le vaisseau non ---
        if (n.death.active) {
          n.death.t += dt;
          n.asteroids.forEach((a) => {
            a.x = wrap(a.x + a.vx * dt, W);
            a.y = wrap(a.y + a.vy * dt, H);
          });
          n.saucers.forEach((sc) => {
            sc.x += sc.vx * dt;
            sc.y = wrap(sc.y + sc.vy * dt, H);
          });
          n.saucers = n.saucers.filter((sc) => sc.x > -SAUCER_EXIT && sc.x < W + SAUCER_EXIT);
          n.bullets = n.bullets
            .map((b) => ({
              ...b,
              x: wrap(b.x + b.vx * dt, W),
              y: wrap(b.y + b.vy * dt, H),
              life: b.life - dt,
            }))
            .filter((b) => b.life > 0 && !b.enemy);

          const duration = n.death.final
            ? CONFIG.asteroids.finalDeathAnimation
            : CONFIG.asteroids.deathAnimation;
          if (n.death.t >= duration) {
            if (n.death.final) n.status = 'gameOver';
            else {
              n.ship = baseShip();
              n.death = clearDeath();
            }
          }
          return n;
        }

        // --- Vaisseau ---
        if (input.current.l) n.ship.angle -= CONFIG.asteroids.rotationSpeed * dt;
        if (input.current.r) n.ship.angle += CONFIG.asteroids.rotationSpeed * dt;
        if (input.current.t) {
          n.ship.vx += Math.cos(n.ship.angle) * CONFIG.asteroids.thrust * dt;
          n.ship.vy += Math.sin(n.ship.angle) * CONFIG.asteroids.thrust * dt;
        }
        n.ship.vx *= CONFIG.asteroids.damping;
        n.ship.vy *= CONFIG.asteroids.damping;
        n.ship.x = wrap(n.ship.x + n.ship.vx * dt, W);
        n.ship.y = wrap(n.ship.y + n.ship.vy * dt, H);
        n.ship.invincible = Math.max(0, n.ship.invincible - dt);

        // --- Déplacements ---
        n.asteroids.forEach((a) => {
          a.x = wrap(a.x + a.vx * dt, W);
          a.y = wrap(a.y + a.vy * dt, H);
        });
        n.bullets = n.bullets
          .map((b) => ({
            ...b,
            x: wrap(b.x + b.vx * dt, W),
            y: wrap(b.y + b.vy * dt, H),
            life: b.life - dt,
          }))
          .filter((b) => b.life > 0);

        n.saucers.forEach((sc) => {
          sc.x += sc.vx * dt;
          sc.y = wrap(sc.y + sc.vy * dt, H);
          sc.fire -= dt;
          if (sc.fire <= 0) {
            sc.fire = CONFIG.asteroids.saucerFireEvery;
            const aim =
              sc.kind === 'small'
                ? Math.atan2(n.ship.y - sc.y, n.ship.x - sc.x) + (Math.random() - 0.5) * 0.35
                : Math.random() * Math.PI * 2;
            n.bullets.push({
              id: uid('ebullet'),
              x: sc.x,
              y: sc.y,
              vx: Math.cos(aim) * 230,
              vy: Math.sin(aim) * 230,
              life: 2.2,
              enemy: true,
            });
          }
        });
        // Une soucoupe qui a fini sa traversée quitte le terrain.
        n.saucers = n.saucers.filter((sc) => sc.x > -SAUCER_EXIT && sc.x < W + SAUCER_EXIT);

        if (
          n.saucers.length === 0 &&
          largeDestroyed.current >= CONFIG.asteroids.largeSaucerLargeAsteroids
        ) {
          largeDestroyed.current = 0;
          n.saucers.push(spawnSaucer(n.score >= CONFIG.asteroids.smallSaucerScore ? 'small' : 'large'));
        }

        // --- Tirs du joueur sur les astéroïdes ---
        const newAsteroids: Asteroid[] = [];
        n.bullets = n.bullets.filter((b) => {
          if (b.enemy) return true;
          const hit = n.asteroids.find((a) => dist(a, b) < a.r);
          if (!hit) return true;
          n.asteroids = n.asteroids.filter((a) => a.id !== hit.id);
          n.score += points(hit.size);
          if (hit.size === 'large') largeDestroyed.current += 1;
          if (hit.size !== 'small') {
            const ns: Size = hit.size === 'large' ? 'medium' : 'small';
            const r = ns === 'medium' ? 20 : 11;
            for (let i = 0; i < 2; i += 1) {
              newAsteroids.push({
                id: uid('ast'),
                x: hit.x,
                y: hit.y,
                vx: (Math.random() - 0.5) * 145,
                vy: (Math.random() - 0.5) * 145,
                size: ns,
                r,
              });
            }
          }
          return false;
        });
        n.asteroids.push(...newAsteroids);

        // --- Tirs du joueur sur les soucoupes ---
        n.bullets = n.bullets.filter((b) => {
          if (b.enemy) return true;
          const hit = n.saucers.find((sc) => dist(sc, b) < SAUCER_RADIUS);
          if (!hit) return true;
          n.score += hit.kind === 'small' ? 1000 : 200;
          n.saucers = n.saucers.filter((sc) => sc.id !== hit.id);
          return false;
        });

        // --- Vies bonus tous les extraLifeEvery points ---
        const earned = Math.floor(n.score / CONFIG.asteroids.extraLifeEvery);
        if (earned > extraLivesGiven.current) {
          n.lives += earned - extraLivesGiven.current;
          extraLivesGiven.current = earned;
        }

        // --- Collisions avec le vaisseau ---
        if (
          n.ship.invincible <= 0 &&
          (n.asteroids.some((a) => dist(a, n.ship) < a.r + CONFIG.asteroids.shipRadius) ||
            n.saucers.some((sc) => dist(sc, n.ship) < SAUCER_RADIUS + CONFIG.asteroids.shipRadius) ||
            n.bullets.some((b) => b.enemy && dist(b, n.ship) < 13))
        ) {
          beginDeath(n);
        }

        // --- Niveau suivant ---
        if (!n.death.active && n.asteroids.length === 0 && n.saucers.length === 0) {
          n.level += 1;
          n.asteroids = makeAsteroids(n.level);
          n.ship.invincible = Math.max(n.ship.invincible, 1.5);
        }
        return n;
      }),
    [],
  );

  useGameLoop(state.status === 'running', update);

  return {
    state,
    controls: {
      rotateLeft: (v) => {
        input.current.l = v;
      },
      rotateRight: (v) => {
        input.current.r = v;
      },
      thrust: (v) => {
        input.current.t = v;
      },
      fire: () =>
        setState((s) => {
          if (s.status !== 'running' || s.death.active) return s;
          if (s.bullets.filter((b) => !b.enemy).length >= CONFIG.asteroids.maxBullets) return s;
          return {
            ...s,
            bullets: [
              ...s.bullets,
              {
                id: uid('bullet'),
                x: s.ship.x + Math.cos(s.ship.angle) * 18,
                y: s.ship.y + Math.sin(s.ship.angle) * 18,
                vx: Math.cos(s.ship.angle) * CONFIG.asteroids.bulletSpeed + s.ship.vx,
                vy: Math.sin(s.ship.angle) * CONFIG.asteroids.bulletSpeed + s.ship.vy,
                life: 1.7,
              },
            ],
          };
        }),
      hyperspace: () =>
        setState((s) =>
          s.status !== 'running' || s.death.active
            ? s
            : {
                ...s,
                ship: { ...s.ship, x: Math.random() * W, y: Math.random() * H, invincible: 0.6 },
              },
        ),
      pause: () =>
        setState((s) => ({
          ...s,
          status:
            s.status === 'paused'
              ? 'running'
              : s.status === 'running' && !s.death.active
                ? 'paused'
                : s.status,
        })),
      restart: () => {
        largeDestroyed.current = 0;
        extraLivesGiven.current = 0;
        input.current = { l: false, r: false, t: false };
        setState(initial());
      },
    },
  };
}

export const ASTEROIDS_DIMENSIONS = { W, H };
