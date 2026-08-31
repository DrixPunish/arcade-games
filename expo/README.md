# Arcade Games

Remakes de bornes d'arcade classiques, en React Native (Expo). Deux jeux jouables
aujourd'hui — **Asteroids** et **Space Invaders** — et un emplacement réservé pour
**Olympic Summer Games**.

L'app tourne sur iOS, Android et dans le navigateur.

## Démarrer

Prérequis : Node.js et [Bun](https://bun.sh/docs/installation).

```bash
bun install       # dépendances
bun run start     # serveur de dev + QR code pour Expo Go
bun run start-web # aperçu navigateur
```

Contrôles qualité :

```bash
bunx tsc --noEmit   # types
bun run lint        # ESLint
```

## Structure

```
expo/
├── app/                          # routage Expo Router
│   ├── _layout.tsx               # layout racine (QueryClient + gestures)
│   ├── index.tsx                 # unique route, réexporte App.tsx
│   ├── +not-found.tsx            # écran 404
│   └── +native-intent.tsx        # deep links → "/"
├── App.tsx                       # routeur interne (hub / menus / jeux / scores)
├── screens/
│   ├── HubScreen.tsx             # choix du jeu
│   ├── GameMenuScreen.tsx        # jouer / scores / retour
│   ├── HighScoresScreen.tsx      # top 10 par jeu
│   ├── AsteroidsGameScreen.tsx   # rendu Asteroids (sprites + sons)
│   └── SpaceInvadersGameScreen.tsx # rendu Space Invaders (SVG)
├── games/
│   ├── asteroids/useAsteroidsGame.ts        # moteur Asteroids
│   └── space-invaders/useSpaceInvadersGame.ts # moteur Space Invaders
├── components/
│   ├── ArcadeButton.tsx          # bouton commun à tous les écrans
│   ├── ControlButton.tsx         # bouton de contrôle (Space Invaders)
│   ├── HighScorePrompt.tsx       # saisie des initiales en fin de partie
│   ├── TouchPad.tsx              # pavé multi-touch (Asteroids)
│   └── AsteroidsSprite.tsx       # découpe de la sprite sheet
├── hooks/useGameLoop.ts          # boucle requestAnimationFrame (delta en s)
├── lib/
│   ├── gameConfig.ts             # TOUS les réglages de gameplay
│   ├── math.ts                   # vecteurs, wrap, collisions, ids
│   ├── highScores.ts             # classement local (AsyncStorage) + en ligne
│   ├── supabase.ts               # client Supabase, null si non configuré
│   └── asteroidsSounds.ts        # sons synthétisés (Web Audio / expo-audio)
└── assets/
    ├── images/asteroids/         # sprite sheet + planche annotée
    └── sounds/                   # échantillons .mp3 (non utilisés, cf. Sons)
```

### Comment un jeu est construit

Chaque jeu suit le même découpage :

1. **Un hook moteur** (`games/<jeu>/use<Jeu>Game.ts`) détient tout l'état et
   applique une mise à jour par frame via `useGameLoop`. Il ne dessine rien.
2. **Un écran** (`screens/<Jeu>GameScreen.tsx`) lit cet état et l'affiche. Il ne
   décide de rien.
3. **`lib/gameConfig.ts`** contient les constantes de réglage : c'est là qu'on
   ajuste la difficulté, les vitesses, le nombre de vies.

Le terrain de jeu fait toujours 360 × 560 unités logiques ; l'écran met à
l'échelle. Les positions sont donc indépendantes de la taille de l'appareil.

## Classement en ligne

Les high scores sont écrits **deux fois** : dans `AsyncStorage` (classement du
téléphone, disponible hors ligne) et dans une table Supabase (classement
partagé). L'écran des scores propose les deux onglets. Si le réseau est absent
ou Supabase injoignable, l'onglet « En ligne » le dit et le jeu continue de
fonctionner normalement — rien de tout ça n'est bloquant.

La configuration est dans `app.json` → `expo.extra.supabase`, pas dans un
`.env` : la clé *publishable* est inlinée dans le bundle et donc publique de
toute façon. Ce qui protège la table, c'est **RLS** (`supabase/migrations/`) :
lecture et insertion ouvertes à tous, modification et suppression interdites, et
des contraintes `CHECK` sur le jeu, les initiales et le score. Les variables
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sont
prioritaires si on veut viser un autre projet le temps d'un test.

Appliquer une migration : coller le fichier `supabase/migrations/*.sql` dans le
SQL Editor du dashboard Supabase.

## Sons

Les sons d'Asteroids sont **synthétisés à la volée**, pas lus depuis un fichier :

- sur le web, via l'API Web Audio ;
- sur mobile, en générant un WAV encodé en base64 joué par `expo-audio`.

Les `.mp3` de `assets/sounds/` sont hérités d'une première version et ne sont
plus référencés. Ils sont conservés au cas où l'on préférerait revenir à de vrais
échantillons — il suffirait alors de remplacer les backends de
`lib/asteroidsSounds.ts`.

## Sprite sheet

`assets/images/asteroids/sprites.png` (512 × 320) vient de Joe Strout
(miniscript.org). `sprites-grid.png` est la même planche avec les découpes
annotées : c'est la référence pour toute modification des coordonnées dans
`components/AsteroidsSprite.tsx`.

## Tester sur Expo Go

Le projet est publié sur EAS Update, compte Expo **`drixpunish-2`**, projet
[`arcade`](https://expo.dev/accounts/drixpunish-2/projects/arcade), canal
**`preview`** (runtime `exposdk:54.0.0`).

Sur le téléphone : installer **Expo Go**, s'y connecter avec le compte
`drixpunish-2` (depuis mai 2026 Expo n'ouvre que les projets dont on est
propriétaire), puis ouvrir :

```
exp://u.expo.dev/40373d0b-f784-425b-a19f-2800954daeb5?channel-name=preview
```

Le QR code correspondant est dans `url-expo-go.txt`, à la racine du dépôt.

### Publier une mise à jour

Après tout changement de code JS, depuis `expo/` :

```bash
eas update --branch preview --message "<résumé>"
```

Le testeur récupère la nouvelle version en rouvrant le lien. C'est de l'OTA :
valable pour le **JS pur**. Ajouter une dépendance **native** (ou changer la
config native d'`app.json`) exige un `eas build`, un update ne suffit pas.

## Documentation

[docs.expo.dev](https://docs.expo.dev/) pour Expo,
[reactnative.dev](https://reactnative.dev/docs/getting-started) pour les
composants de base.
