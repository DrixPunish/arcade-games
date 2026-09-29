import { useCallback, useRef, useState } from 'react';
import { CONFIG, GameStatus } from '../../lib/gameConfig';
import { useGameLoop } from '../../hooks/useGameLoop';
import {
  COLS,
  GHOST_DOOR,
  MAZE,
  PACMAN_START,
  ROWS,
  SCATTER_CORNERS,
  TUNNEL_ROW,
  isWalkable,
  wrapTunnel,
} from './maze';

const cfg = CONFIG.pacman;

export type Dir = 'up' | 'down' | 'left' | 'right';
export type GhostName = 'blinky' | 'pinky' | 'inky' | 'clyde';

/**
 * Où en est un fantôme par rapport à la maison. `out` est le seul état où il
 * navigue vraiment dans le labyrinthe ; `leaving` et `entering` sont des
 * trajets scriptés, parce que l'intérieur de la maison n'est pas un couloir.
 */
export type GhostPhase = 'home' | 'leaving' | 'out' | 'entering';

export type Ghost = {
  name: GhostName;
  col: number;
  row: number;
  dir: Dir;
  phase: GhostPhase;
  /** Bleu, donc gobable. */
  frightened: boolean;
  /** Mangé : il ne reste que les yeux, qui rentrent seuls à la maison. */
  eyes: boolean;
  /** Trajet imposé, en cases, suivi un axe à la fois. */
  path: { col: number; row: number }[];
};

export type PacmanPhase = 'ready' | 'playing' | 'dying' | 'clear' | 'over';

export type PacmanState = {
  status: GameStatus;
  phase: PacmanPhase;
  score: number;
  lives: number;
  level: number;
  /**
   * Gommes restantes. Comme elle décroît strictement, cette valeur sert aussi
   * de clé de mémoïsation au tapis de gommes, qui n'est donc redessiné qu'aux
   * bouchées et non à chaque image.
   */
  dotsLeft: number;
  /** 0 vide, 1 pac-gomme, 2 super-gomme, indexé `row * COLS + col`. */
  pellets: Uint8Array;
  pac: { col: number; row: number; dir: Dir; mouth: number };
  ghosts: Ghost[];
  /** Temps restant de l'effet super-gomme. */
  fright: number;
  fruit: { col: number; row: number; points: number } | null;
  /** Score flottant affiché un instant sur un fantôme gobé ou un fruit. */
  popup: { col: number; row: number; text: string; t: number } | null;
  /** Avance de l'animation en cours (READY!, mort, tableau terminé). */
  timer: number;
  message: string;
};

const DIRS: Record<Dir, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * Ordre de préférence en cas d'égalité de distance : haut, gauche, bas, droite.
 * Ce détail n'est pas cosmétique — c'est lui qui rend les trajectoires des
 * fantômes reproductibles, et donc apprenables par le joueur.
 */
const DIR_ORDER: readonly Dir[] = ['up', 'left', 'down', 'right'];

const GHOST_ORDER: readonly GhostName[] = ['blinky', 'pinky', 'inky', 'clyde'];
/** Place de départ de chacun dans la maison. Blinky, lui, démarre dehors. */
const GHOST_SLOT: Record<GhostName, number> = { blinky: 13.5, pinky: 13.5, inky: 11.5, clyde: 15.5 };
const HOME_ROW = 14;
/** Le fruit apparaît juste sous la maison. */
const FRUIT_SPOT = { col: 13.5, row: 17 };

const dist2 = (ac: number, ar: number, bc: number, br: number): number =>
  (ac - bc) ** 2 + (ar - br) ** 2;

/* --------------------------------------------------------------- réglages -- */

/**
 * La borne accélère tout le monde au fil des niveaux, sans jamais toucher au
 * labyrinthe : c'est la seule montée en difficulté du jeu.
 */
