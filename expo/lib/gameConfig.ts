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
    /**
     * La soucoupe arrive sur un minuteur qui se raccourcit au fil des niveaux,
     * comme sur la borne — et non après un quota d'astéroïdes détruits.
     */
    saucerDelay: 18,
    saucerDelayPerLevel: 1.5,
    saucerDelayMin: 8,
    /** Au-delà de ce score, la petite soucoupe tire beaucoup plus juste. */
    saucerAccurateScore: 35000,
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
    maxEnemyBullets: 3,
    bunkerRows: 3,
    bunkerCols: 7,
    bunkerCount: 4,
    /**
     * Le score de la soucoupe suit une séquence indexée sur le nombre de tirs
     * du joueur depuis le début de la vague : c'est ce qui rend la soucoupe à
     * 300 points atteignable au 23e tir puis tous les 15.
     */
    /**
     * Cadence et pas de la formation, repris de la borne Taito et convertis à
     * notre terrain (360x560 contre 224x256 à l'origine).
     *
     * La borne redessine UN envahisseur par frame : la formation avance donc
     * d'un pas tous les `vivants / 60` secondes, ce qui la fait accélérer
     * toute seule à mesure qu'ils meurent. C'est cette règle-là qui donne son
     * rythme au jeu, pas une courbe de difficulté arbitraire.
     */
    stepX: 3.2,
    /** La borne accorde 3 px vers la droite (et non 2) au dernier survivant. */
    lastInvaderStepRight: 4.8,
    stepDown: 17.5,
    stepIntervalMin: 1 / 60,
    /**
     * Chaque vague démarre plus bas, comme sur la borne — c'est ainsi que la
     * difficulté monte, et non en accélérant la formation.
     */
    waveStartDrop: 17.5,
    waveStartDropMax: 4,
    /**
     * Score de la soucoupe, indexé sur le nombre de tirs du joueur depuis le
     * début de la vague. La borne stocke 16 valeurs mais reboucle après la
     * 15e, la dernière n'étant jamais lue : le cycle est donc de 15. Le 300
     * est à l'indice 8, ce qui le place sur le 23e tir (8 + 15) puis tous les
     * 15 — la fameuse astuce du tir compté.
     */
    ufoPoints: [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100],
    /** La borne fait passer une soucoupe toutes les 25,6 s. */
    ufoEvery: 25.6,
    /** Plus aucune soucoupe quand il reste 7 envahisseurs ou moins. */
    ufoMinInvaders: 8,
    /** Vie bonus unique, au premier passage de ce score. */
    bonusLifeAt: 1500,
    /** Invincibilité après avoir perdu une vie (secondes). */
    respawnInvincible: 1.5,
  },
} as const;

export type GameStatus = 'running' | 'paused' | 'gameOver';
