import { expect, test, mock } from 'bun:test';

/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');

// --- Shim minimal des hooks React : les moteurs n'utilisent que la forme
// fonctionnelle de setState, donc une boite mutable suffit. ---
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
  useGameLoop: (_active: boolean, onFrame: (dt: number) => void) => { frame = onFrame; },
}));

const { useAsteroidsGame } = await import(`${ROOT}/games/asteroids/useAsteroidsGame.ts`);
const { useSpaceInvadersGame } = await import(`${ROOT}/games/space-invaders/useSpaceInvadersGame.ts`);

const DT = 1 / 60;

function mount(hook: () => any) {
  cursor = 0;
  boxes.length = 0;
  frame = null;
  const api = hook();
  const stateBox = boxes[0];
  return {
    controls: api.controls,
    get state() { return stateBox.value; },
    step(frames: number, onFrame?: (s: any) => void) {
      for (let i = 0; i < frames; i += 1) {
        frame!(DT);
        onFrame?.(stateBox.value);
      }
    },
  };
}

test('asteroids: 60s de jeu sans crash, etat coherent', () => {
  const g = mount(useAsteroidsGame);
  g.step(3600, (s) => {
    expect(Number.isFinite(s.ship.x) && Number.isFinite(s.ship.y)).toBe(true);
    expect(s.ship.x >= 0 && s.ship.x < 360).toBe(true);
    expect(s.ship.y >= 0 && s.ship.y < 560).toBe(true);
    for (const a of s.asteroids) {
      expect(a.x >= 0 && a.x < 360 && a.y >= 0 && a.y < 560).toBe(true);
    }
  });
});

test('asteroids: une soucoupe finit toujours par sortir du terrain', () => {
  const g = mount(useAsteroidsGame);
  // On tire jusqu'a detruire assez de gros asteroides pour declencher une soucoupe.
  let seen = false;
  for (let i = 0; i < 12000 && !seen; i += 1) {
    g.controls.rotateLeft(i % 120 < 60);
    g.controls.fire();
    g.step(1);
    if (g.state.saucers.length > 0) seen = true;
  }
  if (!seen) return; // pas de soucoupe sur cette graine, rien a verifier
  const bornOn = g.state.saucers[0].id;
  let framesAlive = 0;
  // La partie peut se terminer pendant la traversee : la boucle de jeu se fige
  // alors, ce qui n'a rien a voir avec le bug qu'on teste.
  while (
    g.state.status === 'running' &&
    g.state.saucers.some((s: any) => s.id === bornOn) &&
    framesAlive < 1200
  ) {
    g.step(1);
    framesAlive += 1;
  }
  if (g.state.status !== 'running') return;
  // Traversee de 360 px a >= 74 px/s : ~5s. Elle ne doit jamais rester bloquee.
  expect(framesAlive).toBeLessThan(1200);
});

test('asteroids: vie bonus accordee a chaque palier de 10 000 points', () => {
  const g = mount(useAsteroidsGame);
  const start = g.state.lives;
  // On pousse le score au palier plutot que d'esperer qu'un bot y arrive.
  g.state.score = 10000;
  g.step(1);
  expect(g.state.lives).toBe(start + 1);
  g.state.score = 29999;
  g.step(1);
  expect(g.state.lives).toBe(start + 2);
  g.state.score = 30000;
  g.step(1);
  expect(g.state.lives).toBe(start + 3);
  // Pas de vie en double si le score ne franchit plus de palier.
  g.step(1);
  expect(g.state.lives).toBe(start + 3);
});

test('invaders: 60s de jeu, le joueur reste dans le terrain', () => {
  const g = mount(useSpaceInvadersGame);
  g.step(3600, (s) => {
    expect(s.playerX >= 16 && s.playerX <= 344).toBe(true);
    expect(s.lives).toBeGreaterThanOrEqual(0);
  });
});

test('invaders: une seule vie perdue par salve (invincibilite)', () => {
  const g = mount(useSpaceInvadersGame);
  const seen: number[] = [];
  let last = g.state.lives;
  for (let i = 0; i < 6000 && g.state.status === 'running'; i += 1) {
    g.step(1);
    if (g.state.lives !== last) {
      seen.push(i);
      last = g.state.lives;
    }
  }
  // Deux pertes de vie ne peuvent pas etre separees de moins de l'invincibilite.
  for (let i = 1; i < seen.length; i += 1) {
    expect((seen[i] - seen[i - 1]) * DT).toBeGreaterThanOrEqual(1.4);
  }
});