export function levelSpeeds(level: number): {
  pac: number;
  pacFrightened: number;
  ghost: number;
  ghostFrightened: number;
} {
  const s = cfg.speed;
  if (level <= 1) {
    return { pac: s.pac, pacFrightened: s.pacFrightened, ghost: s.ghost, ghostFrightened: s.ghostFrightened };
  }
  if (level <= 4) return { pac: 0.9, pacFrightened: 0.95, ghost: 0.85, ghostFrightened: 0.55 };
  if (level <= 20) return { pac: 1, pacFrightened: 1, ghost: 0.95, ghostFrightened: 0.6 };
  // Au-delà du 20, Pac-Man ralentit alors que les fantômes gardent le rythme.
  return { pac: 0.9, pacFrightened: 0.9, ghost: 0.95, ghostFrightened: 0.6 };
}

/**
 * Alternance dispersion / poursuite. Les index pairs sont des dispersions.
 * Passé la fin de la liste, la poursuite ne s'arrête plus.
 */
export function scatterChaseFor(level: number): readonly number[] {
  if (level <= 1) return cfg.scatterChase;
  // Dès le niveau 2 les replis se raccourcissent, puis disparaissent presque :
  // les fantômes ne lâchent pratiquement plus la traque.
  return level < 5 ? [7, 20, 7, 20, 5, 1033, 0.02] : [5, 20, 5, 20, 5, 1037, 0.02];
}

export const frightSecondsFor = (level: number): number =>
  cfg.frightSeconds[Math.min(level - 1, cfg.frightSeconds.length - 1)] ?? 0;

export const fruitPointsFor = (level: number): number =>
  cfg.fruitPoints[Math.min(level - 1, cfg.fruitPoints.length - 1)];

/**
 * Niveau de « Cruise Elroy » de Blinky : 0 normal, 1 puis 2 à mesure que le
 * tableau se vide. Les seuils montent avec les niveaux, si bien que la traque
 * démarre de plus en plus tôt.
 */
export function elroyStage(dotsLeft: number, level: number): 0 | 1 | 2 {
  const bonus = Math.min(30, (level - 1) * 4);
  if (dotsLeft <= cfg.elroy.dotsLeft2 + bonus / 2) return 2;
  if (dotsLeft <= cfg.elroy.dotsLeft1 + bonus) return 1;
  return 0;
}

/* ------------------------------------------------------------ déplacement -- */

type Mover = { col: number; row: number; dir: Dir };

/**
 * Avance le long du couloir en s'arrêtant à chaque centre de case : c'est là,
 * et seulement là, qu'une direction peut changer. Découper le pas ainsi rend
 * le déplacement indépendant de la cadence d'affichage — un téléphone qui
 * rame ne fait pas traverser les murs.
 *
 * `chooseDir` est consulté à chaque centre, AVANT de repartir ; renvoyer
 * `null` immobilise l'entité contre le mur.
 */
export function advance(m: Mover, distance: number, chooseDir: (at: Mover) => Dir | null): void {
  let left = distance;
  // Garde-fou : une case fait au moins une demi-unité, on ne peut pas en
  // franchir des dizaines en une image sans que quelque chose cloche.
  for (let guard = 0; left > 1e-9 && guard < 64; guard += 1) {
    // Pile au centre d'une case, on redemande la direction AVANT d'avancer.
    //
    // La demander seulement à l'arrivée ne suffit pas : une entité arrêtée
    // contre un mur redémarrait alors d'une case entière dans le mur avant
    // qu'on ne lui pose la question. C'est ainsi que Pac-Man traversait les
    // murs dès qu'on le poussait dans un cul-de-sac.
    if (Math.abs(m.col - Math.round(m.col)) < 1e-9 && Math.abs(m.row - Math.round(m.row)) < 1e-9) {
      const next = chooseDir(m);
      if (!next) return;
      m.dir = next;
    }

    const d = DIRS[m.dir];
    // Position le long de l'axe de marche, comptée dans le sens de la marche.
    const along = d.dc !== 0 ? m.col * d.dc : m.row * d.dr;
    const gap = Math.floor(along + 1e-9) + 1 - along;

    if (left < gap) {
      m.col += d.dc * left;
      m.row += d.dr * left;
      return;
    }

    m.col += d.dc * gap;
    m.row += d.dr * gap;
    // Recalage exact sur le centre : sans lui, les arrondis dérivent et
    // l'entité finit désalignée du couloir au bout de quelques minutes.
    m.col = Math.round(m.col);
    m.row = Math.round(m.row);
    wrapTunnel(m);
    left -= gap;
  }
}

