/**
 * Sprites de Space Invaders, redessinés d'après les motifs de la borne Taito
 * de 1978 : trois familles d'envahisseurs à deux images d'animation, le canon,
 * la soucoupe et le bunker.
 *
 * Chaque sprite est une grille de pixels décrite en texte (`X` = plein). Le
 * rendu ne fait PAS un nœud par pixel : `spritePath()` convertit la grille en
 * un seul tracé SVG, en fusionnant les pixels voisins d'une même ligne. Un
 * envahisseur = un `<Path>`, comme un rectangle coûtait un `<Rect>` avant.
 */

export type Bitmap = readonly string[];

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

export const bitmapCols = (bitmap: Bitmap): number => bitmap[0].length;
export const bitmapRows = (bitmap: Bitmap): number => bitmap.length;

/**
 * Convertit une grille de pixels en un seul tracé SVG.
 *
 * Les pixels pleins qui se suivent sur une ligne sont fusionnés en un seul
 * rectangle : un envahisseur de 11×8 tombe ainsi à une quinzaine de segments
 * au lieu de 88. `x`/`y` sont intégrés au tracé, ce qui évite de dépendre du
 * support des transformations et permet de mémoïser le résultat.
 */
export function spritePath(
  bitmap: Bitmap,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
): string {
  let d = '';
  for (let row = 0; row < bitmap.length; row += 1) {
    const line = bitmap[row];
    let col = 0;
    while (col < line.length) {
      if (line[col] !== 'X') {
        col += 1;
        continue;
      }
      let end = col;
      while (end + 1 < line.length && line[end + 1] === 'X') end += 1;
      const px = x + col * cellW;
      const py = y + row * cellH;
      const w = (end - col + 1) * cellW;
      d += `M${round(px)} ${round(py)}h${round(w)}v${round(cellH)}h${round(-w)}z`;
      col = end + 1;
    }
  }
  return d;
}

/** Deux décimales suffisent et gardent les chaînes de tracé courtes. */
const round = (n: number): number => Math.round(n * 100) / 100;
