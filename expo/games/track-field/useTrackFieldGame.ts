import { useCallback, useRef, useState } from 'react';
import { CONFIG, GameStatus } from '../../lib/gameConfig';
import { clamp } from '../../lib/math';
import { useGameLoop } from '../../hooks/useGameLoop';

/**
 * Track & Field (Konami, 1983).
 *
 * Deux mécaniques seulement, partagées par toutes les épreuves :
 *  - COURIR en martelant alternativement les deux boutons. Une alternance
 *    correcte donne une impulsion ; sans martèlement la vitesse retombe.
 *  - un bouton d'ACTION, qui sert soit à sauter au bon moment (haies), soit à
 *    régler un angle en le maintenant (longueur, javelot).
 *
 * Les distances ne sont pas tabulées : c'est un vrai tir parabolique avec
 * hauteur de lâcher, ce qui place naturellement l'angle optimal sous 45° —
 * 42° à la longueur et 43° au javelot, comme sur la borne.
 */

export type EventId = 'dash100' | 'longJump' | 'javelin' | 'hurdles';

export const EVENT_ORDER: EventId[] = ['dash100', 'longJump', 'javelin', 'hurdles'];

export const EVENT_LABEL: Record<EventId, string> = {
  dash100: '100 mètres',
  longJump: 'Saut en longueur',
  javelin: 'Lancer du javelot',
  hurdles: '110 mètres haies',
};

/** Unité affichée avec le résultat. */
export const EVENT_UNIT: Record<EventId, 's' | 'm'> = {
  dash100: 's',
  longJump: 'm',
  javelin: 'm',
  hurdles: 's',
};

/** Les courses se jouent en une manche, les concours en trois essais. */
export const isFieldEvent = (event: EventId): boolean =>
  event === 'longJump' || event === 'javelin';

export type Phase =
  | 'ready'
  | 'running'
  | 'flying'
  | 'result'
  | 'eventOver'
  | 'gameOver';

export type Hurdle = { x: number; cleared: boolean };

export type TrackFieldState = {
  status: GameStatus;
  phase: Phase;
  eventIndex: number;
  attempt: number;
  lives: number;
  score: number;
  /** Vitesse courante, en mètres par seconde. */
  speed: number;
  /** Distance parcourue au sol, en mètres. */
  runDistance: number;
  /** Chronomètre de l'épreuve, en secondes. */
  time: number;
  /** Angle en cours de réglage, tant que le bouton d'action est tenu. */
  angle: number;
  settingAngle: boolean;
  /** Progression du projectile ou du sauteur, en mètres. */
  flightDistance: number;
  flightHeight: number;
  /** Résultat du dernier essai, et meilleur de l'épreuve. */
  result: number;
  best: number;
  /** Saut en cours (haies). */
  airborne: boolean;
  hurdles: Hurdle[];
  /** Ligne d'appel franchie : l'essai est mordu. */
  foul: boolean;
  message: string;
};

const DASH_LENGTH = 100;
const HURDLES_LENGTH = 110;
/** Zone d'élan avant la planche d'appel, au saut et au javelot. */
const RUNWAY_LENGTH = 45;
/** Dix haies, la première à 13,72 m puis tous les 9,14 m — comme en athlétisme. */
const makeHurdles = (): Hurdle[] =>
  Array.from({ length: 10 }, (_, i) => ({ x: 13.72 + i * 9.14, cleared: false }));

const currentEvent = (index: number): EventId => EVENT_ORDER[index] ?? 'dash100';

const baseAttempt = (state: TrackFieldState): TrackFieldState => ({
  ...state,
  phase: 'ready',
  speed: 0,
  runDistance: 0,
  time: 0,
  angle: 0,
  settingAngle: false,
  flightDistance: 0,
  flightHeight: 0,
  result: 0,
  airborne: false,
  foul: false,
  hurdles: makeHurdles(),
  message: '',
});

const initial = (): TrackFieldState =>
  baseAttempt({
    status: 'running',
    phase: 'ready',
    eventIndex: 0,
    attempt: 1,
    lives: CONFIG.initialLives,
    score: 0,
    speed: 0,
    runDistance: 0,
    time: 0,
    angle: 0,
    settingAngle: false,
    flightDistance: 0,
    flightHeight: 0,
    result: 0,
    best: 0,
    airborne: false,
    hurdles: makeHurdles(),
    foul: false,
    message: '',
  });

/**
 * Hauteur de lâcher qui place l'angle optimal exactement sur `optimalDeg`.
 *
 * Pour un tir parabolique lâché à la hauteur h, l'optimum vérifie
 * sin²θ = v² / (2(v² + g·h)). On inverse la relation : c'est l'angle
 * documenté par la borne qui commande la hauteur, et non l'inverse.
 */
export function releaseHeightFor(speed: number, optimalDeg: number): number {
  const s2 = Math.sin((optimalDeg * Math.PI) / 180) ** 2;
  return (speed * speed * (1 - 2 * s2)) / (2 * CONFIG.trackField.gravity * s2);
}