/** Suit le trajet scripté ; renvoie vrai une fois arrivé au bout. */
function followPath(g: Ghost, distance: number): boolean {
  let left = distance;
  while (left > 1e-9 && g.path.length > 0) {
    const wp = g.path[0];
    const dc = wp.col - g.col;
    const dr = wp.row - g.row;
    // Un axe à la fois : la maison se traverse en L, jamais en diagonale.
    const onCol = Math.abs(dc) > 1e-6;
    const delta = onCol ? dc : dr;
    if (Math.abs(delta) < 1e-6) {
      g.path.shift();
      continue;
    }
    const move = Math.min(left, Math.abs(delta));
    const sign = Math.sign(delta);
    if (onCol) {
      g.col += sign * move;
      g.dir = sign > 0 ? 'right' : 'left';
    } else {
      g.row += sign * move;
      g.dir = sign > 0 ? 'down' : 'up';
    }
    left -= move;
  }
  return g.path.length === 0;
}

/* ------------------------------------------------------------------- IA --- */

/**
 * La case visée par chaque fantôme. C'est ici, et nulle part ailleurs, que se
 * joue leur personnalité : tous appliquent ensuite le même algorithme bête
 * « je prends le couloir qui me rapproche de ma cible ».
 */
export function ghostTarget(
  name: GhostName,
  self: { col: number; row: number },
  pac: { col: number; row: number; dir: Dir },
  blinky: { col: number; row: number },
  chase: boolean,
): { col: number; row: number } {
  if (!chase) return SCATTER_CORNERS[name];

  const pc = Math.round(pac.col);
  const pr = Math.round(pac.row);
  const d = DIRS[pac.dir];

  switch (name) {
    case 'blinky':
      // Le poursuivant pur : il vise Pac-Man, point.
      return { col: pc, row: pr };

    case 'pinky': {
      // L'embusqué : quatre cases DEVANT Pac-Man, pour lui couper la route.
      // Le décalage vers la gauche quand Pac-Man monte est le fameux bug de
      // débordement de la borne de 1980 ; on le garde, les joueurs de
      // l'époque ont appris à s'en servir.
      const bug = pac.dir === 'up' ? -4 : 0;
      return { col: pc + d.dc * 4 + bug, row: pr + d.dr * 4 };
    }

    case 'inky': {
      // Le capricieux : on prend le point deux cases devant Pac-Man, et on
      // double le vecteur qui part de Blinky vers ce point. Résultat, Inky
      // n'est dangereux que lorsque Blinky est déjà dans les parages.
      const bug = pac.dir === 'up' ? -2 : 0;
      const pivotCol = pc + d.dc * 2 + bug;
      const pivotRow = pr + d.dr * 2;
      return { col: pivotCol * 2 - Math.round(blinky.col), row: pivotRow * 2 - Math.round(blinky.row) };
    }

    case 'clyde':
    default:
      // Le timide : il fonce tant qu'il est loin, et détale vers son coin dès
      // qu'il approche à huit cases. C'est le seul dont on peut s'approcher,
      // et donc celui qui rend le coin bas-gauche fréquentable.
      return dist2(self.col, self.row, pc, pr) > 8 * 8
        ? { col: pc, row: pr }
        : SCATTER_CORNERS.clyde;
  }
}

