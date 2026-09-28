# La suite de tests

```sh
bun run test
```

72 contrôles sur les quatre moteurs de jeu. Ils tournent en quelques
secondes et ne demandent ni téléphone, ni émulateur, ni réseau.

## Comment ça marche

Les moteurs sont des hooks React (`useAsteroidsGame`, `usePacmanGame`…),
mais ils n'utilisent de React que `useState`, `useRef` et `useCallback`.
Chaque fichier de test remplace donc ces trois fonctions par une version
minimale, et remplace `useGameLoop` par un déclencheur manuel. On obtient
un jeu qu'on fait avancer image par image, sans rien afficher :

```ts
const g = mount();
g.begin();          // passe le « READY! »
g.controls.steer('left');
g.step(60);         // une seconde de jeu
expect(g.state.score).toBe(…);
```

C'est ce qui permet de vérifier des choses qu'on ne verrait jamais à
l'œil : que Pac-Man ne traverse aucun mur après quarante secondes de
pilotage aléatoire, que les dix haies se franchissent à toutes les
cadences de martèlement, ou qu'un bot qui mange tout finit bien le
tableau.

## Deux règles à ne pas enfreindre

**Aucun test n'écrit dans la base Supabase de production.** Les scores de
test finiraient dans le classement en ligne que voient les joueurs.
`highscores.test.ts` remplace le client `@supabase/supabase-js` par un
faux ; seule une lecture touche le vrai projet.

**Une cadence de martèlement doit rester humaine.** Un harnais qui tapait
trente fois par seconde avait validé un réglage de Track & Field
parfaitement injouable à la main. Les tests de cadence s'expriment donc
en appuis par seconde, entre 5 et 11.
