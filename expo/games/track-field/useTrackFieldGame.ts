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
  /**
   * Haie sur laquelle le saut est armé, s'il y en a une. L'écran l'allume :
   * sans ce retour, appuyer dans la zone ne produisait rien de visible avant
   * le décollage, et on ne savait pas si l'appui avait été pris en compte.
   */
  armedHurdle: number | null;
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
  armedHurdle: null,
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
    armedHurdle: null,
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

/**
 * Inclinaison du projectile après `d` mètres, en degrés. Un javelot pique du
 * nez en fin de course : le dessiner à angle fixe donnait un trait qui
 * flottait à plat sans jamais retomber.
 */
export function flightAngleAt(speed: number, angleDeg: number, d: number): number {
  const a = (angleDeg * Math.PI) / 180;
  const vx = speed * Math.cos(a);
  if (vx <= 0.01) return angleDeg;
  const t = d / vx;
  const vy = speed * Math.sin(a) - CONFIG.trackField.gravity * t;
  return (Math.atan2(vy, vx) * 180) / Math.PI;
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

/**
 * Points d'une performance.
 *
 * Le calcul précédent était `résultat × 100`, ce qui marchait aux concours
 * mais s'inversait aux courses : 12,4 s rapportaient 1240 points quand 9,18 s
 * n'en rapportaient que 918. Courir vite était donc pénalisé.
 *
 * On note désormais l'ÉCART AU MINIMA, dans le bon sens selon l'épreuve, ce
 * qui a l'avantage de mettre les quatre épreuves sur la même échelle : un
 * javelot à 85 m ne vaut plus vingt fois un saut à 8 m.
 */
export function scoreFor(event: EventId, result: number): number {
  if (result <= 0) return 0;
  const target = CONFIG.trackField.qualify[event];
  const ratio = EVENT_UNIT[event] === 's' ? target / result : result / target;
  return Math.round(ratio * 1000);
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
  /**
   * L'appel en cours : d'où il part, combien de mètres il couvre, et depuis
   * combien de temps. La portée n'est pas fixe — elle est calculée pour que
   * le sommet de l'arc tombe sur la haie visée.
   */
  const jump = useRef({ from: 0, span: 0, time: 0, snapped: false });
  /** Haie visée par un appui déjà donné, en attente du point d'appel. */
  const armed = useRef<number | null>(null);

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
        // Dès qu'on tient le bouton pour régler l'angle, la vitesse est FIGÉE
        // à celle du moment. C'est l'élan acquis qu'on emporte dans le saut :
        // le joueur peut lâcher le martèlement et ne viser que l'angle.
        // `n.settingAngle` est encore vrai sur l'image du RELÂCHEMENT : sans
        // cela la vitesse se remettait à jour juste avant que le saut soit
        // calculé, et le résultat dépendait encore du martèlement.
        //
        // Même principe en vol au-dessus d'une haie, et pour la même raison :
        // sur un téléphone on n'a que deux pouces. Appuyer sur SAUT oblige à
        // en lever un des boutons de course, l'alternance s'interrompt, et la
        // cadence retombe avec une constante de temps de 0,5 s — sur un vol de
        // près d'une seconde, on atterrissait presque à l'arrêt. Dix fois de
        // suite, le minima devenait inatteignable même en franchissant tout.
        //
        // Seuls les sauts CALÉS sur une haie figent la vitesse : sinon il
        // suffirait d'enchaîner des sauts dans le vide pour garder sa pointe
        // de vitesse sans plus jamais marteler.
        const lockingSpeed =
          n.phase === 'running' &&
          ((isFieldEvent(event) && (actionHeld.current || n.settingAngle)) ||
            (event === 'hurdles' && n.airborne && jump.current.snapped));

        // L'accumulateur redescend tout seul : arrêter de marteler fait
        // retomber la cadence mesurée, donc la vitesse. Il se fige AVEC la
        // vitesse, sans quoi on retombait au sol l'accumulateur vide et il
        // fallait tout reconstruire après chacune des dix haies.
        if (!lockingSpeed) {
          cadence.current = Math.max(0, cadence.current - (cadence.current * dt) / cfg.tapWindow);
        }

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
              // Le saut se CALE sur la prochaine haie : on prend autant de
              // mètres après elle qu'on en avait avant, si bien que le sommet
              // de l'arc tombe pile au-dessus. C'est ce qui rend le geste
              // lisible — et donc apprenable.
              // La PREMIÈRE haie non franchie, sans exiger qu'elle soit encore
              // devant : la distance a déjà été intégrée plus haut dans cette
              // même image, si bien qu'un appui au tout dernier moment visait
              // la haie SUIVANTE et laissait passer celle qu'on voulait sauter.
              const next = n.hurdles.find((h) => !h.cleared);
              const gap = next ? next.x - n.runDistance : Infinity;
              if (next && gap <= cfg.hurdleTakeoffZone) {
                // Appuyer dans la zone ARME le saut sur cette haie ; l'athlète
                // décollera tout seul au bon endroit. C'est ce qui permet de
                // garder un vol court sans exiger un appui à la milliseconde.
                armed.current = next.x;
                n.armedHurdle = next.x;
              } else {
                // Loin de toute haie : un simple bond, qui ne fige rien.
                n.airborne = true;
                jump.current = {
                  from: n.runDistance,
                  span: cfg.hurdleJumpSpan,
                  time: 0,
                  snapped: false,
                };
              }
            }

            // Décollage : TOUJOURS à la même distance de la barre. Le sommet
            // de l'arc tombe donc pile dessus, et le vol dure autant quel que
            // soit le moment de l'appui.
            if (armed.current !== null && !n.airborne) {
              const from = armed.current - cfg.hurdleTakeoff;
              if (n.runDistance >= from) {
                n.airborne = true;
                jump.current = { from, span: cfg.hurdleTakeoff * 2, time: 0, snapped: true };
                armed.current = null;
                n.armedHurdle = null;
              }
            }
            if (n.airborne) {
              jump.current.time += dt;
              const progress = (n.runDistance - jump.current.from) / jump.current.span;
              // Un ARC, pas une rampe : on monte puis on redescend.
              // Un bond hors zone reste bas et court : le joueur voit
              // immédiatement qu'il n'a pas armé son saut, au lieu de se
              // demander pourquoi il « saute sur place » une fois sur deux.
              const arc = Math.max(0, Math.sin(Math.min(1, progress) * Math.PI));
              n.flightHeight = jump.current.snapped ? arc : arc * 0.4;
              if (progress >= 1 || jump.current.time > cfg.hurdleJumpMaxTime) {
                n.airborne = false;
                n.flightHeight = 0;
              }
            }
            n.hurdles = n.hurdles.map((h) => {
              if (h.cleared || n.runDistance < h.x) return h;
              // Seul un saut CALÉ sur la haie la franchit. Un bond déclenché
              // hors de la zone pouvait auparavant passer une barre par
              // accident : la règle devenait illisible, on ne savait plus à
              // quoi servait la zone.
              if (!n.airborne || !jump.current.snapped) {
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
            score: passed ? s.score + scoreFor(event, best) : s.score,
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
        jump.current = { from: 0, span: 0, time: 0, snapped: false };
        armed.current = null;
        actionHeld.current = false;
        actionPressed.current = false;
        setState(initial());
      },
    },
  };
}

export const TRACK_DIMENSIONS = { DASH_LENGTH, HURDLES_LENGTH, RUNWAY_LENGTH };
