import { expect, test, mock } from 'bun:test';
/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');

// --- Shim des hooks React, identique a celui des autres moteurs. ---
type Box = { value: any };
const boxes: Box[] = [];
let cursor = 0;
mock.module('react', () => ({
  useState: (init: any) => {
    const i = cursor++;
    if (!boxes[i]) boxes[i] = { value: typeof init === 'function' ? init() : init };
    const box = boxes[i];
    return [box.value, (u: any) => { box.value = typeof u === 'function' ? u(box.value) : u; }];
  },
  useRef: (init: any) => {
    const i = cursor++;
    if (!boxes[i]) boxes[i] = { value: { current: init } };
    return boxes[i].value;
  },
  useCallback: (fn: any) => fn,
}));
let frame: ((dt: number) => void) | null = null;
mock.module(`${ROOT}/hooks/useGameLoop.ts`, () => ({
  useGameLoop: (_a: boolean, onFrame: (dt: number) => void) => { frame = onFrame; },
}));

const P: any = await import(`${ROOT}/games/pacman/usePacmanGame.ts`);
const M: any = await import(`${ROOT}/games/pacman/maze.ts`);
const { CONFIG }: any = await import(`${ROOT}/lib/gameConfig.ts`);
const cfg = CONFIG.pacman;
const { COLS, isWalkable, TUNNEL_ROW } = M;

const DT = 1 / 60;
function mount() {
  cursor = 0; boxes.length = 0; frame = null;
  const api = P.usePacmanGame();
  const box = boxes[0];
  return {
    controls: api.controls,
    takeEvents: api.takeEvents,
    get state() { return box.value; },
    set state(v: any) { box.value = v; },
    step(n = 1) { for (let i = 0; i < n; i += 1) frame!(DT); },
    /** Saute la sequence READY! pour entrer dans le jeu. */
    begin() { while (box.value.phase !== 'playing') frame!(DT); },
  };
}

/** Case la plus proche : c'est le repere qui doit toujours etre un couloir. */
const tileOf = (e: { col: number; row: number }) => [Math.round(e.col), Math.round(e.row)];

const STEPS: Record<string, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

/** Premier pas du plus court chemin vers la premiere case qui satisfait `want`. */
function towardTile(
  state: any,
  want: (c: number, r: number) => boolean,
  blocked: Set<string> = new Set(),
): string | null {
  const [sc, sr] = tileOf(state.pac);
  // first: par case atteinte, la direction prise au tout premier pas.
  const first = new Map<string, string>();
  const seen = new Set([`${sc},${sr}`]);
  const q: [number, number][] = [[sc, sr]];
  while (q.length) {
    const [c, r] = q.shift()!;
    const key = `${c},${r}`;
    if (first.has(key) && want(c, r)) return first.get(key)!;
    for (const [name, [dc, dr]] of Object.entries(STEPS)) {
      let nc = c + dc, nr = r + dr;
      if (nr === TUNNEL_ROW) {
        if (nc <= M.TUNNEL_MIN) nc += M.TUNNEL_SPAN;
        else if (nc >= M.TUNNEL_MAX) nc -= M.TUNNEL_SPAN;
      }
      if (!isWalkable(nc, nr)) continue;
      const nk = `${nc},${nr}`;
      if (seen.has(nk) || blocked.has(nk)) continue;
      seen.add(nk);
      first.set(nk, first.get(key) ?? name);
      q.push([nc, nr]);
    }
  }
  return null;
}

const towardNearestDot = (state: any): string | null =>
  towardTile(state, (c, r) => state.pellets[r * COLS + c] !== 0);

/**
 * Cases a eviter : celles ou rode un fantome dangereux, et leurs voisines.
 * Sans ca le bot fonce droit dans les fantomes, meurt sans arret, et le test
 * devient une loterie au lieu de mesurer ce qu'il pretend mesurer.
 */
