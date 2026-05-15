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
    extraLifeEvery: 10000,
    largeSaucerLargeAsteroids: 12,
    asteroidSpawnSafeRadius: 120,
    deathAnimation: 0.85,
    finalDeathAnimation: 1.35,
    respawnInvincible: 2,
  },
  invaders: {
    rows: 5,
    cols: 11,
    playerSpeed: 270,
    bulletSpeed: 430,
    enemyBulletSpeed: 210,
    maxEnemyBullets: 4,
    bunkerRows: 3,
    bunkerCols: 7,
    bunkerCount: 4,
    ufoPoints: 100,
  },
} as const;

export type GameStatus = 'running' | 'paused' | 'gameOver';
