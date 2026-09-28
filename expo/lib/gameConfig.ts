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
  /**
   * Track & Field (Konami, 1983). Les angles optimaux sont ceux de la borne :
   * 42 degres a la longueur, 43 au javelot. Ils sont sous 45 parce que
   * l'athlete lache le projectile au-dessus du sol — la physique du tir
   * parabolique avec hauteur de lacher les reproduit sans les coder en dur.
   */
  trackField: {
    /** Vitesse maximale atteignable en martelant, en metres par seconde. */
    topSpeed: 11.5,
    /**
     * La vitesse ne vient PAS d'impulsions ajoutées coup par coup : chaque
     * appui produisait un pic aussitôt écrêté par le plafond, si bien que
     * marteler plus vite pouvait donner moins de vitesse. On mesure à la
     * place la CADENCE de martèlement, lissée, et la vitesse converge vers
     * elle.
     *
     * `tapWindow` est la constante de temps de la mesure : à cadence stable,
     * l'accumulateur vaut `appuis_par_seconde x tapWindow`.
     */
    tapWindow: 0.5,
    /** Mètres par seconde gagnés pour chaque appui par seconde. */
    speedPerTap: 1.15,
    /** Vitesse de convergence vers la vitesse visée (par seconde). */
    responsiveness: 4,
    /**
     * Vitesse de balayage de l'angle tant qu'on maintient le bouton (deg/s).
     * À 95 deg/s, atteindre 42 demande 0,44 s, soit environ 5 m parcourus à
     * pleine vitesse : il faut anticiper l'appui sans que la planche arrive
     * trop vite. À 62 la fenêtre était intenable, on mordait presque à coup sûr.
     */
    angleSweep: 95,
    angleMax: 85,
    gravity: 9.81,
    /**
     * Par épreuve : l'angle optimal documenté de la borne, et la part de la
     * vitesse de course réellement transmise au saut ou au projectile (un
     * sauteur en perd, un javelot part bien plus vite que le lanceur).
     * La hauteur de lâcher n'est pas saisie : elle se DÉDUIT de l'angle
     * optimal, ce qui garantit que l'optimum tombe pile sur la valeur voulue.
     */
    events: {
      longJump: { optimalAngle: 42, launchFactor: 0.73 },
      javelin: { optimalAngle: 43, launchFactor: 2.42 },
    },
    /**
     * Minima à franchir pour passer à l'épreuve suivante.
     *
     * Ces valeurs sont MESURÉES, pas devinées : un joueur martelant à 8 appuis
     * par seconde (cadence tout à fait tenable) obtient 11,9 s, 4,80 m, 50,9 m
     * et 13,1 s. Les minima laissent une petite marge sous ces résultats, et
     * un joueur rapide (11 appuis/s) les dépasse largement.
     */
    qualify: {
      dash100: 12.5,
      longJump: 4.3,
      javelin: 46,
      hurdles: 14.5,
    },
    /** Trois essais aux concours, une seule manche aux courses. */
    fieldAttempts: 3,
  },
} as const;

export type GameStatus = 'running' | 'paused' | 'gameOver';