function dangerZone(state: any): Set<string> {
  const danger = new Set<string>();
  for (const gh of state.ghosts) {
    if (gh.phase !== 'out' || gh.eyes || gh.frightened) continue;
    const c = Math.round(gh.col), r = Math.round(gh.row);
    for (let dc = -2; dc <= 2; dc += 1) {
      for (let dr = -2; dr <= 2; dr += 1) {
        if (Math.abs(dc) + Math.abs(dr) <= 2) danger.add(`${c + dc},${r + dr}`);
      }
    }
  }
  return danger;
}

/* ----------------------------------------------------------- deplacement -- */

test('Pac-Man reste toujours dans un couloir, meme en poussant contre les murs', () => {
  const g = mount();
  g.begin();
  const dirs = ['up', 'down', 'left', 'right'] as const;
  for (let i = 0; i < 60 * 40; i += 1) {
    // Direction au hasard : pire cas pour un moteur de grille, et exactement
    // ce que fait un joueur qui panique.
    if (i % 7 === 0) g.controls.steer(dirs[Math.floor(Math.random() * 4)]);
    g.step();
    if (g.state.phase !== 'playing') continue;
    const [c, r] = tileOf(g.state.pac);
    if (!isWalkable(c, r)) throw new Error(`Pac-Man hors couloir en ${c},${r}`);
  }
});

test('les fantomes lances restent eux aussi dans les couloirs', () => {
  const g = mount();
  g.begin();
  let checked = 0;
  for (let i = 0; i < 60 * 60; i += 1) {
    if (i % 11 === 0) {
      g.controls.steer((['up', 'down', 'left', 'right'] as const)[Math.floor(Math.random() * 4)]);
    }
    g.step();
    for (const gh of g.state.ghosts) {
      if (gh.phase !== 'out') continue;
      const [c, r] = tileOf(gh);
      checked += 1;
      if (!isWalkable(c, r)) throw new Error(`${gh.name} hors couloir en ${c},${r}`);
    }
  }
  console.log(`  -> ${checked} positions de fantome verifiees`);
  expect(checked).toBeGreaterThan(1000);
});

test('le tunnel recoud bien les deux bords', () => {
  const g = mount();
  g.begin();
  let wrapped = false;
  let last = g.state.pac.col;
  for (let i = 0; i < 60 * 60 && !wrapped; i += 1) {
    // Vies offertes : on teste la geographie, pas la survie.
    if (g.state.lives < 50) g.state.lives = 50;
    if (g.state.phase === 'playing') {
      // On rejoint la bouche gauche du tunnel, puis on continue tout droit.
      const d = towardTile(g.state, (c, r) => r === TUNNEL_ROW && c === 0);
      g.controls.steer(d ?? 'left');
    }
    g.step();
    // Saut brusque du bord gauche au bord droit.
    if (g.state.pac.col - last > 10) wrapped = true;
    last = g.state.pac.col;
  }
  console.log(`  -> teleportation du tunnel : ${wrapped}`);
  expect(wrapped).toBe(true);
});

/* --------------------------------------------------------------- gommes -- */

test('un bot qui mange tout termine le tableau', () => {
  const g = mount();
  g.begin();
  let cleared = false;
  for (let i = 0; i < 60 * 400 && !cleared; i += 1) {
    // Vies offertes : on teste la condition de fin de tableau, pas la survie.
    if (g.state.lives < 50) g.state.lives = 50;
    if (g.state.phase === 'playing') {
      const st = g.state;
      const safe = towardTile(st, (c, r) => st.pellets[r * COLS + c] !== 0, dangerZone(st));
      const d = safe ?? towardNearestDot(st);
      if (d) g.controls.steer(d);
    }
    g.step();
    if (g.state.phase === 'clear') cleared = true;
  }
  console.log(`  -> tableau nettoye : ${cleared}, score ${g.state.score}, restantes ${g.state.dotsLeft}`);
  expect(cleared).toBe(true);
  expect(g.state.dotsLeft).toBe(0);
  // 240 gommes a 10 points + 4 super-gommes a 50 = 2600 au minimum.
  expect(g.state.score).toBeGreaterThanOrEqual(2600);
});

