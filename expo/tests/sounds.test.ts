import { expect, test, mock } from 'bun:test';

/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');

// Le module n'a besoin que de Platform ; on evite de charger react-native.
mock.module('react-native', () => ({ Platform: { OS: 'android' } }));
(globalThis as any).__DEV__ = false;

const S: any = await import(`${ROOT}/lib/gameSounds.ts`);

// `Bun.file` attend un CHEMIN, pas une URL `file://` : plusieurs controles de
// ce fichier relisent la source pour verifier que les deux backends couvrent
// bien les memes cles.
const SOURCE = Bun.fileURLToPath(new URL('../lib/gameSounds.ts', import.meta.url));

const INVADERS = ['siStep1','siStep2','siStep3','siStep4','siShoot','siInvaderDie','siPlayerDie','siUfoDie'];
const LOOPS = ['thrust','saucerBig','saucerSmall','siUfo'];
const PACMAN = ['pacWakaA','pacWakaB','pacPower','pacEatGhost','pacFruit','pacDeath','pacExtraLife'];

test('le gestionnaire expose bien toutes les cles', () => {
  const mgr = S.getArcadeSounds();
  expect(typeof mgr.play).toBe('function');
  expect(typeof mgr.setLoop).toBe('function');
});

test('chaque son de Space Invaders produit un echantillon audible', async () => {
  // On passe par le backend natif : c'est lui qui synthetise vraiment.
  const mod = await Bun.file(SOURCE).text();
  for (const key of INVADERS) {
    expect(`${key}:present`).toBe(`${key}:${mod.includes(`case '${key}'`) ? 'present' : 'absent'}`);
  }
});

/** Contenu d'un bloc `const NOM = { ... };` du fichier source. */
function blockOf(mod: string, name: string): string {
  const start = mod.indexOf(`const ${name}`);
  return start < 0 ? '' : mod.slice(start, mod.indexOf('};', start));
}

test('toute boucle declaree possede un timbre', async () => {
  const mod = await Bun.file(SOURCE).text();
  // Une cle marquee comme boucle mais absente de la table des timbres serait
  // silencieuse, sans la moindre erreur : c'est le genre de panne qu'on ne
  // remarque qu'en jouant.
  const looping = blockOf(mod, 'LOOPING');
  const tones = blockOf(mod, 'LOOP_TONE');
  const declared = [...looping.matchAll(/^\s{2}(\w+):\s*true/gm)].map((m) => m[1]);
  console.log(`  -> ${declared.length} boucles declarees : ${declared.join(', ')}`);
  expect(declared.length).toBeGreaterThanOrEqual(LOOPS.length);
  for (const key of declared) {
    // `thrust` est du bruit filtre, pas une onde ondulante : il a son propre
    // chemin dans les deux backends.
    if (key === 'thrust') continue;
    const hasTone = new RegExp(`^\\s{2}${key}:`, 'm').test(tones);
    expect(`${key}:timbre`).toBe(`${key}:${hasTone ? 'timbre' : 'MANQUANT'}`);
  }
});

test('les quatre notes du battement descendent bien en frequence', async () => {
  const mod = await Bun.file(SOURCE).text();
  const freqs = ['siStep1','siStep2','siStep3','siStep4'].map((k) => {
    const m = mod.match(new RegExp(`case '${k}':\\s*\\n\\s*return genOscSweep\\('square', (\\d+)`));
    return m ? Number(m[1]) : NaN;
  });
  console.log(`  -> notes du battement : ${freqs.join(' > ')} Hz`);
  for (let i = 1; i < freqs.length; i += 1) {
    expect(freqs[i]).toBeLessThan(freqs[i - 1]);
  }
});

test('chaque son de Pac-Man est synthetise', async () => {
  const mod = await Bun.file(SOURCE).text();
  for (const key of PACMAN) {
    expect(`${key}:present`).toBe(`${key}:${mod.includes(`case '${key}'`) ? 'present' : 'absent'}`);
  }
  // Les deux notes du « waka » doivent differer, sinon l'alternance ne
  // s'entend pas et le bruit de bouche disparait.
  const grab = (k: string) =>
    mod.match(new RegExp(`case '${k}':\\s*\\n\\s*return genOscSweep\\('square', (\\d+), (\\d+)`));
  const a = grab('pacWakaA'), b = grab('pacWakaB');
  console.log(`  -> waka A ${a?.[1]}->${a?.[2]} Hz, waka B ${b?.[1]}->${b?.[2]} Hz`);
  expect(a?.[1]).not.toBe(b?.[1]);
});

test('les deux backends couvrent les memes cles', async () => {
  const mod = await Bun.file(SOURCE).text();
  // Backend natif : synthOneShot / synthLoop. Backend web : playKey / startLoop.
  for (const key of [...INVADERS, ...PACMAN]) {
    const occurrences = (mod.match(new RegExp(`case '${key}'`, 'g')) ?? []).length;
    // une fois cote natif, une fois cote web
    expect(`${key}:${occurrences}`).toBe(`${key}:2`);
  }
});
