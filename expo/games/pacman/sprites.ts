import { Bitmap } from '../../lib/pixelArt';
import type { Dir, GhostName } from './usePacmanGame';

/**
 * Pac-Man et les fantômes sont dessinés de deux façons, chacune choisie pour
 * ce qu'elle rend le mieux :
 *
 *  - le CORPS des fantômes et le fruit sont des grilles de texte, comme les
 *    sprites de Space Invaders : c'est là que le grain pixel compte ;
 *  - les YEUX et la bouche de Pac-Man sont des formes SVG calculées, parce
 *    qu'elles bougent en continu et qu'une grille les rendrait saccadées.
 */

/**
 * Silhouette du fantôme, jupe au repos. Le dôme s'élargit sur quatre rangées
 * au lieu de trois : avec un galbe trop court, le fantôme lisait comme un
 * rectangle à coins arrondis plutôt que comme un drap.
 */
const GHOST_A: Bitmap = [
  '.....BBBB.....',
  '...BBBBBBBB...',
  '..BBBBBBBBBB..',
  '.BBBBBBBBBBBB.',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BB..BB..BB..BB',
];

/** Même silhouette, jupe décalée : l'alternance donne le flottement. */
const GHOST_B: Bitmap = [
  '.....BBBB.....',
  '...BBBBBBBB...',
  '..BBBBBBBBBB..',
  '.BBBBBBBBBBBB.',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  '.BB..BB..BB..B',
];

export const GHOST_FRAMES: readonly Bitmap[] = [GHOST_A, GHOST_B];
export const GHOST_PIXELS = 14;

/**
 * Le visage apeuré, posé sur le corps bleu. Il commence à la rangée 4 du
 * sprite : deux yeux carrés et une bouche en zigzag.
 */
export const SCARED_FACE: Bitmap = [
  '..WW......WW..',
  '..WW......WW..',
  '..............',
  '..............',
  '.W..W..W..W..W',
  'W..W..W..W..W.',
];
export const SCARED_FACE_ROW = 4;

export const GHOST_COLORS: Record<GhostName, string> = {
  blinky: '#ff2b1c',
  pinky: '#ffb7ff',
  inky: '#00ffde',
  clyde: '#ffa02f',
};

/** Bleu de peur, et le blanc clignotant des dernières secondes. */
export const FRIGHT_BODY = '#2121de';
export const FRIGHT_BODY_END = '#f4f4f4';
export const FRIGHT_FACE = '#fefefe';
export const FRIGHT_FACE_END = '#ff2b1c';

/**
 * Décalage des pupilles selon la direction, en fraction du rayon de l'œil.
 * Les fantômes regardent où ils vont : c'est ce qui permet au joueur
 * d'anticiper un virage une fraction de seconde avant qu'il n'arrive.
 */
/**
 * Proportions de l'œil, en fraction de la largeur du fantôme. Elles étaient
 * bien trop généreuses : deux gros globes occupaient tout le visage et
 * donnaient un air de peluche au lieu du regard fixe de la borne.
 */
export const EYE = { offsetX: 0.2, offsetY: -0.08, white: 0.13, pupil: 0.065, look: 0.055 };

export const EYE_LOOK: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Angle de rotation du sprite de Pac-Man, en degrés. */
export const PAC_ROTATION: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/**
 * Le secteur de Pac-Man, bouche ouverte de `mouthDeg` degrés de part et
 * d'autre de l'axe. Un `<Path>` recalculé par image, mais c'est un seul nœud
 * et une poignée de nombres : moins cher qu'une grille de 14 sur 14.
 */
export function pacPath(radius: number, mouthDeg: number): string {
  const a = (mouthDeg * Math.PI) / 180;
  if (a < 0.01) {
    // Bouche fermée : un disque plein, qu'aucun secteur ne sait décrire.
    return `M ${-radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`;
  }
  const x = radius * Math.cos(a);
  const y = radius * Math.sin(a);
  // Grand arc dès que la bouche dépasse le demi-tour, sinon le secteur
  // s'inverse et Pac-Man devient une part de tarte.
  const large = a < Math.PI / 2 ? 1 : 0;
  return `M 0 0 L ${x.toFixed(2)} ${-y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/**
 * Ouverture de la bouche au fil de la foulée : elle s'ouvre puis se referme,
 * jamais en sautant d'un état à l'autre.
 */
export const mouthAngle = (phase: number): number => {
  const wave = Math.abs(((phase % 1) * 2) - 1); // 1 -> 0 -> 1
  // Grande ouverte, la bouche fait près d'un quart de tour de chaque côté.
  // À 36 degrés elle restait une simple encoche : Pac-Man ressemblait à un
  // citron, et on ne voyait pas dans quel sens il allait.
  return 7 + wave * 41;
};

/** Les cerises du premier niveau. */
export const CHERRIES: Bitmap = [
  '.........SS.',
  '........SS..',
  '.......SS...',
  '..LLL.SS....',
  '.LLLL.S.....',
  '......S.....',
  '.RRR..RRR...',
  'RRRRR.RRRRR.',
  'RRRRR.RRRRR.',
  'RRRRR.RRRRR.',
  '.RRR...RRR..',
  '............',
];

export const CHERRY_PALETTE: Record<string, string> = {
  R: '#e5241a',
  L: '#3ddc48',
  S: '#8f6a3a',
};
