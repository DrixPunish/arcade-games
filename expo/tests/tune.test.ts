import { expect, test, mock } from 'bun:test';
/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');
type Box = { value: any };
const boxes: Box[] = [];
let cursor = 0;
mock.module('react', () => ({
  useState: (init: any) => {
    const i = cursor++;
    if (!boxes[i]) boxes[i] = { value: typeof init === 'function' ? init() : init };
    const b = boxes[i];
    return [b.value, (u: any) => { b.value = typeof u === 'function' ? u(b.value) : u; }];
  },
  useRef: (init: any) => { const i = cursor++; if (!boxes[i]) boxes[i] = { value: { current: init } }; return boxes[i].value; },
  useCallback: (fn: any) => fn,
}));
let frame: ((dt: number) => void) | null = null;
mock.module(`${ROOT}/hooks/useGameLoop.ts`, () => ({ useGameLoop: (_a: boolean, f: any) => { frame = f; } }));
const TF: any = await import(`${ROOT}/games/track-field/useTrackFieldGame.ts`);
const { CONFIG }: any = await import(`${ROOT}/lib/gameConfig.ts`);
const DT = 1 / 60;

function mount(eventIndex = 0) {
  cursor = 0; boxes.length = 0; frame = null;
  const api = TF.useTrackFieldGame();
  const box = boxes[0];
  box.value.eventIndex = eventIndex;
  let which = 0, tick = 0;
  return {
    controls: api.controls,
    get state() { return box.value; },
    step(n: number) { for (let i = 0; i < n; i += 1) frame!(DT); },
    hammer(frames: number, tps: number) {
      const period = 60 / tps;
      for (let i = 0; i < frames; i += 1) {
        if (tick % period < 1) { which ? api.controls.runB() : api.controls.runA(); which ^= 1; }
        tick += 1;
        frame!(DT);
      }
    },
  };
}

test('la vitesse suit la cadence de martelage, sans seuil brutal', () => {
  console.log('  cadence -> vitesse atteinte apres 3 s');
  const got: number[] = [];
  for (const tps of [3, 5, 8, 11, 14]) {
    const g = mount();
    g.hammer(180, tps);
    got.push(g.state.speed);
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.speed.toFixed(1)} m/s`);
  }
  // Aucune cadence ne doit laisser le joueur immobile, et ca doit monter.
  expect(got[0]).toBeGreaterThan(1.5);
  for (let i = 1; i < got.length; i += 1) expect(got[i]).toBeGreaterThan(got[i - 1] - 0.01);
});

test('chronos du 100 m aux cadences humaines', () => {
  console.log('  cadence -> chrono du 100 m');
  const times: Record<number, number> = {};
  for (const tps of [5, 8, 11]) {
    const g = mount(0);
    for (let i = 0; i < 60 * 40 && g.state.phase !== 'result'; i += 1) g.hammer(1, tps);
    times[tps] = g.state.result;
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.result.toFixed(2)} s (minima ${CONFIG.trackField.qualify.dash100})`);
  }
  // Un joueur correct (8/s) doit qualifier ; un joueur mou (5/s) non.
  expect(times[8]).toBeLessThan(CONFIG.trackField.qualify.dash100);
  expect(times[5]).toBeGreaterThan(CONFIG.trackField.qualify.dash100);
});

test('saut en longueur aux cadences humaines', () => {
  console.log('  cadence -> saut');
  const res: Record<number, number> = {};
  for (const tps of [5, 8, 11]) {
    const g = mount(1);
    while (g.state.runDistance < 36 && g.state.phase !== 'result') g.hammer(1, tps);
    g.controls.action(true);
    while (g.state.angle < 42 && g.state.phase === 'running') g.hammer(1, tps);
    g.controls.action(false);
    for (let i = 0; i < 900 && g.state.phase !== 'result'; i += 1) g.step(1);
    res[tps] = g.state.result;
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.result.toFixed(2)} m (minima ${CONFIG.trackField.qualify.longJump})`);
  }
  expect(res[8]).toBeGreaterThan(CONFIG.trackField.qualify.longJump);
});

test('javelot aux cadences humaines', () => {
  console.log('  cadence -> javelot');
  for (const tps of [5, 8, 11]) {
    const g = mount(2);
    while (g.state.runDistance < 36 && g.state.phase !== 'result') g.hammer(1, tps);
    g.controls.action(true);
    while (g.state.angle < 43 && g.state.phase === 'running') g.hammer(1, tps);
    g.controls.action(false);
    for (let i = 0; i < 1800 && g.state.phase !== 'result'; i += 1) g.step(1);
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.result.toFixed(1)} m (minima ${CONFIG.trackField.qualify.javelin})`);
  }
});

test('110 m haies aux cadences humaines', () => {
  console.log('  cadence -> haies (en sautant chaque haie)');
  for (const tps of [8, 11]) {
    const g = mount(3);
    let guard = 0;
    while (g.state.phase !== 'result' && guard < 60 * 60) {
      const next = g.state.hurdles.find((h: any) => !h.cleared);
      if (next && next.x - g.state.runDistance < 1.6 && !g.state.airborne) g.controls.action(true);
      else g.controls.action(false);
      g.hammer(1, tps);
      guard += 1;
    }
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.result.toFixed(2)} s (minima ${CONFIG.trackField.qualify.hurdles})`);
  }
});

test('le saut de haies franchit a TOUTE vitesse', () => {
  console.log('  cadence -> haies franchies sur 10, et chrono');
  for (const tps of [5, 8, 11]) {
    const g = mount(3);
    let guard = 0;
    while (g.state.phase !== 'result' && guard < 60 * 90) {
      const next = g.state.hurdles.find((h: any) => !h.cleared);
      // Appel a 2,2 m de la haie, quelle que soit la vitesse.
      if (next && next.x - g.state.runDistance < 2.2 && !g.state.airborne) g.controls.action(true);
      else g.controls.action(false);
      g.hammer(1, tps);
      guard += 1;
    }
    const knocked = g.state.message.includes('Haie');
    console.log(`    ${String(tps).padStart(2)} appuis/s -> ${g.state.result.toFixed(2)} s, haie renversee : ${knocked ? 'OUI' : 'non'}`);
    expect(knocked).toBe(false);
  }
});

test('renverser une haie coute de la vitesse sans tout arreter', () => {
  const g = mount(3);
  let peak = 0;
  while (g.state.runDistance < 13.7 && g.state.phase !== 'result') { g.hammer(1, 11); peak = Math.max(peak, g.state.speed); }
  g.step(3);
  const after = g.state.speed;
  console.log(`  -> haie percutee : ${peak.toFixed(1)} -> ${after.toFixed(1)} m/s (on repart, on ne bloque pas)`);
  expect(after).toBeGreaterThan(0.5);
  expect(after).toBeLessThan(peak * 0.7);
});
