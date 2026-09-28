import { COLS, MAZE, ROWS, tileAt } from './maze';

/**
 * Géométrie du décor, calculée UNE FOIS au chargement du module.
 *
 * Ce fichier n'importe volontairement rien de React Native : le script de
 * prévisualisation en PNG s'en sert tel quel pour vérifier le labyrinthe à
 * l'œil avant qu'il n'arrive sur un téléphone.
 *
 * L'unité de dessin vaut `TILE` pour une case du labyrinthe, comme sur la
 * borne. Travailler directement en cases serait plus court à lire, mais les
 * tracés SVG sont arrondis à deux décimales : des coordonnées de l'ordre de
 * 0,1 y perdraient quelques pour cent, et les sprites se déformeraient.
 */

export const TILE = 8;

type Seg = { a: number; b: number };

/**
 * Le trait des murs suit la frontière mur / couloir. Dessiner un rectangle
 * plein par case donnerait un labyrinthe massif et illisible ; le jeu
 * d'origine ne montre que ces contours.
 */
function buildWallPath(): string {
  const horizontal = new Map<number, Seg[]>();
  const vertical = new Map<number, Seg[]>();

  const push = (map: Map<number, Seg[]>, key: number, a: number): void => {
    const list = map.get(key);
    if (list) list.push({ a, b: a + 1 });
    else map.set(key, [{ a, b: a + 1 }]);
  };

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (tileAt(c, r) !== 'wall') continue;
      // Une arête n'est tracée que si elle donne sur autre chose qu'un mur :
      // les arêtes intérieures d'un bloc de murs restent invisibles.
      if (tileAt(c, r - 1) !== 'wall') push(horizontal, r, c);
      if (tileAt(c, r + 1) !== 'wall') push(horizontal, r + 1, c);
      if (tileAt(c - 1, r) !== 'wall') push(vertical, c, r);
      if (tileAt(c + 1, r) !== 'wall') push(vertical, c + 1, r);
    }
  }

  const parts: string[] = [];
  const emit = (map: Map<number, Seg[]>, horiz: boolean): void => {
    for (const [key, segs] of map) {
      segs.sort((x, y) => x.a - y.a);
      let run = { ...segs[0] };
      for (let i = 1; i <= segs.length; i += 1) {
        // Fusion des segments bout à bout : un long couloir devient un seul
        // trait au lieu de vingt.
        if (i < segs.length && Math.abs(segs[i].a - run.b) < 1e-9) {
          run.b = segs[i].b;
          continue;
        }
        parts.push(
          horiz
            ? `M${run.a * TILE} ${key * TILE}H${run.b * TILE}`
            : `M${key * TILE} ${run.a * TILE}V${run.b * TILE}`,
        );
        if (i < segs.length) run = { ...segs[i] };
      }
    }
  };
  emit(horizontal, true);
  emit(vertical, false);
  return parts.join('');
}

export const WALL_PATH = buildWallPath();

/** Les quatre super-gommes, repérées dans la grille une fois pour toutes. */
export const POWER_PELLETS: readonly { col: number; row: number }[] = (() => {
  const out: { col: number; row: number }[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAZE[r][c] === 'o') out.push({ col: c, row: r });
    }
  }
  return out;
})();

/** La barre rose qui ferme la maison des fantômes. */
export const DOOR = (() => {
  for (let r = 0; r < ROWS; r += 1) {
    const from = MAZE[r].indexOf('-');
    if (from >= 0) return { row: r, from, to: MAZE[r].lastIndexOf('-') + 1 };
  }
  return { row: 0, from: 0, to: 0 };
})();

/**
 * Le tapis de pac-gommes, en un seul tracé. On le recalcule à chaque bouchée,
 * mais jamais à chaque image : à 60 images par seconde, redessiner 240 nœuds
 * SVG en continu était le seul vrai risque de saccade de ce jeu.
 */
export function dotsPath(pellets: Uint8Array, size: number): string {
  const half = size / 2;
  const parts: string[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (pellets[r * COLS + c] !== 1) continue;
      const x = (c + 0.5) * TILE - half;
      const y = (r + 0.5) * TILE - half;
      parts.push(`M${x} ${y}h${size}v${size}h${-size}Z`);
    }
  }
  return parts.join('');
}

/** Dimensions de la scène, dans l'unité de dessin. */
export const VIEW = { width: COLS * TILE, height: ROWS * TILE };