/** Le couloir que prend un fantôme depuis le centre de case où il se trouve. */
export function ghostChoose(
  g: { col: number; row: number; dir: Dir },
  target: { col: number; row: number },
  random: boolean,
): Dir {
  const back = OPPOSITE[g.dir];
  const options: Dir[] = [];
  let best: Dir | null = null;
  let bestDist = Infinity;

  for (const d of DIR_ORDER) {
    // Un fantôme ne fait jamais demi-tour de lui-même.
    if (d === back) continue;
    const c = g.col + DIRS[d].dc;
    const r = g.row + DIRS[d].dr;
    if (!isWalkable(c, r)) continue;
    options.push(d);
    const dd = dist2(c, r, target.col, target.row);
    // Strictement inférieur : les égalités retombent sur l'ordre de préférence.
    if (dd < bestDist) {
      bestDist = dd;
      best = d;
    }
  }

  if (options.length === 0) return back; // cul-de-sac : demi-tour forcé
  if (random) return options[Math.floor(Math.random() * options.length)];
  return best ?? back;
}

/* ---------------------------------------------------------------- partie -- */

function freshPellets(): { pellets: Uint8Array; dots: number } {
  const pellets = new Uint8Array(COLS * ROWS);
  let dots = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const ch = MAZE[r][c];
      if (ch === '.') {
        pellets[r * COLS + c] = 1;
        dots += 1;
      } else if (ch === 'o') {
        pellets[r * COLS + c] = 2;
        dots += 1;
      }
    }
  }
  return { pellets, dots };
}

function freshGhosts(): Ghost[] {
  return GHOST_ORDER.map((name) => ({
    name,
    col: GHOST_SLOT[name],
    // Blinky patrouille déjà devant la porte au coup d'envoi.
    row: name === 'blinky' ? GHOST_DOOR.row : HOME_ROW,
    dir: name === 'blinky' ? 'left' : 'up',
    phase: name === 'blinky' ? 'out' : 'home',
    frightened: false,
    eyes: false,
    path: [],
  }));
}

function initial(): PacmanState {
  const { pellets, dots } = freshPellets();
  return {
    status: 'running',
    phase: 'ready',
    score: 0,
    lives: cfg.lives,
    level: 1,
    dotsLeft: dots,
    pellets,
    pac: { col: PACMAN_START.col, row: PACMAN_START.row, dir: 'left', mouth: 0 },
    ghosts: freshGhosts(),
    fright: 0,
    fruit: null,
    popup: null,
    timer: 0,
    message: 'READY !',
  };
}

export function usePacmanGame(): {
  state: PacmanState;
  controls: {
    steer: (dir: Dir) => void;
    pause: () => void;
    restart: () => void;
  };
  /**
   * Relève les événements de la dernière image ET les efface, pour la couche
   * sonore. Les effacer ici plutôt que chez l'appelant évite qu'un rendu
   * déclenché par autre chose que la boucle de jeu — un clignotement, par
   * exemple — ne rejoue le son de l'image précédente.
   */
  takeEvents: () => PacmanEvents;
} {
  const [state, setState] = useState<PacmanState>(initial);

  /** Direction demandée par le joueur, appliquée au prochain centre de case. */
  const wanted = useRef<Dir | null>(null);
  /** Où en est l'alternance dispersion / poursuite. */
  const modeRef = useRef({ index: 0, elapsed: 0 });
  /** Gommes avalées depuis le début du tableau : libère les fantômes et le fruit. */
  const eatenRef = useRef(0);
  /** Temps depuis la dernière gomme : débloque un fantôme qui traîne. */
  const idleRef = useRef(0);
  /** Combien de fantômes gobés sur la super-gomme en cours (score doublé). */
  const comboRef = useRef(0);
  const fruitShownRef = useRef(0);
  const extraLifeRef = useRef(false);
  /** Gel court à l'instant où un fantôme est gobé. */
  const freezeRef = useRef(0);
  const events = useRef<PacmanEvents>({ ...NO_EVENTS });

  const frame = useCallback((dt: number): void => {
    setState((s) => step(s, dt, {
      wanted,
      modeRef,
      eatenRef,
      idleRef,
      comboRef,
      fruitShownRef,
      extraLifeRef,
      freezeRef,
      events,
    }));
  }, []);

  useGameLoop(state.status === 'running' && state.phase !== 'over', frame);

  const reset = useCallback((): void => {
    wanted.current = null;
    modeRef.current = { index: 0, elapsed: 0 };
    eatenRef.current = 0;
    idleRef.current = 0;
    comboRef.current = 0;
    fruitShownRef.current = 0;
    extraLifeRef.current = false;
    freezeRef.current = 0;
  }, []);

  const takeEvents = useCallback((): PacmanEvents => {
    const current = events.current;
    const snapshot = { ...current };
    Object.assign(current, NO_EVENTS);
    return snapshot;
  }, []);

  return {
    state,
    takeEvents,
    controls: {
      steer: useCallback((dir: Dir) => {
        wanted.current = dir;
      }, []),
      pause: useCallback(() => {
        setState((s) => ({
          ...s,
          status: s.status === 'paused' ? 'running' : s.status === 'running' ? 'paused' : s.status,
        }));
      }, []),
      restart: useCallback(() => {
        reset();
        setState(initial());
      }, [reset]),
    },
  };
}