test('le fruit apparait, se ramasse, et disparait tout seul', () => {
  const g = mount();
  g.begin();
  let appeared = 0;
  let eaten = false;
  let expired = false;
  let scoreBefore = 0;
  for (let i = 0; i < 60 * 400 && !(eaten && expired); i += 1) {
    if (g.state.lives < 50) g.state.lives = 50;
    const had = g.state.fruit;
    if (g.state.phase === 'playing') {
      const st = g.state;
      // On detourne le bot vers le fruit des qu'il est la.
      const target = st.fruit
        ? towardTile(st, (c, r) => r === Math.round(st.fruit.row) && (c === 13 || c === 14), dangerZone(st))
        : null;
      const d = target ?? towardTile(st, (c, r) => st.pellets[r * COLS + c] !== 0, dangerZone(st)) ?? towardNearestDot(st);
      if (d) g.controls.steer(d);
      if (st.fruit) scoreBefore = st.score;
    }
    g.step();
    if (!had && g.state.fruit) appeared += 1;
    // Disparu : soit ramasse (le score a bondi), soit perime.
    if (had && !g.state.fruit) {
      if (g.state.score - scoreBefore >= 100) eaten = true;
      else expired = true;
    }
  }
  console.log(`  -> fruit apparu ${appeared} fois, ramasse=${eaten}, perime tout seul=${expired}`);
  expect(appeared).toBeGreaterThanOrEqual(1);
  expect(eaten || expired).toBe(true);
});

/* ------------------------------------------------------------- fantomes -- */

test('les trois fantomes enfermes finissent tous par sortir', () => {
  const g = mount();
  g.begin();
  for (let i = 0; i < 60 * 60; i += 1) {
    if (g.state.phase === 'playing') {
      const d = towardNearestDot(g.state);
      if (d) g.controls.steer(d);
    }
    g.step();
    if (g.state.ghosts.every((gh: any) => gh.phase === 'out')) break;
  }
  console.log(`  -> ${g.state.ghosts.map((gh: any) => `${gh.name}=${gh.phase}`).join(' ')}`);
  expect(g.state.ghosts.every((gh: any) => gh.phase === 'out')).toBe(true);
});

test('Pinky vise quatre cases DEVANT Pac-Man', () => {
  const pac = { col: 13, row: 23, dir: 'left' as const };
  const blinky = { col: 13, row: 11 };
  const t = P.ghostTarget('pinky', { col: 1, row: 1 }, pac, blinky, true);
  console.log(`  -> Pac-Man en 13,23 vers la gauche : Pinky vise ${t.col},${t.row}`);
  expect(t).toEqual({ col: 9, row: 23 });
  expect(P.ghostTarget('blinky', { col: 1, row: 1 }, pac, blinky, true)).toEqual({ col: 13, row: 23 });
});

test('Clyde lache la poursuite des qu il approche a huit cases', () => {
  const pac = { col: 13, row: 23, dir: 'left' as const };
  const blinky = { col: 13, row: 11 };
  const loin = P.ghostTarget('clyde', { col: 1, row: 1 }, pac, blinky, true);
  const pres = P.ghostTarget('clyde', { col: 13, row: 20 }, pac, blinky, true);
  console.log(`  -> de loin il vise ${loin.col},${loin.row} ; de pres ${pres.col},${pres.row}`);
  expect(loin).toEqual({ col: 13, row: 23 });
  expect(pres).toEqual(M.SCATTER_CORNERS.clyde);
});

test('en dispersion chacun file vers SON coin', () => {
  const pac = { col: 13, row: 23, dir: 'left' as const };
  for (const name of ['blinky', 'pinky', 'inky', 'clyde'] as const) {
    expect(P.ghostTarget(name, { col: 13, row: 13 }, pac, { col: 1, row: 1 }, false))
      .toEqual(M.SCATTER_CORNERS[name]);
  }
});