test('invaders: la vague suivante repart vers la droite', () => {
  const g = mount(useSpaceInvadersGame);
  // On vide la vague a la main puis on avance d'une frame.
  g.state.invaders.forEach((i: any) => { i.alive = false; });
  g.step(1);
  expect(g.state.wave).toBe(2);
  expect(g.state.invaders.every((i: any) => i.alive)).toBe(true);
  const startX = g.state.invaders[0].x;
  g.step(60);
  expect(g.state.invaders[0].x).toBeGreaterThanOrEqual(startX);
});

test('invaders: les listes lourdes gardent leur reference entre les frames', () => {
  const g = mount(useSpaceInvadersGame);
  let prevInvaders = g.state.invaders;
  let prevBunkers = g.state.bunkers;
  let invaderChanges = 0;
  let bunkerChanges = 0;
  const FRAMES = 600; // 10 secondes
  for (let i = 0; i < FRAMES && g.state.status === 'running'; i += 1) {
    g.step(1);
    if (g.state.invaders !== prevInvaders) { invaderChanges += 1; prevInvaders = g.state.invaders; }
    if (g.state.bunkers !== prevBunkers) { bunkerChanges += 1; prevBunkers = g.state.bunkers; }
  }
  console.log(
    `  -> invaders redessines ${invaderChanges}/${FRAMES} frames, bunkers ${bunkerChanges}/${FRAMES}`,
  );
  // La formation avance toutes les ~0.6 s au depart : loin d'une frame sur deux.
  expect(invaderChanges).toBeLessThan(FRAMES / 4);
  expect(bunkerChanges).toBeLessThan(FRAMES / 10);
});

test('invaders: une tape breve ne decale que de quelques unites', () => {
  const g = mount(useSpaceInvadersGame);
  const start = g.state.playerX;
  // Tape de ~120 ms : appui, 7 frames, relachement.
  g.controls.right(true);
  g.step(7);
  g.controls.right(false);
  const tap = g.state.playerX - start;
  console.log(`  -> tape de 120 ms : ${tap.toFixed(1)} unites (largeur envahisseur = 18)`);
  expect(tap).toBeGreaterThan(2);      // la tape doit servir a quelque chose
  expect(tap).toBeLessThan(18);        // ... sans sauter une colonne entiere

  // Maintien : la rampe doit rendre une vitesse de traversee normale.
  // On mesure sur 0,5 s depuis le centre pour ne pas buter sur le bord.
  g.controls.restart();
  const before = g.state.playerX;
  g.controls.right(true);
  g.step(30); // 0,5 s = duree de la rampe
  const held = g.state.playerX - before;
  g.controls.right(false);
  console.log(`  -> maintien de 0,5 s : ${held.toFixed(1)} unites (terrain = 360)`);
  expect(held).toBeGreaterThan(60);
  expect(held).toBeLessThan(100);
});

test('invaders: geometrie de la vague et des bunkers dans le terrain', () => {
  const g = mount(useSpaceInvadersGame);
  const W = 360;
  const SIZE: any = { squid: 12, crab: 16.5, octopus: 18 };
  const xs = g.state.invaders.map((i: any) => i.x);
  const rights = g.state.invaders.map((i: any) => i.x + SIZE[i.kind]);
  console.log(
    `  -> formation x de ${Math.min(...xs).toFixed(1)} a ${Math.max(...rights).toFixed(1)} (terrain 0-${W})`,
  );
  expect(Math.min(...xs)).toBeGreaterThan(0);
  expect(Math.max(...rights)).toBeLessThan(W);

  // Les trois familles doivent etre centrees sur les memes colonnes.
  const centreOf = (kind: string) => {
    const first = g.state.invaders.find((i: any) => i.kind === kind && i.col === 0);
    return first.x + SIZE[kind] / 2;
  };
  expect(Math.abs(centreOf('squid') - centreOf('octopus'))).toBeLessThan(0.01);
  expect(Math.abs(centreOf('crab') - centreOf('octopus'))).toBeLessThan(0.01);

  const bx = g.state.bunkers.map((b: any) => b.x);
  console.log(
    `  -> ${g.state.bunkers.length} morceaux de bunker, x de ${Math.min(...bx)} a ${Math.max(...bx) + 4}`,
  );
  expect(Math.min(...bx)).toBeGreaterThanOrEqual(40);
  expect(Math.max(...bx) + 4).toBeLessThanOrEqual(W - 40);
});