/** Paramètres de vol d'une épreuve de concours, à la vitesse de course donnée. */
export function flightSetup(event: 'longJump' | 'javelin', runSpeed: number): {
  launchSpeed: number;
  height: number;
} {
  const { optimalAngle, launchFactor } = CONFIG.trackField.events[event];
  const launchSpeed = runSpeed * launchFactor;
  // La hauteur suit la vitesse RÉELLE du lâcher. C'est ce qui rend l'angle
  // optimal constant : 42° reste 42° qu'on arrive lancé ou essoufflé, comme
  // sur la borne où l'angle est une règle et non une variable.
  return { launchSpeed, height: releaseHeightFor(launchSpeed, optimalAngle) };
}

/** Portée d'un tir parabolique lâché à `h` mètres du sol. */
export function projectileRange(speed: number, angleDeg: number, h: number): number {
  const g = CONFIG.trackField.gravity;
  const a = (angleDeg * Math.PI) / 180;
  const vy = speed * Math.sin(a);
  const vx = speed * Math.cos(a);
  return (vx * (vy + Math.sqrt(vy * vy + 2 * g * h))) / g;
}

/** Hauteur du projectile après `d` mètres parcourus, pour l'affichage. */
function heightAt(speed: number, angleDeg: number, h: number, d: number): number {
  const a = (angleDeg * Math.PI) / 180;
  const vx = speed * Math.cos(a);
  if (vx <= 0.01) return h;
  const t = d / vx;
  const g = CONFIG.trackField.gravity;
  return Math.max(0, h + speed * Math.sin(a) * t - 0.5 * g * t * t);
}

