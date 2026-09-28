-- Pac-Man rejoint le classement en ligne.
--
-- Même mécanique que la migration 0002 : la contrainte énumère les jeux
-- autorisés, et un jeu absent voit ses scores refusés par la base alors
-- qu'ils s'enregistrent sans erreur visible sur le téléphone.
--
-- Les deux instructions sont rejouables sans risque.

alter table public.high_scores
  drop constraint if exists high_scores_game_valid;

alter table public.high_scores
  add constraint high_scores_game_valid
  check (game in ('asteroids', 'spaceInvaders', 'trackField', 'pacman'));
