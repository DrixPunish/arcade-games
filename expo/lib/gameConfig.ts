export const CONFIG = {
  initialLives: 3,
  highScoreLimit: 10,
  asteroids: {
    rotationSpeed: 4.2,
    thrust: 250,
    damping: 0.995,
    bulletSpeed: 430,
    maxBullets: 4,
    shipRadius: 12,
    saucerFireEvery: 1.45,
    /** Une vie bonus tous les N points. */
    extraLifeEvery: 10000,
    /** Au-dessus de ce score, les soucoupes qui apparaissent sont les petites (celles qui visent). */
    smallSaucerScore: 10000,
    /** Nombre de gros astéroïdes à détruire avant qu'une soucoupe ne se pointe. */
    largeSaucerLargeAsteroids: 12,
    asteroidSpawnSafeRadius: 120,
    deathAnimation: 0.85,
    finalDeathAnimation: 1.35,
    respawnInvincible: 2,
  },
  invaders: {
    rows: 5,
    cols: 11,
    /**
     * Unités/seconde sur un terrain large de 360. À 270 le canon traversait
     * l'écran en 1,3 s : viser une colonne précise demandait de s'arrêter à
     * deux frames près. À 180 on garde de la réactivité en gagnant en finesse.
     */
    playerSpeed: 180,
    bulletSpeed: 430,
    enemyBulletSpeed: 210,
    maxEnemyBullets: 4,
    bunkerRows: 3,
    bunkerCols: 7,
    bunkerCount: 4,
    ufoPoints: 100,
    /** Invincibilité après avoir perdu une vie (secondes). */
    respawnInvincible: 1.5,
  },
} as const;

export type GameStatus = 'running' | 'paused' | 'gameOver';
