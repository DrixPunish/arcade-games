import { Bitmap } from './pixelArt';
import { CRAB } from '../games/space-invaders/sprites';

/**
 * Vignettes du menu, en pixel art plutôt qu'en icônes génériques : chaque
 * borne se reconnaît à son propre dessin, dans le même style que les sprites
 * des jeux. Space Invaders réutilise directement son crabe.
 */

/** Le vaisseau d'Asteroids : triangle creux, arrière échancré en V. */
const ASTEROIDS_SHIP: Bitmap = [
  '.....XX.....',
  '.....XX.....',
  '....X..X....',
  '....X..X....',
  '...XX..XX...',
  '...X....X...',
  '..XX....XX..',
  '..X......X..',
  '.XX......XX.',
  '.X........X.',
  'XX........XX',
  'XXXX....XXXX',
  'XXX..XX..XXX',
  '......XX....',
];

/** La torche olympique : flamme pleine et penchée, vasque, manche. */
const OLYMPIC_TORCH: Bitmap = [
  '....X....',
  '...XX....',
  '..XXX....',
  '..XXXX...',
  '..XXXXX..',
  '...XXXX..',
  '....XX...',
  '.XXXXXXX.',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '...XXX...',
  '...XXX...',
  '..XXXXX..',
];

/** Pac-Man, bouche ouverte vers la droite. */
const PACMAN: Bitmap = [
  '....XXXXX....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXX...',
  'XXXXXXXXX....',
  'XXXXXXXX.....',
  'XXXXXXX......',
  'XXXXXXXX.....',
  'XXXXXXXXX....',
  'XXXXXXXXXX...',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '....XXXXX....',
];

export type TileArt = { bitmap: Bitmap; color: string };

export const TILE_ART: Record<'asteroids' | 'invaders' | 'olympic' | 'pacman', TileArt> = {
  asteroids: { bitmap: ASTEROIDS_SHIP, color: '#79fbff' },
  invaders: { bitmap: CRAB[0], color: '#ffe083' },
  olympic: { bitmap: OLYMPIC_TORCH, color: '#ff9d5c' },
  pacman: { bitmap: PACMAN, color: '#ffd93d' },
};
