import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './gameConfig';
import { isOnlineEnabled, supabase, withTimeout } from './supabase';

export type GameId = 'asteroids' | 'spaceInvaders';
export type HighScoreEntry = { initials: string; score: number; date: number };
/** Quel classement on regarde : celui du téléphone, ou celui partagé. */
export type Board = 'online' | 'local';

const TABLE = 'high_scores';
const NETWORK_TIMEOUT = 6000;

const keyFor = (game: GameId): string => `arcade-games:scores:${game}`;

const rank = (rows: HighScoreEntry[]): HighScoreEntry[] =>
  [...rows].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, CONFIG.highScoreLimit);

/**
 * Met les initiales au format accepté par la base (`^[A-Z0-9]{1,3}$`).
 * Sans ce filtrage, un accent ou un champ vide fait rejeter l'insertion.
 */
export function normalizeInitials(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return cleaned.length > 0 ? cleaned : 'AAA';
}

/* ------------------------------------------------------------------ local -- */

export async function getLocalHighScores(game: GameId): Promise<HighScoreEntry[]> {
  const raw = await AsyncStorage.getItem(keyFor(game));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HighScoreEntry[];
    return Array.isArray(parsed) ? rank(parsed) : [];
  } catch {
    return [];
  }
}

async function saveLocalHighScore(game: GameId, entry: HighScoreEntry): Promise<void> {
  const scores = await getLocalHighScores(game);
  await AsyncStorage.setItem(keyFor(game), JSON.stringify(rank([...scores, entry])));
}

/* --------------------------------------------------------------- en ligne -- */

/** `null` = classement en ligne indisponible (pas configuré, ou réseau muet). */
export async function getOnlineHighScores(game: GameId): Promise<HighScoreEntry[] | null> {
  const client = supabase;
  if (!client) return null;
  const result = await withTimeout(
    (signal) =>
      client
        .from(TABLE)
        .select('initials, score, created_at')
        .eq('game', game)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(CONFIG.highScoreLimit)
        .abortSignal(signal),
    NETWORK_TIMEOUT,
  );
  if (!result || result.error || !result.data) return null;
  return result.data.map((row) => ({
    initials: String(row.initials),
    score: Number(row.score),
    date: Date.parse(String(row.created_at)),
  }));
}

async function saveOnlineHighScore(game: GameId, entry: HighScoreEntry): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  const result = await withTimeout(
    (signal) =>
      client
        .from(TABLE)
        .insert({ game, initials: entry.initials, score: entry.score })
        .abortSignal(signal),
    NETWORK_TIMEOUT,
  );
  return result !== null && !result.error;
}

/* ----------------------------------------------------------------- façade -- */

export { isOnlineEnabled };

export async function getHighScores(game: GameId, board: Board): Promise<HighScoreEntry[] | null> {
  return board === 'online' ? getOnlineHighScores(game) : getLocalHighScores(game);
}

/** Un score mérite d'être signé s'il entre dans l'un ou l'autre des classements. */
export async function qualifiesForHighScore(game: GameId, score: number): Promise<boolean> {
  if (score <= 0) return false;
  const [local, online] = await Promise.all([getLocalHighScores(game), getOnlineHighScores(game)]);
  const enters = (rows: HighScoreEntry[]): boolean =>
    rows.length < CONFIG.highScoreLimit || score > (rows.at(-1)?.score ?? 0);
  return enters(local) || (online !== null && enters(online));
}

/**
 * Enregistre partout : le local est la source sûre (hors ligne, immédiat),
 * l'envoi en ligne peut échouer sans casser la partie.
 */
export async function saveHighScore(
  game: GameId,
  entry: HighScoreEntry,
): Promise<{ online: boolean }> {
  const clean: HighScoreEntry = { ...entry, initials: normalizeInitials(entry.initials) };
  await saveLocalHighScore(game, clean);
  const online = await saveOnlineHighScore(game, clean);
  return { online };
}
