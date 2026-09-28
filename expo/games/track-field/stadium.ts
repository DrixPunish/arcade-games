/**
 * Géométrie et couleurs du stade.
 *
 * Isolé de l'écran pour être importable sans React Native : c'est ce qui
 * permet d'en tirer un aperçu PNG et de JUGER le rendu au lieu de le supposer.
 */

/** Terrain logique : 360 de large, la piste occupe le bas. */
export const W = 360;
export const H = 190;
export const SKY = 0;
export const CROWD_TOP = 38;
export const WALL_TOP = 88;
export const TRACK_TOP = 96;
/** Ligne sur laquelle court l'athlète. */
export const GROUND = 152;
export const PX_PER_M = 9;
export const ATHLETE_PIXEL = 4;

/** Repères tous les 10 m, calculés une seule fois. */
export const MARKERS = Array.from({ length: 26 }, (_, i) => i * 10);

/**
 * Gradins : un motif figé, sans parallaxe. Des spectateurs lointains ne
 * bougent pas à l'œil, et les garder immobiles évite de recalculer quarante
 * rectangles à chaque image.
 */
export const CROWD = Array.from({ length: 160 }, (_, i) => {
  // Suite déterministe : même tribune à chaque partie, sans Math.random.
  const h = (i * 2654435761) % 1000;
  return {
    x: (i % 40) * 9.1 + ((h % 3) - 1),
    y: CROWD_TOP + 3 + Math.floor(i / 40) * 11 + (h % 4),
    color: ['#4a6a9e', '#7b8fb8', '#d97f5c', '#5f4a7a', '#3c5party'][h % 5]
      .replace('3c5party', '3c527a'),
  };
});

/** Deux mâts d'éclairage : le ciel avait l'air vide sans eux. */
export const FLOODLIGHTS = [168, 300].map((x) => ({ x, y: 6 }));

/** Lignes de couloir de la piste. */
export const LANES = [TRACK_TOP + 18, GROUND, GROUND + 22];


/** Couleurs du décor, partagées par le rendu et l'aperçu. */
export const COLORS = {
  sky: '#0b1b35',
  stand: '#16243d',
  wall: '#7a8ba8',
  track: '#b4542f',
  lane: 'rgba(255,255,255,0.45)',
  sand: '#d9c08a',
  board: '#ff4778',
  marker: 'rgba(255,255,255,0.55)',
  markerLong: '#ffe083',
  athlete: '#eaffff',
  mast: '#2b3f63',
  lamp: '#fff3c4',
  hurdle: '#eaffff',
  hurdleDown: '#8a6a55',
};