/* ------------------------------------------------------------ sons émis --- */

export type PacmanEvents = {
  dot: boolean;
  power: boolean;
  eatGhost: boolean;
  fruit: boolean;
  death: boolean;
  extraLife: boolean;
  levelClear: boolean;
};
const NO_EVENTS: PacmanEvents = {
  dot: false,
  power: false,
  eatGhost: false,
  fruit: false,
  death: false,
  extraLife: false,
  levelClear: false,
};

/* ------------------------------------------------------------- une image -- */

type Refs = {
  wanted: React.RefObject<Dir | null>;
  modeRef: React.RefObject<{ index: number; elapsed: number }>;
  eatenRef: React.RefObject<number>;
  idleRef: React.RefObject<number>;
  comboRef: React.RefObject<number>;
  fruitShownRef: React.RefObject<number>;
  extraLifeRef: React.RefObject<boolean>;
  freezeRef: React.RefObject<number>;
  events: React.RefObject<PacmanEvents>;
};

function placeForNewLife(s: PacmanState): void {
  s.pac = { col: PACMAN_START.col, row: PACMAN_START.row, dir: 'left', mouth: 0 };
  s.ghosts = freshGhosts();
  s.fright = 0;
  s.popup = null;
}

export function step(prev: PacmanState, dt: number, refs: Refs): PacmanState {
  const ev = refs.events.current;
  // Les événements ne valent que pour l'image en cours : la couche sonore les
  // lit juste après, puis ils repartent à zéro.
  ev.dot = false;
  ev.power = false;
  ev.eatGhost = false;
  ev.fruit = false;
  ev.death = false;
  ev.extraLife = false;
  ev.levelClear = false;

  const s: PacmanState = {
    ...prev,
    pac: { ...prev.pac },
    ghosts: prev.ghosts.map((g) => ({ ...g, path: g.path })),
  };

  /* --- séquences d'ambiance : rien ne bouge tant qu'elles durent --------- */

  if (s.phase === 'ready') {
    s.timer += dt;
    if (s.timer >= cfg.readySeconds) {
      s.phase = 'playing';
      s.timer = 0;
      s.message = '';
    }
    return s;
  }

  if (s.phase === 'dying') {
    s.timer += dt;
    if (s.timer < cfg.dyingSeconds) return s;
    s.timer = 0;
    if (s.lives <= 0) {
      s.phase = 'over';
      s.status = 'gameOver';
      s.message = 'GAME OVER';
      return s;
    }
    placeForNewLife(s);
    refs.modeRef.current = { index: 0, elapsed: 0 };
    refs.idleRef.current = 0;
    refs.comboRef.current = 0;
    refs.wanted.current = null;
    s.phase = 'ready';
    s.message = 'READY !';
    return s;
  }

  if (s.phase === 'clear') {
    s.timer += dt;
    if (s.timer < cfg.clearSeconds) return s;
    // Tableau suivant : le labyrinthe se recharge, le score et les vies restent.
    const { pellets, dots } = freshPellets();
    s.level += 1;
    s.pellets = pellets;
    s.dotsLeft = dots;
    s.fruit = null;
    s.timer = 0;
    placeForNewLife(s);
    refs.modeRef.current = { index: 0, elapsed: 0 };
    refs.eatenRef.current = 0;
    refs.idleRef.current = 0;
    refs.comboRef.current = 0;
    refs.fruitShownRef.current = 0;
    refs.wanted.current = null;
    s.phase = 'ready';
    s.message = 'READY !';
    return s;
  }

  if (s.phase === 'over') return s;

  /* --- gel court après un fantôme gobé ---------------------------------- */

  if (s.popup) {
    s.popup = { ...s.popup, t: s.popup.t + dt };
    if (s.popup.t > 1) s.popup = null;
  }
  if (refs.freezeRef.current > 0) {
    refs.freezeRef.current -= dt;
    return s;
  }

  /* --- alternance dispersion / poursuite -------------------------------- */

  const schedule = scatterChaseFor(s.level);
  const mode = refs.modeRef.current;
  let reverseAll = false;
  // L'effet super-gomme met l'alternance en pause : le compteur ne reprend
  // qu'une fois les fantômes redevenus dangereux.
  if (s.fright <= 0 && mode.index < schedule.length) {
    mode.elapsed += dt;
    if (mode.elapsed >= schedule[mode.index]) {
      mode.elapsed = 0;
      mode.index += 1;
      // Tout changement de phase renvoie les fantômes sur leurs pas : c'est le
      // signal visuel qui prévient le joueur que la traque reprend.
      reverseAll = true;
    }
  }
  const chasing = mode.index % 2 === 1 || mode.index >= schedule.length;

  if (s.fright > 0) {
    s.fright = Math.max(0, s.fright - dt);
    if (s.fright === 0) {
      refs.comboRef.current = 0;
      for (const g of s.ghosts) g.frightened = false;
    }
  }

  const speeds = levelSpeeds(s.level);

  /* --- Pac-Man ----------------------------------------------------------- */

  const pac = s.pac;
  const want = refs.wanted.current;
  // Le demi-tour est le seul changement autorisé hors d'un centre de case :
  // sans lui, la commande paraît molle quand on veut fuir un fantôme.
  //
  // Hors d'un centre, il est toujours légal : Pac-Man est entre deux cases
  // praticables et repart simplement vers celle d'où il vient. Il n'y a qu'au
  // centre exact qu'il faut vérifier qu'un mur ne se trouve pas derrière lui.
  if (want && want === OPPOSITE[pac.dir]) {
    const centerCol = Math.round(pac.col);
    const centerRow = Math.round(pac.row);
    const atCenter =
      Math.abs(pac.col - centerCol) < 1e-6 && Math.abs(pac.row - centerRow) < 1e-6;
    if (!atCenter || isWalkable(centerCol + DIRS[want].dc, centerRow + DIRS[want].dr)) {
      pac.dir = want;
    }
  }

  const pacSpeed = (s.fright > 0 ? speeds.pacFrightened : speeds.pac) * cfg.baseSpeed;
  const before = { col: pac.col, row: pac.row };
  advance(pac, pacSpeed * dt, (at) => {
    const w = refs.wanted.current;
    if (w && isWalkable(at.col + DIRS[w].dc, at.row + DIRS[w].dr)) return w;
    if (isWalkable(at.col + DIRS[at.dir].dc, at.row + DIRS[at.dir].dr)) return at.dir;
    return null;
  });
  const moved = Math.abs(pac.col - before.col) + Math.abs(pac.row - before.row);
  // La bouche s'ouvre et se ferme au rythme de la DISTANCE parcourue : elle
  // s'immobilise donc naturellement quand Pac-Man bute contre un mur.
  pac.mouth = (pac.mouth + moved * 1.6) % 1;

  /* --- gommes ------------------------------------------------------------ */

  const pc = Math.round(pac.col);
  const pr = Math.round(pac.row);
  const idx = pr * COLS + pc;
  refs.idleRef.current += dt;

  if (pc >= 0 && pc < COLS && pr >= 0 && pr < ROWS && s.pellets[idx] !== 0) {
    const kind = s.pellets[idx];
    // On ne recopie le tapis qu'à la bouchée, pas à chaque image.
    const next = new Uint8Array(s.pellets);
    next[idx] = 0;
    s.pellets = next;
    s.dotsLeft -= 1;
    s.score += kind === 2 ? cfg.powerPoints : cfg.dotPoints;
    refs.eatenRef.current += 1;
    refs.idleRef.current = 0;

    if (kind === 2) {
      ev.power = true;
      const duration = frightSecondsFor(s.level);
      refs.comboRef.current = 0;
      if (duration > 0) {
        s.fright = duration;
        for (const g of s.ghosts) {
          // Seuls les fantômes entiers et lancés virent au bleu : des yeux en
          // route vers la maison ne se laissent pas rattraper.
          if (!g.eyes) {
            g.frightened = true;
            if (g.phase === 'out') g.dir = OPPOSITE[g.dir];
          }
        }
      }
    } else {
      ev.dot = true;
    }

    // Le fruit sort à la 70e puis à la 170e gomme.
    const milestone = cfg.fruitAtDots[refs.fruitShownRef.current];
    if (milestone !== undefined && refs.eatenRef.current >= milestone) {
      refs.fruitShownRef.current += 1;
      s.fruit = { col: FRUIT_SPOT.col, row: FRUIT_SPOT.row, points: fruitPointsFor(s.level) };
      s.timer = 0;
    }
  }

  if (!refs.extraLifeRef.current && s.score >= cfg.extraLifeAt) {
    refs.extraLifeRef.current = true;
    s.lives += 1;
    ev.extraLife = true;
  }

  /* --- fruit ------------------------------------------------------------- */

  if (s.fruit) {
    s.timer += dt;
    if (dist2(pac.col, pac.row, s.fruit.col, s.fruit.row) < cfg.catchDistance ** 2 * 4) {
      s.score += s.fruit.points;
      s.popup = { col: s.fruit.col, row: s.fruit.row, text: String(s.fruit.points), t: 0 };
      s.fruit = null;
      ev.fruit = true;
    } else if (s.timer >= cfg.fruitSeconds) {
      s.fruit = null;
      s.timer = 0;
    }
  }

  /* --- libération des fantômes ------------------------------------------ */

  for (const g of s.ghosts) {
    if (g.phase !== 'home') continue;
    const quota = cfg.releaseDots[g.name as 'pinky' | 'inky' | 'clyde'];
    const freed =
      quota === undefined ||
      refs.eatenRef.current >= quota ||
      // Filet de sécurité : un joueur qui tourne en rond sans manger verrait
      // sinon les fantômes rester enfermés indéfiniment.
      refs.idleRef.current >= cfg.releaseTimeout;
    if (freed) {
      g.phase = 'leaving';
      g.path = [
        { col: GHOST_SLOT[g.name], row: HOME_ROW },
        { col: GHOST_DOOR.col, row: HOME_ROW },
        { col: GHOST_DOOR.col, row: GHOST_DOOR.row },
      ];
      refs.idleRef.current = 0;
    }
  }

  /* --- fantômes ---------------------------------------------------------- */

  const blinky = s.ghosts[0];

  for (const g of s.ghosts) {
    if (reverseAll && g.phase === 'out' && !g.eyes && s.fright <= 0) g.dir = OPPOSITE[g.dir];

    if (g.phase === 'home') {
      // Ils font le pied de grue en oscillant sur place.
      const bob = cfg.baseSpeed * 0.3 * dt;
      g.row += g.dir === 'up' ? -bob : bob;
      if (g.row < HOME_ROW - 0.45) g.dir = 'down';
      if (g.row > HOME_ROW + 0.45) g.dir = 'up';
      continue;
    }

    if (g.phase === 'leaving') {
      if (followPath(g, cfg.baseSpeed * speeds.ghost * dt)) {
        g.phase = 'out';
        // On sort systématiquement vers la gauche, comme sur la borne.
        g.dir = 'left';
        g.eyes = false;
        g.frightened = s.fright > 0;
      }
      continue;
    }

    if (g.phase === 'entering') {
      if (followPath(g, cfg.baseSpeed * cfg.speed.ghostEyes * dt)) {
        // Arrivé au fond de la maison, il repart aussitôt : le joueur n'a
        // qu'un court répit après avoir gobé un fantôme.
        g.eyes = false;
        g.frightened = false;
        g.phase = 'leaving';
        g.path = [
          { col: GHOST_DOOR.col, row: HOME_ROW },
          { col: GHOST_DOOR.col, row: GHOST_DOOR.row },
        ];
      }
      continue;
    }

    // --- en vadrouille dans le labyrinthe ---
    const inTunnel = Math.round(g.row) === TUNNEL_ROW && (g.col < 6 || g.col > COLS - 7);
    // Seul Blinky devient Elroy, et seulement tant qu'il est entier.
    const elroy = g.name === 'blinky' && !g.eyes && !g.frightened ? elroyStage(s.dotsLeft, s.level) : 0;
    let pct: number;
    if (g.eyes) pct = cfg.speed.ghostEyes;
    else if (inTunnel) pct = cfg.speed.ghostTunnel;
    else if (g.frightened) pct = speeds.ghostFrightened;
    else if (elroy === 2) pct = Math.max(speeds.ghost, cfg.elroy.speed2);
    else if (elroy === 1) pct = Math.max(speeds.ghost, cfg.elroy.speed1);
    else pct = speeds.ghost;

    const target = g.eyes
      ? { col: Math.round(GHOST_DOOR.col), row: GHOST_DOOR.row }
      : // Elroy ignore les phases de repli : il ne lâche plus Pac-Man.
        ghostTarget(g.name, g, pac, blinky, chasing || elroy > 0);

    advance(g, cfg.baseSpeed * pct * dt, (at) => ghostChoose(at, target, g.frightened && !g.eyes));

    // Les yeux arrivés au-dessus de la porte replongent dans la maison.
    //
    // On compare la RANGÉE à l'unité près mais la colonne à un intervalle :
    // après un pas d'image, le fantôme est presque toujours entre deux cases,
    // et une égalité stricte sur la colonne n'était jamais vraie — les yeux
    // tournaient indéfiniment devant la porte sans jamais rentrer.
    if (g.eyes && Math.abs(g.row - GHOST_DOOR.row) < 1e-6 && g.col >= 13 && g.col <= 14) {
      g.phase = 'entering';
      g.path = [
        { col: GHOST_DOOR.col, row: GHOST_DOOR.row },
        { col: GHOST_DOOR.col, row: HOME_ROW },
      ];
    }
  }

  /* --- rencontres -------------------------------------------------------- */

  for (const g of s.ghosts) {
    if (g.eyes || g.phase === 'home' || g.phase === 'entering') continue;
    if (dist2(pac.col, pac.row, g.col, g.row) > cfg.catchDistance ** 2) continue;

    if (g.frightened) {
      const value = cfg.ghostPoints[Math.min(refs.comboRef.current, cfg.ghostPoints.length - 1)];
      refs.comboRef.current += 1;
      s.score += value;
      g.eyes = true;
      g.frightened = false;
      g.phase = 'out';
      s.popup = { col: g.col, row: g.row, text: String(value), t: 0 };
      refs.freezeRef.current = cfg.ghostEatenPause;
      ev.eatGhost = true;
      break;
    }

    // Touché : on perd une vie et le tableau se remet en place.
    s.lives -= 1;
    s.phase = 'dying';
    s.timer = 0;
    s.message = '';
    ev.death = true;
    return s;
  }

  /* --- tableau terminé --------------------------------------------------- */

  if (s.dotsLeft <= 0) {
    s.phase = 'clear';
    s.timer = 0;
    s.fruit = null;
    s.message = 'TABLEAU TERMINÉ';
    ev.levelClear = true;
  }

  return s;
}

/** Repères géométriques partagés avec l'écran de rendu. */
export const PACMAN_DIMENSIONS = { COLS, ROWS, TUNNEL_ROW };
