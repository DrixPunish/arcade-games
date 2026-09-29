import { expect, test, mock } from 'bun:test';
/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');

// --- Shim des hooks React : le moteur n'utilise que la forme fonctionnelle. ---
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

const TF: any = await import(`${ROOT}/games/track-field/useTrackFieldGame.ts`);
const { CONFIG }: any = await import(`${ROOT}/lib/gameConfig.ts`);

const DT = 1 / 60;
/** Cadences de martèlement réalistes, en appuis par seconde. */
const HUMAN_SLOW = 5;
const HUMAN_OK = 8;
const HUMAN_FAST = 11;
function mount() {
  cursor = 0; boxes.length = 0; frame = null;
  const api = TF.useTrackFieldGame();
  const box = boxes[0];
  // L'alternance vit HORS de `hammer` : appelée image par image, elle doit
  // continuer à alterner, sinon on tape toujours le même bouton.
  let which = 0;
  let tick = 0;
  return {
    controls: api.controls,
    get state() { return box.value; },
    step(n: number) { for (let i = 0; i < n; i += 1) frame!(DT); },
    /**
     * Martèle à une cadence HUMAINE, exprimée en appuis par seconde.
     * Un joueur rapide sur deux pouces plafonne vers 10-12 appuis/s ; l'ancien
     * harnais tapait 30 fois par seconde, ce qui validait des réglages
     * injouables.
     */
    hammer(frames: number, tapsPerSecond = HUMAN_FAST) {
      const period = 60 / tapsPerSecond;
      for (let i = 0; i < frames; i += 1) {
        if (tick % period < 1) { which ? api.controls.runB() : api.controls.runA(); which ^= 1; }
        tick += 1;
        frame!(DT);
      }
    },
  };
}

const bestAngle = (event: 'longJump' | 'javelin', speed: number) => {
  const { launchSpeed, height } = TF.flightSetup(event, speed);
  let best = 0, bestDeg = 0;
  for (let deg = 20; deg <= 70; deg += 0.1) {
    const r = TF.projectileRange(launchSpeed, deg, height);
    if (r > best) { best = r; bestDeg = deg; }
  }
  return { bestDeg, best };
};

/* ------------------------------------------------------------- physique -- */

test('l angle optimal tombe sur celui documente par la borne', () => {
  const top = CONFIG.trackField.topSpeed;
  for (const [event, expected] of [['longJump', 42], ['javelin', 43]] as const) {
    const { bestDeg, best } = bestAngle(event, top);
    console.log(`  -> ${event.padEnd(9)} : optimum ${bestDeg.toFixed(1)}deg (borne ${expected}) -> ${best.toFixed(2)} m`);
    expect(Math.abs(bestDeg - expected)).toBeLessThan(0.6);
  }
});

test('l angle optimal ne depend pas de la vitesse atteinte', () => {
  for (const speed of [7, 9, 11.5]) {
    expect(Math.abs(bestAngle('longJump', speed).bestDeg - 42)).toBeLessThan(0.6);
  }
});

test('les distances a pleine vitesse sont plausibles', () => {
  const top = CONFIG.trackField.topSpeed;
  const lj = bestAngle('longJump', top).best;
  const jav = bestAngle('javelin', top).best;
  console.log(`  -> a pleine vitesse : longueur ${lj.toFixed(2)} m, javelot ${jav.toFixed(1)} m`);
  expect(lj).toBeGreaterThan(7.5);
  expect(lj).toBeLessThan(10);
  expect(jav).toBeGreaterThan(70);
  expect(jav).toBeLessThan(105);
});

test('un mauvais angle coute cher', () => {
  const { launchSpeed, height } = TF.flightSetup('longJump', CONFIG.trackField.topSpeed);
  const opt = TF.projectileRange(launchSpeed, 42, height);
  const flat = TF.projectileRange(launchSpeed, 20, height);
  const steep = TF.projectileRange(launchSpeed, 70, height);
  console.log(`  -> longueur : 20deg ${flat.toFixed(2)} | 42deg ${opt.toFixed(2)} | 70deg ${steep.toFixed(2)} m`);
  expect(flat).toBeLessThan(opt * 0.92);
  expect(steep).toBeLessThan(opt * 0.8);
});

/* ------------------------------------------------------------- gameplay -- */

test('marteler en ALTERNANCE accelere, marteler le meme bouton ne fait rien', () => {
  const alt = mount();
  alt.hammer(120);
  const spam = mount();
  for (let i = 0; i < 120; i += 1) { if (i % 2 === 0) spam.controls.runA(); spam.step(1); }
  console.log(`  -> 2 s : alternance ${alt.state.speed.toFixed(1)} m/s, un seul bouton ${spam.state.speed.toFixed(1)} m/s`);
  expect(alt.state.speed).toBeGreaterThan(6);
  expect(spam.state.speed).toBeLessThan(0.5);
});

