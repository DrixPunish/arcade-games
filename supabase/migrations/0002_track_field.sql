-- Track & Field rejoint le classement en ligne.
--
-- La contrainte d'origine n'acceptait que les deux premiers jeux : sans cette
-- migration, les scores de Track & Field sont bien enregistrés sur le téléphone
-- mais refusés par la base, et l'onglet « En ligne » reste vide pour ce jeu.

alter table public.high_scores
  drop constraint if exists high_scores_game_valid;

alter table public.high_scores
  add constraint high_scores_game_valid
  check (game in ('asteroids', 'spaceInvaders', 'trackField'));
