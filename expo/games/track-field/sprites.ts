import { Bitmap } from '../../lib/pixelArt';

/**
 * L'athlète, de profil. Deux images de course alternées par la foulée, une
 * pose de saut, et le javelot. Même grammaire que les sprites de Space
 * Invaders : une grille de texte, un seul tracé SVG au rendu.
 */

/**
 * Les lettres désignent une teinte : `S` la peau, `J` le maillot, `P` le short.
 * `ATHLETE_PALETTE` fait la correspondance. L'athlète tout blanc manquait de
 * caractère sur la piste ocre.
 */
export const ATHLETE_PALETTE: Record<string, string> = {
  H: '#3a2a20',
  S: '#f2b98d',
  J: '#eaffff',
  P: '#1f4fa8',
};

/** Foulée ouverte : bras et jambes opposés. */
const RUN_A: Bitmap = [
  '..HHH...',
  '.HHHHS..',
  '.HSSSS..',
  '..SSS...',
  'JJJJJJ..',
  '.JJJJJJ.',
  '.JJJJJ..',
  '..PPPP..',
  '..SS.SS.',
  '.SS...SS',
  'SS.....S',
  'S.......',
];

/** Foulée fermée : appui au sol, bras ramenés. */
const RUN_B: Bitmap = [
  '..HHH...',
  '.HHHHS..',
  '.HSSSS..',
  '..SSS...',
  '..JJJJJJ',
  '.JJJJJJ.',
  '..JJJJ..',
  '..PPPP..',
  '..SSSS..',
  '..SS.SS.',
  '.SS...SS',
  '.S.....S',
];

/** En l'air : corps groupé, jambes tendues vers l'avant. */
const JUMP: Bitmap = [
  '..HHH...',
  '.HHHHS..',
  '.HSSSS..',
  '..SSS...',
  'JJJJJJ..',
  '.JJJJJJ.',
  '.JJJJJJ.',
  '..PPPPSS',
  '..SS..SS',
  '.SS...SS',
  'SS......',
  'S.......',
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
