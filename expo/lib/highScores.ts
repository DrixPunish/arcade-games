import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './gameConfig';

export type GameId = 'asteroids' | 'spaceInvaders';
export type HighScoreEntry = { initials: string; score: number; date: number };

const keyFor = (game: GameId): string => `arcade-games:scores:${game}`;

export async function getHighScores(game: GameId): Promise<HighScoreEntry[]> {
  const raw = await AsyncStorage.getItem(keyFor(game));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HighScoreEntry[];
    return parsed.sort((a, b) => b.score - a.score).slice(0, CONFIG.highScoreLimit);
  } catch {
    return [];
  }
}

export async function qualifiesForHighScore(game: GameId, score: number): Promise<boolean> {
  if (score <= 0) return false;
  const scores = await getHighScores(game);
  return scores.length < CONFIG.highScoreLimit || score > (scores.at(-1)?.score ?? 0);
}

export async function saveHighScore(game: GameId, entry: HighScoreEntry): Promise<void> {
  const scores = await getHighScores(game);
  const next = [...scores, entry].sort((a, b) => b.score - a.score).slice(0, CONFIG.highScoreLimit);
  await AsyncStorage.setItem(keyFor(game), JSON.stringify(next));
}
