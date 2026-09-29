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

/* ------------------------------------------------------------ Pac-Man ---- */

/**
 * Pac-Man en pixels, comme le reste du jeu : un disque de 13 pixels privé du
 * secteur de sa bouche. Les grilles sont calculées puis figées ici, pas
 * recalculées à l'affichage.
 *
 * Seules les trois images tournées vers la DROITE sont écrites ; les autres
 * directions s'obtiennent par quarts de tour (cf. `rotateBitmap`). Sur la
 * borne, l'animation enchaîne grand ouvert, mi-ouvert, fermé, mi-ouvert, au
 * rythme du déplacement — c'est ce battement qui fait le personnage, bien
 * plus que sa forme.
 */
const PAC_CLOSED: Bitmap = [
  '....XXXXX....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '....XXXXX....',
];

const PAC_HALF: Bitmap = [
  '....XXXXX....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXX..',
  'XXXXXXXXX....',
  'XXXXXX.......',
  'XXXXXXXXX....',
  'XXXXXXXXXXX..',
  '.XXXXXXXXXXX.',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '....XXXXX....',
];

const PAC_OPEN: Bitmap = [
  '....XXXXX....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXX..',
  '.XXXXXXXXX...',
  'XXXXXXXXX....',
  'XXXXXXXX.....',
  'XXXXXX.......',
  'XXXXXXXX.....',
  'XXXXXXXXX....',
  '.XXXXXXXXX...',
  '.XXXXXXXXXX..',
  '..XXXXXXXXX..',
  '....XXXXX....',
];

export const PAC_PIXELS = 13;

/**
 * Le battement de la bouche : grand ouvert, mi-ouvert, fermé, mi-ouvert.
 * Quatre images et non trois, pour que la fermeture et l'ouverture prennent
 * le même temps — sans quoi la mastication paraît boiteuse.
 */
export const PAC_CYCLE: readonly Bitmap[] = [PAC_OPEN, PAC_HALF, PAC_CLOSED, PAC_HALF];

/**
 * La mort : la bouche s'ouvre jusqu'à ne plus rien laisser. Sur la borne elle
 * s'ouvre vers le HAUT ; ces images regardent à droite comme les autres, et
 * l'écran leur applique le quart de tour voulu.
 */
export const PAC_DEATH: readonly Bitmap[] = [
  [
    '....XXXXX....',
    '..XXXXXX.....',
    '.XXXXXXX.....',
    '.XXXXXXX.....',
    'XXXXXXX......',
    'XXXXXXX......',
    'XXXXXX.......',
    'XXXXXXX......',
    'XXXXXXX......',
    '.XXXXXXX.....',
    '.XXXXXXX.....',
    '..XXXXXX.....',
    '....XXXXX....',
  ],
  [
    '....X........',
    '..XXXX.......',
    '.XXXXX.......',
    '.XXXXX.......',
    'XXXXXX.......',
    'XXXXXX.......',
    'XXXXXX.......',
    'XXXXXX.......',
    'XXXXXX.......',
    '.XXXXX.......',
    '.XXXXX.......',
    '..XXXX.......',
    '....X........',
  ],
  [
    '.............',
    '.............',
    '.XX..........',
    '.XXX.........',
    'XXXXX........',
    'XXXXXX.......',
    'XXXXXX.......',
    'XXXXXX.......',
    'XXXXX........',
    '.XXX.........',
    '.XX..........',
    '.............',
    '.............',
  ],
  [
    '.............',
    '.............',
    '.............',
    '.............',
    'XX...........',
    'XXXX.........',
    'XXXXXX.......',
    'XXXX.........',
    'XX...........',
    '.............',
    '.............',
    '.............',
    '.............',
  ],
  [
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    'XXXXXX.......',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
  ],
];

/** Quarts de tour à appliquer à une grille tournée vers la droite. */
export const PAC_TURNS: Record<Dir, number> = { right: 0, down: 1, left: 2, up: 3 };

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