test('la vitesse retombe quand on arrete de marteler', () => {
  const g = mount();
  g.hammer(120);
  const peak = g.state.speed;
  g.step(150); // 2,5 s sans rien faire
  console.log(`  -> ${peak.toFixed(1)} -> ${g.state.speed.toFixed(1)} m/s apres 2,5 s sans marteler`);
  // Decroissance exponentielle : on tend vers zero sans jamais l'atteindre.
  expect(g.state.speed).toBeLessThan(peak * 0.03);
});

test('le 100 m se termine et donne un chrono plausible', () => {
  const g = mount();
  for (let i = 0; i < 60 * 30 && g.state.phase !== 'result'; i += 1) g.hammer(1);
  console.log(`  -> 100 m couru en ${g.state.result.toFixed(2)} s (minima ${CONFIG.trackField.qualify.dash100})`);
  expect(g.state.phase).toBe('result');
  expect(g.state.result).toBeGreaterThan(8.6);
  expect(g.state.result).toBeLessThan(20);
});

test('passer la planche sans sauter est mordu', () => {
  const g = mount();
  g.state.eventIndex = 1;
  for (let i = 0; i < 60 * 40 && g.state.phase !== 'result'; i += 1) g.hammer(1);
  console.log(`  -> longueur sans sauter : mordu=${g.state.foul}, resultat ${g.state.result}`);
  expect(g.state.foul).toBe(true);
  expect(g.state.result).toBe(0);
});

test('un saut bien joue franchit le minima de qualification', () => {
  const g = mount();
  g.state.eventIndex = 1;
  while (g.state.runDistance < 36 && g.state.phase !== 'result') g.hammer(1);
  // On continue de marteler PENDANT le reglage de l'angle : le pave est
  // multi-touch, c'est le geste attendu. Sans ca la vitesse retombe et le
  // saut est court.
  g.controls.action(true);
  while (g.state.angle < 42 && g.state.phase === 'running') g.hammer(1);
  g.controls.action(false);
  for (let i = 0; i < 900 && g.state.phase !== 'result'; i += 1) g.step(1);
  const minima = CONFIG.trackField.qualify.longJump;
  console.log(`  -> saut a ${g.state.angle.toFixed(0)} deg : ${g.state.result.toFixed(2)} m (minima ${minima})`);
  expect(g.state.foul).toBe(false);
  expect(g.state.result).toBeGreaterThan(minima);
});

test('la vitesse est figee pendant le reglage de l angle', () => {
  const g = mount();
  g.state.eventIndex = 1;
  while (g.state.runDistance < 34 && g.state.phase !== 'result') g.hammer(1);
  g.controls.action(true);
  g.step(1);
  const locked = g.state.speed;
  // On arrete completement de marteler : la vitesse ne doit pas bouger.
  for (let i = 0; i < 25 && g.state.phase === 'running'; i += 1) g.step(1);
  console.log(`  -> vitesse figee : ${locked.toFixed(2)} -> ${g.state.speed.toFixed(2)} m/s sans marteler`);
  expect(g.state.speed).toBeCloseTo(locked, 5);
  // ... et l'athlete continue bien d'avancer vers la planche.
  expect(g.state.runDistance).toBeGreaterThan(34);
});

test('le resultat ne depend plus du martelage pendant l angle', () => {
  const run = (keepHammering: boolean) => {
    const g = mount();
    g.state.eventIndex = 1;
    while (g.state.runDistance < 34 && g.state.phase !== 'result') g.hammer(1);
    g.controls.action(true);
    while (g.state.angle < 42 && g.state.phase === 'running') {
      if (keepHammering) g.hammer(1); else g.step(1);
    }
    g.controls.action(false);
    for (let i = 0; i < 900 && g.state.phase !== 'result'; i += 1) g.step(1);
    return g.state.result;
  };
  const avec = run(true);
  const sans = run(false);
  console.log(`  -> saut : ${avec.toFixed(2)} m en martelant, ${sans.toFixed(2)} m sans`);
  expect(Math.abs(avec - sans)).toBeLessThan(0.05);
});

test('toucher une haie casse l elan', () => {
  const g = mount();
  g.state.eventIndex = 3;
  // On court sans jamais sauter : la premiere haie est a 13,72 m.
  let peak = 0;
  while (g.state.runDistance < 13.7 && g.state.phase !== 'result') {
    g.hammer(1);
    peak = Math.max(peak, g.state.speed);
  }
  g.step(3); // le temps de percuter
  console.log(`  -> 1re haie sans sauter : ${peak.toFixed(1)} -> ${g.state.speed.toFixed(2)} m/s, "${g.state.message}"`);
  expect(g.state.message).toContain('Haie');
  // On trebuche sans s'arreter net : la vitesse chute mais on repart.
  expect(g.state.speed).toBeLessThan(peak * 0.75);
  expect(g.state.speed).toBeGreaterThan(0.5);
});

