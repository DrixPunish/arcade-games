import { expect, test } from 'bun:test';
/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');
const S = await import(`${ROOT}/games/space-invaders/sprites.ts`);

const all: [string, readonly string[]][] = [
  ['squid0', S.SQUID[0]], ['squid1', S.SQUID[1]],
  ['crab0', S.CRAB[0]], ['crab1', S.CRAB[1]],
  ['octopus0', S.OCTOPUS[0]], ['octopus1', S.OCTOPUS[1]],
  ['cannon', S.CANNON], ['saucer', S.SAUCER],
  ['explosion', S.EXPLOSION], ['bunker', S.BUNKER],
];

test('toutes les grilles sont rectangulaires et n ont que . et X', () => {
  for (const [name, bmp] of all) {
    const w = bmp[0].length;
    for (const line of bmp) {
      expect(`${name}:${line.length}`).toBe(`${name}:${w}`);
      expect(/^[.X]+$/.test(line)).toBe(true);
    }
  }
});

test('les deux images d une famille ont la meme taille', () => {
  for (const pair of [S.SQUID, S.CRAB, S.OCTOPUS]) {
    expect(pair[0][0].length).toBe(pair[1][0].length);
    expect(pair[0].length).toBe(pair[1].length);
  }
});

test('chaque sprite produit un trace non vide et bien forme', () => {
  for (const [name, bmp] of all) {
    const d = S.spritePath(bmp, 0, 0, 2, 2);
    expect(`${name}:${d.length > 0}`).toBe(`${name}:true`);
    // Autant de M que de z, et aucun NaN.
    expect((d.match(/M/g) ?? []).length).toBe((d.match(/z/g) ?? []).length);
    expect(d.includes('NaN')).toBe(false);
  }
});

test('la fusion des pixels voisins reduit vraiment le nombre de segments', () => {
  const filled = S.CANNON.join('').split('').filter((c) => c === 'X').length;
  const segments = (S.spritePath(S.CANNON, 0, 0, 1, 1).match(/M/g) ?? []).length;
  console.log(`  -> canon : ${filled} pixels pleins -> ${segments} segments`);
  expect(segments).toBeLessThan(filled / 3);
});

test('le trace respecte la boite demandee', () => {
  const d = S.spritePath(S.CRAB[0], 10, 20, 1.5, 1.5);
  const nums = [...d.matchAll(/M([\d.-]+) ([\d.-]+)/g)].map((m) => [+m[1], +m[2]]);
  const xs = nums.map((n) => n[0]);
  const ys = nums.map((n) => n[1]);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(10);
  expect(Math.max(...xs)).toBeLessThan(10 + 11 * 1.5);
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
  expect(Math.max(...ys)).toBeLessThan(20 + 8 * 1.5);
});
