-- Classement en ligne des deux jeux.
--
-- L'app mobile se connecte avec la clé *publishable* : elle est visible par
-- quiconque ouvre le bundle. Ce n'est donc pas la clé qui protège la table,
-- c'est RLS + les CHECK ci-dessous. On autorise la lecture et l'insertion à
-- tout le monde, mais jamais la modification ni la suppression, et une ligne
-- ne peut pas contenir n'importe quoi.

create table if not exists public.high_scores (
  id         bigint generated always as identity primary key,
  game       text        not null,
  initials   text        not null,
  score      integer     not null,
  created_at timestamptz not null default now(),

  constraint high_scores_game_valid     check (game in ('asteroids', 'spaceInvaders')),
  -- 1 à 3 caractères, majuscules ou chiffres : le format d'une borne d'arcade.
  constraint high_scores_initials_valid check (initials ~ '^[A-Z0-9]{1,3}$'),
  -- Borne haute volontairement large, juste de quoi écarter les valeurs absurdes.
  constraint high_scores_score_valid    check (score > 0 and score <= 100000000)
);

-- Le classement se lit toujours "meilleur score d'abord, à égalité le plus ancien".
create index if not exists high_scores_game_score_idx
  on public.high_scores (game, score desc, created_at asc);

alter table public.high_scores enable row level security;

drop policy if exists "Lecture publique du classement" on public.high_scores;
create policy "Lecture publique du classement"
  on public.high_scores for select
  to anon, authenticated
  using (true);

drop policy if exists "Insertion publique d un score" on public.high_scores;
create policy "Insertion publique d un score"
  on public.high_scores for insert
  to anon, authenticated
  with check (true);

-- Pas de policy update/delete : RLS étant actif, elles sont donc interdites.
