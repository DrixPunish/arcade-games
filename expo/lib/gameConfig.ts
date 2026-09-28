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
    /**
     * Longueur du saut de haies, en MÈTRES et non en secondes. Une durée fixe
     * donnait un saut de 1,9 m à faible allure : on retombait sur la haie sans
     * pouvoir rien y faire. En distance, le franchissement vaut à toute vitesse.
     * Les haies sont espacées de 9,14 m, ce qui laisse de quoi se replacer.
     */
    hurdleJumpSpan: 5,
    /** Durée maximale d'un saut, garde-fou si la vitesse tombe très bas. */
    hurdleJumpMaxTime: 1.4,
    /**
     * Ce qu'il reste de vitesse après avoir renversé une haie. Mettre zéro
     * était un mur : on ne repartait plus.
     */
    hurdleHitPenalty: 0.45,
    /** Trois essais aux concours, une seule manche aux courses. */
    fieldAttempts: 3,
  },

  pacman: {
    /**
     * Vitesse de référence de la borne : 75,76 pixels par seconde sur des
     * cases de 8 pixels, soit 9,47 cases par seconde. Tout le reste du jeu
     * s'exprime en POURCENTAGE de cette vitesse, exactement comme dans la
     * table de réglages d'origine.
     */
    baseSpeed: 9.4697,
    /**
     * Les pourcentages du niveau 1. Ils montent avec les niveaux
     * (cf. `levelSpeeds`) : c'est ce qui rend la partie tendue à la longue
     * sans jamais changer le labyrinthe.
     */
    speed: {
      pac: 0.8,
      pacFrightened: 0.9,
      ghost: 0.75,
      ghostFrightened: 0.5,
      /** Les fantômes ralentissent fortement dans le tunnel : on peut y souffler. */
      ghostTunnel: 0.4,
      /** Les yeux rentrent à la maison bien plus vite que le fantôme entier. */
      ghostEyes: 1.9,
    },
    /**
     * Durée de l'effet super-gomme, par niveau (secondes). Elle fond vite :
     * au niveau 19 les fantômes ne deviennent plus bleus du tout.
     */
    frightSeconds: [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1, 0],
    /**
     * Alternance dispersion / poursuite du niveau 1, en secondes. La dernière
     * poursuite ne s'arrête jamais. C'est cette respiration qui rend les
     * fantômes lisibles : ils lâchent périodiquement la traque.
     */
    scatterChase: [7, 20, 7, 20, 5, 20, 5],
    dotPoints: 10,
    powerPoints: 50,
    /** Doublement à chaque fantôme d'une même super-gomme. */
    ghostPoints: [200, 400, 800, 1600],
    /**
     * Nombre de pac-gommes avalées avant que chaque fantôme quitte la maison.
     * Blinky en est déjà sorti au départ.
     */
    releaseDots: { pinky: 0, inky: 30, clyde: 60 },
    /** Au-delà, un fantôme resté enfermé sort quand même (secondes). */
    releaseTimeout: 4,
    /** Le fruit apparaît deux fois par niveau, à ces compteurs de gommes. */
    fruitAtDots: [70, 170],
    fruitSeconds: 9.5,
    /** Valeur du fruit selon le niveau, plafonnée à 5000 comme sur la borne. */
    fruitPoints: [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000],
    lives: 3,
    extraLifeAt: 10000,
    /** Écart en cases sous lequel Pac-Man est attrapé. */
    catchDistance: 0.5,
    /** Temporisations d'ambiance : le « READY! », la mort, le tableau fini. */
    readySeconds: 2,
    dyingSeconds: 1.7,
    clearSeconds: 1.8,
    /** Temps d'arrêt sur image quand un fantôme est gobé. */
    ghostEatenPause: 0.55,
  },
} as const;

export type GameStatus = 'running' | 'paused' | 'gameOver';