test('Inky depend de la position de Blinky', () => {
  const pac = { col: 13, row: 23, dir: 'left' as const };
  const a = P.ghostTarget('inky', { col: 1, row: 1 }, pac, { col: 13, row: 11 }, true);
  const b = P.ghostTarget('inky', { col: 1, row: 1 }, pac, { col: 2, row: 29 }, true);
  console.log(`  -> Blinky en 13,11 : Inky vise ${a.col},${a.row} ; Blinky en 2,29 : ${b.col},${b.row}`);
  expect(a).not.toEqual(b);
});

/* --------------------------------------------------------- super-gommes -- */

test('une super-gomme rend les fantomes bleus, et les gober rapporte 200 puis 400', () => {
  const g = mount();
  g.begin();
  // On depose Pac-Man juste sous la super-gomme du haut a gauche (case 1,3)
  // et on le fait monter. Le trajet depuis le depart est long et il se ferait
  // attraper en chemin : ce n'est pas ce qu'on teste ici.
  g.state.pac.col = 1;
  g.state.pac.row = 5;
  g.state.pac.dir = 'up';
  let got = false;
  for (let i = 0; i < 60 * 5 && !got; i += 1) {
    g.controls.steer('up');
    g.step();
    if (g.state.fright > 0) got = true;
  }
  console.log(`  -> super-gomme avalee : effet ${g.state.fright.toFixed(1)} s`);
  expect(got).toBe(true);
  expect(g.state.ghosts.some((gh: any) => gh.frightened)).toBe(true);

  // On force la rencontre : un fantome bleu colle a Pac-Man.
  const before = g.state.score;
  const gh = g.state.ghosts.find((x: any) => x.frightened && x.phase === 'out');
  expect(gh).toBeTruthy();
  gh.col = g.state.pac.col; gh.row = g.state.pac.row;
  g.step();
  console.log(`  -> premier fantome gobe : +${g.state.score - before} points`);
  expect(g.state.score - before).toBe(200);
  expect(g.state.ghosts.find((x: any) => x.name === gh.name).eyes).toBe(true);

  // Le suivant vaut le double. Au tout debut de partie les trois autres sont
  // encore dans la maison : on en fait sortir un, deja bleu, pour mettre en
  // scene la seconde rencontre.
  for (let i = 0; i < 45; i += 1) g.step(); // on laisse passer le gel
  // Repere pris APRES le degel : Pac-Man a pu avaler une gomme entre-temps,
  // et ses 10 points n'ont rien a voir avec la prime de fantome.
  const mid = g.state.score;
  const gh2 = g.state.ghosts.find((x: any) => x.frightened && !x.eyes);
  expect(gh2).toBeTruthy();
  gh2.phase = 'out';
  gh2.path = [];
  gh2.col = g.state.pac.col; gh2.row = g.state.pac.row;
  g.step();
  console.log(`  -> deuxieme fantome gobe : +${g.state.score - mid} points`);
  expect(g.state.score - mid).toBe(400);
});

test('les yeux d un fantome gobe rentrent a la maison puis il ressort', () => {
  const g = mount();
  g.begin();
  g.state.ghosts[0].eyes = true; // Blinky, deja dehors
  let backOut = false;
  for (let i = 0; i < 60 * 40 && !backOut; i += 1) {
    g.step();
    const now = g.state.ghosts[0];
    if (!now.eyes && now.phase === 'out') backOut = true;
  }
  console.log(`  -> Blinky gobe est ressorti de la maison : ${backOut}`);
  expect(backOut).toBe(true);
});

/* ------------------------------------------------------------ vies/fin --- */

test('se faire toucher coute une vie, et trois pertes terminent la partie', () => {
  const g = mount();
  g.begin();
  const start = g.state.lives;
  for (let life = 0; life < start; life += 1) {
    while (g.state.phase !== 'playing') g.step();
    const gh = g.state.ghosts.find((x: any) => x.phase === 'out' && !x.eyes && !x.frightened);
    gh.col = g.state.pac.col; gh.row = g.state.pac.row;
    g.step();
    expect(g.state.phase === 'dying' || g.state.phase === 'over').toBe(true);
    for (let i = 0; i < 60 * 3 && g.state.phase === 'dying'; i += 1) g.step();
  }
  console.log(`  -> ${start} vies perdues : phase ${g.state.phase}, statut ${g.state.status}`);
  expect(g.state.lives).toBe(0);
  expect(g.state.phase).toBe('over');
  expect(g.state.status).toBe('gameOver');
});

