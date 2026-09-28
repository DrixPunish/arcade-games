/**
 * Sprites de Space Invaders, redessinés d'après les motifs de la borne Taito
 * de 1978 : trois familles d'envahisseurs à deux images d'animation, le canon,
 * la soucoupe et le bunker.
 *
 * Le moteur de rendu (grille de texte -> tracé SVG) vit dans `lib/pixelArt`.
 */
import { Bitmap } from '../../lib/pixelArt';

export { bitmapCols, bitmapRows, spritePath } from '../../lib/pixelArt';
export type { Bitmap } from '../../lib/pixelArt';

/** Calmar — rangée du haut, 30 points. */
export const SQUID: readonly Bitmap[] = [
  [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '..X..X..',
    '.X.XX.X.',
    'X.X..X.X',
  ],
  [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '.X.XX.X.',
    'X......X',
    '.X....X.',
  ],
];

/** Crabe — rangées du milieu, 20 points. */
export const CRAB: readonly Bitmap[] = [
  [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
  ],
  [
    '..X.....X..',
    'X..X...X..X',
    'X.XXXXXXX.X',
    'XXX.XXX.XXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..X.....X..',
    '.X.......X.',
  ],
];

/** Pieuvre — rangées du bas, 10 points. */
export const OCTOPUS: readonly Bitmap[] = [
  [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXX..XX..XXX',
    'XXXXXXXXXXXX',
    '...XX..XX...',
    '..XX.XX.XX..',
    'XX........XX',
  ],
  [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXX..XX..XXX',
    'XXXXXXXXXXXX',
    '..XXX..XXX..',
    '.XX..XX..XX.',
    '..XX....XX..',
  ],
];

/** Canon du joueur. */
export const CANNON: Bitmap = [
  '......X......',
  '.....XXX.....',
  '.....XXX.....',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
];

/** Soucoupe mystère qui traverse le haut de l'écran. */
export const SAUCER: Bitmap = [
  '.....XXXXXX.....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '.XX.XX.XX.XX.XX.',
  'XXXXXXXXXXXXXXXX',
  '..XXX..XX..XXX..',
  '...X..XXXX..X...',
];

/** Éclat d'explosion, affiché brièvement à la place de ce qui est détruit. */
export const EXPLOSION: Bitmap = [
  '.X..X...X..X.',
  '..X..X.X..X..',
  '...XXXXXXX...',
  '..XXX.X.XXX..',
  'XXXXXXXXXXXXX',
  '..XXX.X.XXX..',
  '...XXXXXXX...',
  '..X..X.X..X..',
];

/**
 * Silhouette du bunker : sommet arrondi et arche creusée en dessous.
 * Chaque case est un morceau destructible indépendant.
 */
export const BUNKER: Bitmap = [
  '...XXXXXXXX...',
  '..XXXXXXXXXX..',
  '.XXXXXXXXXXXX.',
  'XXXXXXXXXXXXXX',
  'XXXXX....XXXXX',
  'XXXX......XXXX',
];

export type InvaderKind = 'squid' | 'crab' | 'octopus';

export const INVADER_SPRITES: Record<InvaderKind, readonly Bitmap[]> = {
  squid: SQUID,
  crab: CRAB,
  octopus: OCTOPUS,
};

