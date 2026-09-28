/**
 * Le labyrinthe de Pac-Man, 28 colonnes sur 31 rangées comme la borne Namco
 * de 1980.
 *
 * Légende :
 *   `#` mur            `.` pac-gomme        `o` super-gomme
 *   ` ` couloir vide   `-` porte de la maison des fantômes
 *
 * Les deux ouvertures de la rangée 14 sont le tunnel : en sortir d'un côté
 * fait réapparaître de l'autre.
 */
export const MAZE: readonly string[] = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

export const COLS = 28;
export const ROWS = 31;

/** Rangée du tunnel : on y sort d'un bord pour rentrer par l'autre. */
export const TUNNEL_ROW = 14;

/**
 * Case de départ de Pac-Man : la trouée sans gomme au milieu de la rangée 23,
 * pile sous la maison des fantômes. Il s'y tient à cheval sur deux cases,
 * comme sur la borne.
 */
export const PACMAN_START = { col: 13.5, row: 23 };

/**
 * Maison des fantômes : la case devant la porte, et les places intérieures.
 * Les fantômes en sortent un à un.
 */
export const GHOST_DOOR = { col: 13.5, row: 11 };
export const GHOST_HOME = { col: 13.5, row: 14 };

/**
 * Coins de dispersion. Chaque fantôme a le sien : c'est ce qui les disperse
 * aux quatre angles pendant les phases de repli, au lieu de les voir tous
 * coller à Pac-Man.
 */
export const SCATTER_CORNERS = {
  blinky: { col: 25, row: -2 },
  pinky: { col: 2, row: -2 },
  inky: { col: 27, row: 31 },
  clyde: { col: 0, row: 31 },
} as const;

/**
 * Le tunnel déborde de deux cases de chaque côté, hors de l'écran : c'est là
 * que se fait la téléportation, invisible pour le joueur. `-2` et `28` sont
 * les deux bouts recousus l'un à l'autre.
 */
export const TUNNEL_MIN = -2;
export const TUNNEL_MAX = 28;
/** Décalage à appliquer pour passer d'un bout du tunnel à l'autre. */
export const TUNNEL_SPAN = TUNNEL_MAX - TUNNEL_MIN;

export type TileKind = 'wall' | 'door' | 'open';

export function tileAt(colIn: number, rowIn: number): TileKind {
  // Les appelants passent des coordonnées de CASE. On arrondit quand même :
  // une position à cheval sur deux cases arriverait sinon ici sous forme
  // fractionnaire et ferait sortir un `undefined` de la grille.
  const col = Math.round(colIn);
  const row = Math.round(rowIn);
  if (row < 0 || row >= ROWS) return 'wall';
  if (col < 0 || col >= COLS) {
    // Hors des bords : seul le tunnel se prolonge, et seulement jusqu'au raccord.
    return row === TUNNEL_ROW && col >= TUNNEL_MIN && col <= TUNNEL_MAX ? 'open' : 'wall';
  }
  const c = MAZE[row][col];
  if (c === '#') return 'wall';
  if (c === '-') return 'door';
  return 'open';
}

/**
 * La porte de la maison n'est PAS un couloir : ni Pac-Man ni un fantôme lancé
 * ne la traversent. Les entrées et sorties de la maison sont jouées par un
 * trajet scripté, qui court-circuite ce test.
 */
export const isWalkable = (col: number, row: number): boolean => tileAt(col, row) === 'open';

/** Recoud les deux bouts du tunnel. À appeler après chaque déplacement. */
export function wrapTunnel(pos: { col: number; row: number }): void {
  if (pos.row !== TUNNEL_ROW) return;
  if (pos.col <= TUNNEL_MIN + 0.01) pos.col += TUNNEL_SPAN;
  else if (pos.col >= TUNNEL_MAX - 0.01) pos.col -= TUNNEL_SPAN;
}