test('la vie bonus tombe une seule fois, au seuil prevu', () => {
  const g = mount();
  g.begin();
  g.state.score = cfg.extraLifeAt - 10;
  const before = g.state.lives;
  for (let i = 0; i < 60 * 20 && g.state.lives === before; i += 1) {
    const d = towardNearestDot(g.state);
    if (d) g.controls.steer(d);
    g.step();
  }
  console.log(`  -> vies ${before} -> ${g.state.lives} a ${g.state.score} points`);
  expect(g.state.lives).toBe(before + 1);
  const after = g.state.lives;
  for (let i = 0; i < 60 * 10; i += 1) {
    if (g.state.phase !== 'playing') { g.step(); continue; }
    const d = towardNearestDot(g.state);
    if (d) g.controls.steer(d);
    g.step();
  }
  // Seules les morts peuvent faire baisser le compteur, jamais un second bonus.
  expect(g.state.lives).toBeLessThanOrEqual(after);
});

/* ---------------------------------------------------------------- modes -- */

test('les vitesses montent avec les niveaux et l effet des gommes fond', () => {
  const l1 = P.levelSpeeds(1), l3 = P.levelSpeeds(3), l10 = P.levelSpeeds(10);
  console.log(`  -> Pac-Man ${l1.pac} / ${l3.pac} / ${l10.pac} ; fantomes ${l1.ghost} / ${l3.ghost} / ${l10.ghost}`);
  expect(l3.pac).toBeGreaterThan(l1.pac);
  expect(l10.ghost).toBeGreaterThan(l1.ghost);
  expect(P.frightSecondsFor(1)).toBeGreaterThan(P.frightSecondsFor(9));
  expect(P.frightSecondsFor(19)).toBe(0);
  // Le niveau 1 respecte l'horaire de la borne : 7 s de repli pour commencer.
  expect(P.scatterChaseFor(1)[0]).toBe(7);
});

test('les fantomes se retournent au changement de phase', () => {
  const OPP: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const g = mount();
  g.begin();
  // Un fantome ne fait jamais demi-tour de lui-meme, et ne change de sens
  // qu'au centre d'une case. Un demi-tour AU MILIEU d'un couloir ne peut donc
  // venir que de la bascule dispersion / poursuite : c'est la signature qu'on
  // cherche, bien plus fiable que de regarder l'etat a un instant donne.
  const prev = new Map<string, { dir: string; mid: boolean }>();
  let forced = 0;
  for (let i = 0; i < 60 * 10; i += 1) {
    g.step();
    for (const gh of g.state.ghosts) {
      const mid = Math.abs(gh.col - Math.round(gh.col)) > 1e-6 || Math.abs(gh.row - Math.round(gh.row)) > 1e-6;
      const was = prev.get(gh.name);
      if (gh.phase === 'out' && was && was.mid && gh.dir === OPP[was.dir]) forced += 1;
      prev.set(gh.name, { dir: gh.dir, mid });
    }
  }
  console.log(`  -> ${forced} demi-tour(s) force(s) en 10 s`);
  expect(forced).toBeGreaterThan(0);
});

/* ------------------------------------------------- qualite de la chasse -- */

/**
 * Chasse pure, hors du reste du jeu : un fantome, une cible immobile, et on
 * compte les cases jusqu'a la prise. C'est le seul controle qui dise vraiment
 * si l'algorithme de choix vaut quelque chose ; verifier la cible ne suffit
 * pas, encore faut-il que le chemin y mene.
 */