test('invaders: l animation bascule a chaque pas de la formation', () => {
  const g = mount(useSpaceInvadersGame);
  let flips = 0;
  let prev = g.state.animFrame;
  let moves = 0;
  let prevInv = g.state.invaders;
  for (let i = 0; i < 300; i += 1) {
    g.step(1);
    if (g.state.animFrame !== prev) { flips += 1; prev = g.state.animFrame; }
    if (g.state.invaders !== prevInv) { moves += 1; prevInv = g.state.invaders; }
  }
  console.log(`  -> ${flips} changements d image pour ${moves} pas de formation`);
  expect(flips).toBe(moves);
  expect(flips).toBeGreaterThan(0);
});

test('invaders: un envahisseur touche laisse une explosion breve', () => {
  const g = mount(useSpaceInvadersGame);
  let seen = false;
  for (let i = 0; i < 900 && !seen; i += 1) {
    g.controls.fire();
    g.step(1);
    if (g.state.explosions.length > 0) seen = true;
  }
  expect(seen).toBe(true);
  // Elle doit disparaitre toute seule.
  g.step(60);
  expect(g.state.explosions.length).toBe(0);
});

test('invaders: vie bonus unique au passage de 1500 points', () => {
  const g = mount(useSpaceInvadersGame);
  const start = g.state.lives;
  g.state.score = 1500;
  g.step(1);
  expect(g.state.lives).toBe(start + 1);
  g.state.score = 9000;
  g.step(1);
  expect(g.state.lives).toBe(start + 1); // une seule fois, jamais deux
});

test('asteroids: le nombre d asteroides suit la progression de la borne', () => {
  const g = mount(useAsteroidsGame);
  const counts: number[] = [];
  for (let level = 1; level <= 5; level += 1) {
    // On vide le terrain pour declencher le niveau suivant.
    g.state.asteroids = [];
    g.state.saucers = [];
    g.step(1);
    counts.push(g.state.asteroids.length);
  }
  console.log(`  -> asteroides par niveau (2 a 6) : ${counts.join(', ')}`);
  expect(counts).toEqual([6, 8, 10, 11, 11]);
});

test('asteroids: l hyperespace teleporte sans jamais tuer ni proteger', () => {
  let deaths = 0;
  let moved = 0;
  let protectedRuns = 0;
  const RUNS = 300;
  for (let i = 0; i < RUNS; i += 1) {
    const g = mount(useAsteroidsGame);
    // On purge l'invincibilite de depart pour observer le seul effet du saut.
    g.state.ship.invincible = 0;
    const before = { lives: g.state.lives, x: g.state.ship.x, y: g.state.ship.y };
    g.controls.hyperspace();
    if (g.state.lives < before.lives) deaths += 1;
    if (g.state.ship.x !== before.x || g.state.ship.y !== before.y) moved += 1;
    if (g.state.ship.invincible > 0) protectedRuns += 1;
  }
  console.log(`  -> hyperespace : ${deaths} mort(s) directe(s), ${moved}/${RUNS} teleportations, ${protectedRuns} avec protection`);
  expect(deaths).toBe(0);
  expect(protectedRuns).toBe(0);
  expect(moved).toBe(RUNS);
});

test('asteroids: une nouvelle vague ne donne aucune invincibilite', () => {
  const g = mount(useAsteroidsGame);
  g.state.ship.invincible = 0;
  // On vide le terrain : la vague suivante doit demarrer sans protection.
  g.state.asteroids = [];
  g.state.saucers = [];
  g.step(1);
  expect(g.state.level).toBe(2);
  expect(g.state.ship.invincible).toBe(0);
  // ... mais aucun asteroide ne doit apparaitre sur le vaisseau.
  const ship = g.state.ship;
  const nearest = Math.min(
    ...g.state.asteroids.map((a: any) => Math.hypot(a.x - ship.x, a.y - ship.y)),
  );
  console.log(`  -> vague 2 : asteroide le plus proche a ${nearest.toFixed(0)} unites du vaisseau`);
  expect(nearest).toBeGreaterThanOrEqual(120);
});

