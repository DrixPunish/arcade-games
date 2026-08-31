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
     * Le canon démarre lentement puis accélère tant qu'on maintient la flèche.
     * Une tape brève ne doit décaler que de quelques unités — la largeur d'un
     * envahisseur est de 18 et les colonnes sont espacées de 24, donc à vitesse
     * constante il était impossible de s'aligner. Maintenu, on retrouve une
     * vitesse de traversée normale.
     */
    playerSpeedStart: 70,
    playerSpeed: 240,
    /** Secondes de maintien pour passer de playerSpeedStart à playerSpeed. */
    playerAccelTime: 0.5,
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
