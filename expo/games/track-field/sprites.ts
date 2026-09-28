import { Bitmap } from '../../lib/pixelArt';

/**
 * L'athlète, de profil. Deux images de course alternées par la foulée, une
 * pose de saut, et le javelot. Même grammaire que les sprites de Space
 * Invaders : une grille de texte, un seul tracé SVG au rendu.
 */

/** Foulée ouverte : bras et jambes opposés, membres rattachés au corps. */
const RUN_A: Bitmap = [
  '..XXX...',
  '.XXXXX..',
  '.XXXXX..',
  '..XXX...',
  'XXXXXX..',
  '.XXXXXX.',
  '.XXXXX..',
  '..XXXX..',
  '..XX.XX.',
  '.XX...XX',
  'XX.....X',
  'X.......',
];

/** Foulée fermée : appui au sol, bras ramenés. */
const RUN_B: Bitmap = [
  '..XXX...',
  '.XXXXX..',
  '.XXXXX..',
  '..XXX...',
  '..XXXXXX',
  '.XXXXXX.',
  '..XXXX..',
  '..XXXX..',
  '..XXXX..',
  '..XX.XX.',
  '.XX...XX',
  '.X.....X',
];

/** En l'air : corps groupé, jambes tendues vers l'avant. */
const JUMP: Bitmap = [
  '..XXX...',
  '.XXXXX..',
  '.XXXXX..',
  '..XXX...',
  'XXXXXX..',
  '.XXXXXX.',
  '.XXXXXX.',
  '..XXXXXX',
  '..XX..XX',
  '.XX...XX',
  'XX......',
  'X.......',
];

/** Le javelot en vol, incliné : un simple trait effilé. */
export const JAVELIN: Bitmap = [
  '......XX',
  '.....XX.',
  '....XX..',
  '...XX...',
  '..XX....',
  '.XX.....',
  'XX......',
];

export const RUN_FRAMES: readonly Bitmap[] = [RUN_A, RUN_B];
export const ATHLETE_JUMP = JUMP;