test('asteroids: la soucoupe arrive sur un minuteur, sans avoir tire', () => {
  const g = mount(useAsteroidsGame);
  // Vaisseau invulnerable : on teste le minuteur, pas la survie d'un bot.
  g.state.ship.invincible = 1e9;
  let frames = 0;
  while (g.state.saucers.length === 0 && frames < 60 * 60) {
    g.step(1);
    frames += 1;
  }
  console.log(`  -> premiere soucoupe apres ${(frames / 60).toFixed(1)} s sans tirer un seul coup`);
  expect(g.state.saucers.length).toBe(1);
  expect(frames / 60).toBeLessThan(30);
});

test('invaders: la descente colle a la cadence de la borne', () => {
  const g = mount(useSpaceInvadersGame);
  // Canon invulnerable : on mesure la descente, pas la survie d'un bot immobile.
  // Sans ca la partie se terminait parfois avant la fin de la mesure.
  g.state.invincible = 1e9;
  const y0 = Math.min(...g.state.invaders.map((i: any) => i.y));
  const FRAMES = 60 * 60; // 60 s
  let drops = 0;
  let frames = 0;
  let prevY = y0;
  for (let i = 0; i < FRAMES && g.state.status === 'running'; i += 1) {
    g.step(1);
    frames += 1;
    const y = Math.min(...g.state.invaders.map((inv: any) => inv.y));
    if (y > prevY) { drops += 1; prevY = y; }
  }
  const elapsed = frames / 60;
  const descent = (prevY - y0) / elapsed;
  console.log(
    `  -> ${drops} descente(s) en ${elapsed}s = ${descent.toFixed(2)} unites/s (borne ramenee a notre terrain : 0.71)`,
  );
  // Tolerance large : la course horizontale n'est pas au meme ratio qu'a l'origine.
  expect(descent).toBeGreaterThan(0.4);
  expect(descent).toBeLessThan(1.2);
});

test('invaders: la formation accelere quand il en reste peu', () => {
  const g = mount(useSpaceInvadersGame);
  const stepsIn = (frames: number) => {
    let n = 0;
    let prev = g.state.invaders;
    for (let i = 0; i < frames; i += 1) {
      g.step(1);
      if (g.state.invaders !== prev) { n += 1; prev = g.state.invaders; }
    }
    return n;
  };
  const plein = stepsIn(600); // 10 s avec 55 vivants
  // On n'en laisse qu'un seul.
  g.state.invaders.forEach((inv: any, idx: number) => { if (idx > 0) inv.alive = false; });
  const seul = stepsIn(600);
  console.log(`  -> pas en 10 s : ${plein} a 55 vivants, ${seul} avec 1 seul survivant`);
  expect(seul).toBeGreaterThan(plein * 10);
});

test('invaders: la soucoupe vaut 300 au 23e tir puis tous les 15', async () => {
  const CFG: any = await import('C:/Users/coren/Claude Projects/arcade-games/expo/lib/gameConfig.ts');
  const table = CFG.CONFIG.invaders.ufoPoints;
  expect(table.length).toBe(15);
  const at = (shot: number) => table[shot % table.length];
  console.log(`  -> soucoupe : 23e tir = ${at(23)}, 38e = ${at(38)}, 53e = ${at(53)}`);
  for (const shot of [23, 38, 53, 68]) expect(at(shot)).toBe(300);
  // Un tir pris au hasard entre deux paliers ne doit pas donner 300.
  for (const shot of [24, 30, 37, 39, 50]) expect(at(shot)).not.toBe(300);
});

test('invaders: plus de soucoupe sous 8 envahisseurs', () => {
  const g = mount(useSpaceInvadersGame);
  g.state.invincible = 1e9;
  // On ne laisse que 7 survivants.
  g.state.invaders.forEach((i: any, idx: number) => { if (idx >= 7) i.alive = false; });
  let seen = false;
  for (let i = 0; i < 60 * 90 && !seen; i += 1) {
    g.step(1);
    if (g.state.ufo.active) seen = true;
  }
  console.log(`  -> 7 survivants, 90 s d attente : soucoupe ${seen ? 'APPARUE' : 'jamais apparue'}`);
  expect(seen).toBe(false);
});

test('invaders: la soucoupe passe toutes les ~25,6 s', () => {
  const g = mount(useSpaceInvadersGame);
  g.state.invincible = 1e9;
  let frames = 0;
  while (!g.state.ufo.active && frames < 60 * 60) { g.step(1); frames += 1; }
  const first = frames / 60;
  console.log(`  -> premiere soucoupe apres ${first.toFixed(1)} s (borne : 25,6)`);
  expect(first).toBeGreaterThan(24);
  expect(first).toBeLessThan(28);
});