test('sauter au bon moment franchit la haie sans casser l elan', () => {
  const g = mount();
  g.state.eventIndex = 3;
  while (g.state.runDistance < 12.5 && g.state.phase !== 'result') g.hammer(1);
  const before = g.state.speed;
  g.controls.action(true);
  g.step(1);
  g.controls.action(false);
  while (g.state.runDistance < 14.2 && g.state.phase !== 'result') g.hammer(1);
  console.log(`  -> haie franchie : ${before.toFixed(1)} -> ${g.state.speed.toFixed(1)} m/s, "${g.state.message}"`);
  expect(g.state.message).not.toContain('Haie');
});

/* ------------------------------------------------- lisibilite des haies -- */

const STADIUM: any = await import(`${ROOT}/games/track-field/stadium.ts`);

/**
 * Saute une haie en appuyant `offset` metres avant elle, et rend compte de ce
 * qui s'est passe AU MOMENT PRECIS du franchissement.
 */
function jumpAt(offset: number) {
  const g = mount();
  g.state.eventIndex = 3;
  const target = 13.72; // la premiere haie
  let pressed = false;
  let liftAtCross = -1;
  let realOffset = 0;
  for (let i = 0; i < 60 * 30 && liftAtCross < 0 && g.state.phase !== 'result'; i += 1) {
    if (!pressed && g.state.runDistance >= target - offset) {
      // Un joueur ne peut pas appuyer entre deux images : l'appel reel est
      // donc un peu plus tardif que demande, et c'est ce qu'on mesure.
      realOffset = target - g.state.runDistance;
      g.controls.action(true);
      pressed = true;
    } else if (pressed) {
      g.controls.action(false);
    }
    const before = g.state.runDistance;
    g.hammer(1);
    // La haie est evaluee DANS la frame ou la distance la depasse : c'est la,
    // et seulement la, que la hauteur affichee doit etre au-dessus d'elle.
    if (before < target && g.state.runDistance >= target) {
      liftAtCross = g.state.flightHeight * STADIUM.HURDLE_LIFT;
    }
  }
  g.hammer(2);
  return { knocked: g.state.message.includes('Haie'), liftAtCross, realOffset };
}

test('on franchit la haie depuis toute la zone d appel marquee au sol', () => {
  const zone = CONFIG.trackField.hurdleTakeoffZone;
  const lines: string[] = [];
  let worstLift = Infinity;
  // On balaie toute la bande dessinee, bords compris.
  for (let off = 0.2; off <= zone; off += 0.3) {
    const r = jumpAt(off);
    lines.push(`    appel a ${r.realOffset.toFixed(2)} m de la haie : ${r.knocked ? 'RENVERSEE' : 'franchie'}, hauteur au passage ${r.liftAtCross.toFixed(0)} px`);
    expect(`${off.toFixed(1)}:${r.knocked}`).toBe(`${off.toFixed(1)}:false`);
    worstLift = Math.min(worstLift, r.liftAtCross);
  }
  console.log('  zone d appel -> franchissement');
  for (const l of lines) console.log(l);
  console.log(`  -> hauteur minimale au passage : ${worstLift.toFixed(0)} px (haie ${STADIUM.HURDLE_HEIGHT} px)`);
  // Le lien entre la regle et l'image : si le moteur compte la haie franchie,
  // l'athlete doit etre VU au-dessus. Sans ca le joueur ne peut rien apprendre.
  expect(worstLift).toBeGreaterThan(STADIUM.HURDLE_HEIGHT);
});

test('appuyer trop tot rate la haie, et c est lisible', () => {
  const far = jumpAt(CONFIG.trackField.hurdleTakeoffZone + 3);
  console.log(`  -> appel 3 m avant la zone : ${far.knocked ? 'renversee' : 'franchie'}`);
  expect(far.knocked).toBe(true);
});

test('le 110 m haies se qualifie meme en renversant deux haies', () => {
  const g = mount();
  g.state.eventIndex = 3;
  let skipped = 0;
  for (let i = 0; i < 60 * 60 && g.state.phase !== 'result'; i += 1) {
    const next = g.state.hurdles.find((h: any) => !h.cleared);
    if (next && !g.state.airborne) {
      const gap = next.x - g.state.runDistance;
      // On rate volontairement les deux premieres haies.
      const deliberate = skipped < 2 && next.x <= 13.72 + 9.14;
      if (gap > 0 && gap <= CONFIG.trackField.hurdleTakeoffZone - 1 && !deliberate) {
        g.controls.action(true); g.hammer(1); g.controls.action(false);
        continue;
      }
      if (deliberate && gap < 0.2) skipped += 1;
    }
    g.hammer(1);
  }
  const minima = CONFIG.trackField.qualify.hurdles;
  console.log(`  -> 2 haies renversees volontairement : ${g.state.result.toFixed(2)} s (minima ${minima})`);
  expect(g.state.phase).toBe('result');
  expect(g.state.result).toBeLessThan(minima);
});
