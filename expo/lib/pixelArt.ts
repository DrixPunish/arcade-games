/**
 * Petit moteur de pixel art partagé par les jeux et par le menu.
 *
 * Un sprite est une grille de texte (`X` = pixel plein). `spritePath()` la
 * convertit en UN SEUL tracé SVG, en fusionnant les pixels voisins d'une même
 * ligne : un sprite coûte un `<Path>`, jamais un nœud par pixel — indispensable
 * dès qu'on en affiche des dizaines à 60 images par seconde.
 */

export type Bitmap = readonly string[];

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
