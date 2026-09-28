import { expect, test, mock } from 'bun:test';

/** Racine du projet, relative a ce fichier : la suite doit tourner partout. */
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');

/**
 * ⚠️ Ces tests n'ÉCRIVENT JAMAIS dans la base de production : les parties de
 * l'owner et de sa famille sont dans la même table, et des scores de test y
 * apparaissaient en tête de classement.
 *
 * Le chemin d'écriture est donc vérifié contre un client Supabase simulé, qui
 * enregistre ce qu'on lui demande d'insérer. Seule une lecture, sans effet de
 * bord, touche encore le vrai projet pour confirmer qu'il répond.
 */

// expo-constants : on rejoue ce que app.json fournit a l'app.
mock.module('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabase: {
          url: 'https://wcleoopxtczhmxmycpvj.supabase.co',
          publishableKey: 'sb_publishable_NR370-kFAhKx8YLn1zsG3Q_knKLWk-F',
        },
      },
    },
  },
}));

// AsyncStorage : implementation memoire.
const store = new Map<string, string>();
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => { store.set(k, v); },
  },
}));

// Client Supabase simule : aucune requete ne sort.
const inserted: any[] = [];
let rowsToReturn: any[] = [];
function makeQuery(): any {
  const q: any = {
    select: () => q, eq: () => q, order: () => q, limit: () => q,
    abortSignal: () => Promise.resolve({ data: rowsToReturn, error: null }),
    then: (r: any) => Promise.resolve({ data: rowsToReturn, error: null }).then(r),
  };
  return q;
}
mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => makeQuery(),
      insert: (row: any) => {
        inserted.push(row);
        return { abortSignal: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

const hs = await import(`${ROOT}/lib/highScores.ts`);

test('normalizeInitials respecte le format accepte par la base', () => {
  expect(hs.normalizeInitials('abc')).toBe('ABC');
  expect(hs.normalizeInitials('é!@ z9')).toBe('Z9');
  expect(hs.normalizeInitials('')).toBe('AAA');
  expect(hs.normalizeInitials('TOOLONG')).toBe('TOO');
  expect(hs.normalizeInitials('   ')).toBe('AAA');
});

test('saveHighScore ecrit en local ET envoie en ligne, initiales normalisees', async () => {
  inserted.length = 0;
  const res = await hs.saveHighScore('asteroids', { initials: 'çé#', score: 4242, date: Date.now() });
  expect(res.online).toBe(true);

  // Envoi en ligne : initiales repliees sur AAA, jamais le brut.
  expect(inserted.length).toBe(1);
  expect(inserted[0]).toEqual({ game: 'asteroids', initials: 'AAA', score: 4242 });

  // Et la copie locale est bien posee.
  const local = await hs.getLocalHighScores('asteroids');
  expect(local.some((e: any) => e.initials === 'AAA' && e.score === 4242)).toBe(true);
});

test('le classement en ligne est trie et converti correctement', async () => {
  rowsToReturn = [
    { initials: 'ABC', score: 900, created_at: '2026-01-02T00:00:00Z' },
    { initials: 'XYZ', score: 100, created_at: '2026-01-01T00:00:00Z' },
  ];
  const rows = await hs.getOnlineHighScores('asteroids');
  expect(rows).not.toBeNull();
  expect(rows!.map((r: any) => r.initials)).toEqual(['ABC', 'XYZ']);
  expect(Number.isFinite(rows![0].date)).toBe(true);
});

test('qualifiesForHighScore refuse 0 et accepte un tres gros score', async () => {
  rowsToReturn = [];
  expect(await hs.qualifiesForHighScore('asteroids', 0)).toBe(false);
  expect(await hs.qualifiesForHighScore('asteroids', 99_000_000)).toBe(true);
});

test('le vrai projet Supabase repond (lecture seule, aucune ecriture)', async () => {
  const res = await fetch(
    'https://wcleoopxtczhmxmycpvj.supabase.co/rest/v1/high_scores?select=score&limit=1',
    { headers: { apikey: 'sb_publishable_NR370-kFAhKx8YLn1zsG3Q_knKLWk-F' } },
  );
  console.log(`  -> lecture du vrai projet : HTTP ${res.status}`);
  expect(res.ok).toBe(true);
});