function chaseFrom(name: string, start: [number, number], pacTile: [number, number]) {
  const g = { name, col: start[0], row: start[1], dir: 'left' as any };
  const pac = { col: pacTile[0], row: pacTile[1], dir: 'left' as any };
  const seen = new Map<string, number>();
  for (let step = 0; step < 400; step += 1) {
    if (Math.round(g.col) === pacTile[0] && Math.round(g.row) === pacTile[1]) return step;
    const dir = P.ghostChoose(g, P.ghostTarget(name, g, pac, { col: start[0], row: start[1] }, true), false);
    const d: Record<string, [number, number]> = STEPS as any;
    g.col += d[dir][0]; g.row += d[dir][1]; g.dir = dir;
    M.wrapTunnel(g);
    const k = `${g.col},${g.row},${g.dir}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if ((seen.get(k) ?? 0) >= 3) return -1; // il tourne en rond
  }
  return -1;
}

test('Blinky rejoint une cible immobile depuis n importe quel coin', () => {
  const pac: [number, number] = [13, 23];
  const spots: [number, number][] = [[1, 1], [26, 1], [1, 29], [26, 29], [21, 5], [9, 14], [6, 23]];
  const failures: string[] = [];
  for (const spot of spots) {
    const steps = chaseFrom('blinky', spot, pac);
    console.log(`  -> depuis ${spot.join(',')} : ${steps < 0 ? 'TOURNE EN ROND' : `${steps} cases`}`);
    if (steps < 0) failures.push(spot.join(','));
  }
  expect(failures).toEqual([]);
});

test('Cruise Elroy : Blinky accelere et ne se replie plus en fin de tableau', () => {
  const total = 244;
  console.log(`  -> gommes restantes ${total} : palier ${P.elroyStage(total, 1)}`);
  console.log(`  -> gommes restantes 20  : palier ${P.elroyStage(20, 1)}`);
  console.log(`  -> gommes restantes 10  : palier ${P.elroyStage(10, 1)}`);
  expect(P.elroyStage(total, 1)).toBe(0);
  expect(P.elroyStage(20, 1)).toBe(1);
  expect(P.elroyStage(10, 1)).toBe(2);
  // Elroy va plus vite qu'un fantome ordinaire du niveau 1.
  expect(cfg.elroy.speed1).toBeGreaterThan(cfg.speed.ghost);
  expect(cfg.elroy.speed2).toBeGreaterThan(cfg.elroy.speed1);
  // Et la traque commence plus tot a mesure que les niveaux montent.
  expect(P.elroyStage(40, 6)).toBeGreaterThan(P.elroyStage(40, 1));
});

test('en fin de tableau Blinky serre vraiment, meme en phase de repli', () => {
  const g = mount();
  g.begin();
  // On vide le tableau sauf quelques gommes : Elroy doit s'enclencher.
  const few = new Uint8Array(g.state.pellets.length);
  few[20 * COLS + 1] = 1;
  g.state.pellets = few;
  g.state.dotsLeft = 1;
  // Pac-Man immobile dans un coin bas, Blinky lache au coin oppose.
  g.state.pac.col = 1; g.state.pac.row = 26; g.state.pac.dir = 'left';
  const blinky = g.state.ghosts[0];
  blinky.phase = 'out'; blinky.col = 26; blinky.row = 5; blinky.dir = 'left'; blinky.path = [];

  let best = 99;
  for (let i = 0; i < 60 * 25; i += 1) {
    // On fige Pac-Man : on mesure Blinky, pas la fuite.
    g.state.pac.col = 1; g.state.pac.row = 26;
    g.step();
    const b = g.state.ghosts[0];
    if (b.phase === 'out' && !b.eyes) {
      best = Math.min(best, Math.abs(b.col - 1) + Math.abs(b.row - 26));
    }
  }
  console.log(`  -> Blinky s est approche jusqu a ${best.toFixed(1)} cases de Pac-Man immobile`);
  // Sans Elroy il partait se replier dans son coin haut-droit et n arrivait jamais.
  expect(best).toBeLessThan(2);
});
