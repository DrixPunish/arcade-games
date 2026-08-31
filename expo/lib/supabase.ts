import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseSettings = { url?: string; publishableKey?: string };

/**
 * La configuration vit dans `app.json` (`expo.extra.supabase`) plutôt que dans
 * un `.env` : la clé *publishable* est de toute façon inlinée dans le bundle et
 * lisible par n'importe qui, il n'y a donc rien à cacher. La versionner évite
 * de publier un update sans configuration, silencieusement privé de classement.
 * Ce qui protège réellement la table, c'est RLS (cf. supabase/migrations/).
 *
 * Les variables d'environnement restent prioritaires si on veut pointer vers un
 * autre projet le temps d'un test.
 */
const settings = (Constants.expoConfig?.extra?.supabase ?? {}) as SupabaseSettings;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? settings.url;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? settings.publishableKey;

export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

/** Le classement en ligne est-il configuré ? (sinon l'app reste jouable en local) */
export const isOnlineEnabled = supabase !== null;

/**
 * Abandonne une requête réseau au bout de `ms`. Sans ça, un réseau capricieux
 * fige l'écran de fin de partie au lieu de retomber sur le classement local.
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  ms: number,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