export function useTrackFieldGame(): {
  state: TrackFieldState;
  controls: {
    runA: () => void;
    runB: () => void;
    action: (held: boolean) => void;
    next: () => void;
    pause: () => void;
    restart: () => void;
  };
} {
  const [state, setState] = useState<TrackFieldState>(initial);
  /** Dernier bouton de course frappé : seule l'alternance compte. */
  const lastRun = useRef<'a' | 'b' | null>(null);
  /** Accumulateur de cadence : monte d'un cran par alternance, retombe seul. */
  const cadence = useRef(0);
  const actionHeld = useRef(false);
  const actionPressed = useRef(false);
  /** Position et durée de l'appel, pour un franchissement mesuré en distance. */
  const jump = useRef({ from: 0, time: 0 });

  const tapRun = (which: 'a' | 'b'): void => {
    if (lastRun.current !== which) {
      lastRun.current = which;
      cadence.current += 1;
    }
  };

  const update = useCallback(
    (dt: number) =>
      setState((s) => {
        if (s.status !== 'running') return s;
        if (s.phase === 'result' || s.phase === 'eventOver' || s.phase === 'gameOver') return s;

        const cfg = CONFIG.trackField;
        const event = currentEvent(s.eventIndex);
        const n: TrackFieldState = { ...s };

        // --- Course : la cadence mesurée fixe la vitesse visée ---
        if (n.phase === 'ready' && cadence.current > 0) n.phase = 'running';
        // L'accumulateur redescend tout seul : arrêter de marteler fait
        // retomber la cadence mesurée, donc la vitesse.
        cadence.current = Math.max(0, cadence.current - (cadence.current * dt) / cfg.tapWindow);

        // Dès qu'on tient le bouton pour régler l'angle, la vitesse est FIGÉE
        // à celle du moment. C'est l'élan acquis qu'on emporte dans le saut :
        // le joueur peut lâcher le martèlement et ne viser que l'angle.
        // `n.settingAngle` est encore vrai sur l'image du RELÂCHEMENT : sans
        // cela la vitesse se remettait à jour juste avant que le saut soit
        // calculé, et le résultat dépendait encore du martèlement.
        const lockingSpeed =
          isFieldEvent(event) &&
          (actionHeld.current || n.settingAngle) &&
          n.phase === 'running';

        if (n.phase === 'running') {
          if (!lockingSpeed) {
            const tapsPerSecond = cadence.current / cfg.tapWindow;
            const wanted = Math.min(cfg.topSpeed, tapsPerSecond * cfg.speedPerTap);
            n.speed = clamp(
              n.speed + (wanted - n.speed) * Math.min(1, cfg.responsiveness * dt),
              0,
              cfg.topSpeed,
            );
          }
          n.runDistance += n.speed * dt;
          n.time += dt;
        }

        // --- Réglage de l'angle : il monte tant que le bouton est tenu ---
        if (n.phase === 'running' && actionHeld.current && isFieldEvent(event)) {
          n.settingAngle = true;
          n.angle = Math.min(cfg.angleMax, n.angle + cfg.angleSweep * dt);
        }

        switch (event) {
          case 'dash100': {
            if (n.runDistance >= DASH_LENGTH) {
              n.result = n.time;
              n.phase = 'result';
            }
            break;
          }

          case 'hurdles': {
            // Le franchissement se mesure en DISTANCE parcourue, pas en temps :
            // il vaut donc autant à faible allure qu'à pleine vitesse.
            if (actionPressed.current && !n.airborne && n.phase === 'running') {
              n.airborne = true;
              jump.current = { from: n.runDistance, time: 0 };
            }
            if (n.airborne) {
              jump.current.time += dt;
              const progress = (n.runDistance - jump.current.from) / cfg.hurdleJumpSpan;
              n.flightHeight = Math.min(1, progress);
              if (progress >= 1 || jump.current.time > cfg.hurdleJumpMaxTime) {
                n.airborne = false;
                n.flightHeight = 0;
              }
            }
            n.hurdles = n.hurdles.map((h) => {
              if (h.cleared || n.runDistance < h.x) return h;
              if (!n.airborne) {
                // On trébuche, on ne s'arrête pas net.
                n.speed *= cfg.hurdleHitPenalty;
                n.message = 'Haie renversée !';
              }
              return { ...h, cleared: true };
            });
            if (n.runDistance >= HURDLES_LENGTH) {
              n.result = n.time;
              n.phase = 'result';
            }
            break;
          }

          case 'longJump':
          case 'javelin': {
            // Relâcher le bouton déclenche le saut ou le lancer.
            if (n.settingAngle && !actionHeld.current) {
              n.foul = n.runDistance > RUNWAY_LENGTH;
              n.phase = 'flying';
              n.settingAngle = false;
            }
            if (n.phase === 'running' && n.runDistance > RUNWAY_LENGTH + 3) {
              // Passé la planche sans sauter : essai mordu.
              n.foul = true;
              n.phase = 'result';
              n.result = 0;
              n.message = 'Mordu !';
            }
            if (n.phase === 'flying') {
              const setup = flightSetup(event, n.speed);
              const range = n.foul ? 0 : projectileRange(setup.launchSpeed, n.angle, setup.height);
              n.flightDistance = Math.min(range, n.flightDistance + setup.launchSpeed * dt * 1.2);
              n.flightHeight = heightAt(setup.launchSpeed, n.angle, setup.height, n.flightDistance);
              if (n.flightDistance >= range - 0.01) {
                n.result = n.foul ? 0 : range;
                n.phase = 'result';
                if (n.foul) n.message = 'Mordu !';
              }
            }
            break;
          }
        }

        actionPressed.current = false;
        return n;
      }),
    [],
  );

  // On arrête complètement la boucle pendant les écrans de résultat : inutile
  // de faire tourner un requestAnimationFrame derrière un panneau figé.
  const looping =
    state.status === 'running' && state.phase !== 'result' && state.phase !== 'eventOver';
  useGameLoop(looping, update);

  /** Passe à l'essai suivant, à l'épreuve suivante, ou termine la partie. */
  const next = useCallback(() => {
    setState((s) => {
      if (s.phase !== 'result' && s.phase !== 'eventOver') return s;
      const event = currentEvent(s.eventIndex);
      const unit = EVENT_UNIT[event];
      const target = CONFIG.trackField.qualify[event];
      const better = unit === 's' ? s.result > 0 && s.result < s.best : s.result > s.best;
      const best = s.best === 0 || better ? s.result : s.best;
      const passed = unit === 's' ? best > 0 && best <= target : best >= target;

      if (s.phase === 'result') {
        const lastTry = !isFieldEvent(event) || s.attempt >= CONFIG.trackField.fieldAttempts;
        if (passed || lastTry) {
          return {
            ...s,
            best,
            phase: 'eventOver',
            message: passed ? 'Qualifié !' : 'Éliminé',
            score: passed ? s.score + Math.round(best * 100) : s.score,
            lives: passed ? s.lives : s.lives - 1,
          };
        }
        return baseAttempt({ ...s, best, attempt: s.attempt + 1 });
      }

      // eventOver : on enchaîne
      if (s.lives <= 0) return { ...s, phase: 'gameOver', status: 'gameOver' };
      const nextIndex = s.eventIndex + 1;
      if (nextIndex >= EVENT_ORDER.length) return { ...s, phase: 'gameOver', status: 'gameOver' };
      lastRun.current = null;
      return baseAttempt({ ...s, eventIndex: nextIndex, attempt: 1, best: 0 });
    });
  }, []);

  return {
    state,
    controls: {
      runA: () => tapRun('a'),
      runB: () => tapRun('b'),
      action: (held: boolean) => {
        actionHeld.current = held;
        if (held) actionPressed.current = true;
      },
      next,
      pause: () =>
        setState((s) => ({
          ...s,
          status: s.status === 'paused' ? 'running' : s.status === 'running' ? 'paused' : s.status,
        })),
      restart: () => {
        lastRun.current = null;
        cadence.current = 0;
        jump.current = { from: 0, time: 0 };
        actionHeld.current = false;
        actionPressed.current = false;
        setState(initial());
      },
    },
  };
}

export const TRACK_DIMENSIONS = { DASH_LENGTH, HURDLES_LENGTH, RUNWAY_LENGTH };
