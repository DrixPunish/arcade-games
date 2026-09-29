import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { PacmanControls } from '../components/TouchPad';
import { HighScorePrompt } from '../components/HighScorePrompt';
import { rotateBitmap, spritePath, spritePathsByKey } from '../lib/pixelArt';
import { DOOR, POWER_PELLETS, TILE, VIEW, WALL_PATH, dotsPath } from '../games/pacman/geometry';
import { COLS } from '../games/pacman/maze';
import {
  CHERRIES,
  CHERRY_PALETTE,
  EYE,
  EYE_LOOK,
  FRIGHT_BODY,
  FRIGHT_BODY_END,
  FRIGHT_FACE,
  FRIGHT_FACE_END,
  GHOST_COLORS,
  GHOST_FRAMES,
  GHOST_PIXELS,
  PAC_CYCLE,
  PAC_DEATH,
  PAC_PIXELS,
  PAC_TURNS,
  SCARED_FACE,
  SCARED_FACE_ROW,
} from '../games/pacman/sprites';
import { Dir, Ghost, PacmanState, usePacmanGame } from '../games/pacman/usePacmanGame';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';
import { getArcadeSounds } from '../lib/gameSounds';
import { CONFIG } from '../lib/gameConfig';

/* ------------------------------------------------------------- le décor -- */

const DOT_SIZE = TILE * 0.22;
const POWER_RADIUS = TILE * 0.42;
/**
 * Sur la borne, Pac-Man fait 13 pixels pour 14 au fantôme. On garde ce
 * rapport : plus petit, il paraissait dominé par les fantômes.
 */
const PAC_RADIUS = (TILE * 1.7 * (13 / 14)) / 2;
const GHOST_PIXEL = (TILE * 1.7) / GHOST_PIXELS;
const GHOST_W = GHOST_PIXELS * GHOST_PIXEL;

/**
 * Le fruit est toujours le même sprite ; seul son emplacement varie. On calcule
 * ses tracés une fois au chargement et on ne fait plus que le translater.
 */
const CHERRY_CELL = TILE * 0.13;
const CHERRY_PATHS = Object.entries(
  spritePathsByKey(CHERRIES, 0, 0, CHERRY_CELL, CHERRY_CELL),
);
const fruitTransform = (fruit: { col: number; row: number }): string =>
  `translate(${((fruit.col + 0.5) * TILE - (12 * CHERRY_CELL) / 2).toFixed(2)}, ${(
    (fruit.row + 0.5) * TILE -
    (12 * CHERRY_CELL) / 2
  ).toFixed(2)})`;

/** Les murs ne bougent jamais : un seul tracé, calculé une fois pour toutes. */
const Walls = React.memo(function Walls(): React.ReactElement {
  return (
    <Path
      d={WALL_PATH}
      stroke="#2645ff"
      strokeWidth={TILE * 0.17}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
});

/**
 * Le tapis de gommes, en un seul `<Path>` remis à jour à la bouchée près.
 * `dotsLeft` décroît strictement : il fait une clé de mémoïsation parfaite,
 * et évite de reconstruire 240 rectangles soixante fois par seconde.
 */
const Dots = React.memo(
  function Dots({ pellets }: { pellets: Uint8Array; dotsLeft: number }): React.ReactElement {
    return <Path d={dotsPath(pellets, DOT_SIZE)} fill="#ffd6ae" />;
  },
  (a, b) => a.dotsLeft === b.dotsLeft,
);

/* ------------------------------------------------------------- fantômes -- */

/**
 * `spritePath` ne connaît que le pixel `X` ; les grilles de ce jeu nomment
 * leurs teintes (`B` le corps, `W` le visage). On les transpose une fois au
 * chargement, et les tracés sont ensuite figés.
 */
const asXs = (bitmap: readonly string[], key: string): readonly string[] =>
  bitmap.map((line) => line.split(key).join('X'));

const GHOST_BODY_PATHS = GHOST_FRAMES.map((frame) =>
  spritePath(asXs(frame, 'B'), -GHOST_W / 2, -GHOST_W / 2, GHOST_PIXEL, GHOST_PIXEL),
);
const SCARED_FACE_PATH = spritePath(
  asXs(SCARED_FACE, 'W'),
  -GHOST_W / 2,
  -GHOST_W / 2 + SCARED_FACE_ROW * GHOST_PIXEL,
  GHOST_PIXEL,
  GHOST_PIXEL,
);

function GhostSprite({
  ghost,
  frame,
  ending,
}: {
  ghost: Ghost;
  frame: 0 | 1;
  /** Dernières secondes de la super-gomme : le bleu se met à clignoter. */
  ending: boolean;
}): React.ReactElement {
  const x = ghost.col * TILE + TILE / 2;
  const y = ghost.row * TILE + TILE / 2;
  const look = EYE_LOOK[ghost.dir];
  const eyeDx = GHOST_W * EYE.offsetX;
  const eyeDy = GHOST_W * EYE.offsetY;
  const eyeR = GHOST_W * EYE.white;
  const pupilR = GHOST_W * EYE.pupil;
  const lookR = GHOST_W * EYE.look;

  const body = ghost.frightened
    ? ending
      ? FRIGHT_BODY_END
      : FRIGHT_BODY
    : GHOST_COLORS[ghost.name];

  return (
    <G transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)})`}>
      {/* Mangé : il ne reste que les yeux, qui filent vers la maison. */}
      {ghost.eyes ? null : <Path d={GHOST_BODY_PATHS[frame]} fill={body} />}

      {ghost.frightened ? (
        <Path d={SCARED_FACE_PATH} fill={ending ? FRIGHT_FACE_END : FRIGHT_FACE} />
      ) : (
        <>
          <Circle cx={-eyeDx} cy={eyeDy} r={eyeR} fill="#ffffff" />
          <Circle cx={eyeDx} cy={eyeDy} r={eyeR} fill="#ffffff" />
          <Circle
            cx={-eyeDx + look.x * lookR}
            cy={eyeDy + look.y * lookR}
            r={pupilR}
            fill="#1c1cc8"
          />
          <Circle
            cx={eyeDx + look.x * lookR}
            cy={eyeDy + look.y * lookR}
            r={pupilR}
            fill="#1c1cc8"
          />
        </>
      )}
    </G>
  );
}

/* ------------------------------------------------------------ Pac-Man ---- */

const PAC_W = PAC_RADIUS * 2;
const PAC_PIXEL = PAC_W / PAC_PIXELS;

/**
 * Les quatre directions fois les quatre images du battement, plus la séquence
 * de mort : dix-neuf tracés en tout, tous calculés au chargement. Pac-Man ne
 * coûte donc rien par image, alors qu'un secteur recalculé à chaque fois lui
 * donnait par ailleurs un air de part de tarte plutôt que de sprite.
 */
const pathOf = (bitmap: readonly string[], turns: number): string =>
  spritePath(rotateBitmap(bitmap, turns), -PAC_W / 2, -PAC_W / 2, PAC_PIXEL, PAC_PIXEL);

const PAC_PATHS: Record<Dir, string[]> = {
  right: PAC_CYCLE.map((b) => pathOf(b, PAC_TURNS.right)),
  down: PAC_CYCLE.map((b) => pathOf(b, PAC_TURNS.down)),
  left: PAC_CYCLE.map((b) => pathOf(b, PAC_TURNS.left)),
  up: PAC_CYCLE.map((b) => pathOf(b, PAC_TURNS.up)),
};
// La mort s'ouvre vers le haut, comme sur la borne.
const DEATH_PATHS = PAC_DEATH.map((b) => pathOf(b, PAC_TURNS.up));

const LIFE_ICON = spritePath(
  rotateBitmap(PAC_CYCLE[0], PAC_TURNS.right),
  -6,
  -6,
  12 / PAC_PIXELS,
  12 / PAC_PIXELS,
);

function PacSprite({ pac, dying }: { pac: PacmanState['pac']; dying: number }): React.ReactElement {
  let d: string;
  if (dying > 0) {
    const step = Math.floor((dying / CONFIG.pacman.dyingSeconds) * (DEATH_PATHS.length + 1));
    // Passé la dernière image, il ne reste plus rien à dessiner.
    d = step < DEATH_PATHS.length ? DEATH_PATHS[step] : '';
  } else {
    // Le battement suit la DISTANCE parcourue : il s'arrête donc tout seul
    // quand Pac-Man bute contre un mur, comme sur la borne.
    d = PAC_PATHS[pac.dir][Math.floor(pac.mouth * PAC_CYCLE.length) % PAC_CYCLE.length];
  }
  if (!d) return <G />;
  return (
    <G
      transform={`translate(${(pac.col * TILE + TILE / 2).toFixed(2)}, ${(
        pac.row * TILE +
        TILE / 2
      ).toFixed(2)})`}
    >
      <Path d={d} fill="#ffe600" />
    </G>
  );
}

/* --------------------------------------------------------------- écran --- */

export function PacmanGameScreen({
  onExit,
  onScores,
}: {
  onExit: () => void;
  onScores: () => void;
}): React.ReactElement {
  const { state, controls, takeEvents } = usePacmanGame();
  const [askName, setAskName] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Deux cadences d'animation qui ne dépendent PAS de la boucle de jeu : la
   * jupe des fantômes et le clignotement des super-gommes continuent pendant
   * les pauses, exactement comme sur la borne.
   */
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setBeat((b) => b + 1), 160);
    return () => clearInterval(timer);
  }, []);
  const ghostFrame = (beat % 2) as 0 | 1;
  const powerVisible = beat % 3 !== 0;

  /* --- sons --- */
  const sounds = useMemo(() => getArcadeSounds(), []);
  const wakaRef = useRef(0);
  useEffect(() => {
    const e = takeEvents();
    if (e.dot) {
      // Les deux notes du « waka waka » alternent à chaque gomme.
      wakaRef.current ^= 1;
      sounds.play(wakaRef.current ? 'pacWakaB' : 'pacWakaA');
    }
    if (e.power) sounds.play('pacPower');
    if (e.eatGhost) sounds.play('pacEatGhost');
    if (e.fruit) sounds.play('pacFruit');
    if (e.death) sounds.play('pacDeath');
    if (e.extraLife) sounds.play('pacExtraLife');
  });

  /* --- score --- */
  useEffect(() => {
    if (state.phase !== 'over') return;
    let cancelled = false;
    void qualifiesForHighScore('pacman', state.score).then((ok) => {
      if (!cancelled && ok) setAskName(true);
    });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.score]);

  const submit = useCallback(
    async (initials: string): Promise<void> => {
      setSaving(true);
      await saveHighScore('pacman', { initials, score: state.score, date: Date.now() });
      setSaving(false);
      setAskName(false);
      onScores();
    },
    [state.score, onScores],
  );

  const paused = state.status === 'paused';
  const over = state.phase === 'over';
  // Les fantômes redeviennent dangereux : le bleu se met à clignoter.
  const frightEnding = state.fright > 0 && state.fright < 2 && beat % 2 === 0;
  const dying = state.phase === 'dying' ? state.timer : 0;

  const overlayText = paused ? 'PAUSE' : over ? 'GAME OVER' : state.message;

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText}>Score {state.score}</Text>
        <Text style={styles.hudText}>Tableau {state.level}</Text>
        <View style={styles.lives}>
          {Array.from({ length: Math.min(state.lives, 5) }, (_, i) => (
            <Svg key={`life-${i}`} width={16} height={16} viewBox="-6 -6 12 12">
              <Path d={LIFE_ICON} fill="#ffe600" />
            </Svg>
          ))}
        </View>
      </View>

      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} width="100%" height="100%">
          <Rect x={0} y={0} width={VIEW.width} height={VIEW.height} fill="#04060f" />

          <Walls />

          {/* La porte de la maison : franchissable par les seuls fantômes. */}
          <Rect
            x={DOOR.from * TILE}
            y={(DOOR.row + 0.42) * TILE}
            width={(DOOR.to - DOOR.from) * TILE}
            height={TILE * 0.16}
            fill="#ffb7ff"
          />

          <Dots pellets={state.pellets} dotsLeft={state.dotsLeft} />

          {powerVisible
            ? POWER_PELLETS.map((p) => (
                <Circle
                  key={`power-${p.col}-${p.row}`}
                  cx={(p.col + 0.5) * TILE}
                  cy={(p.row + 0.5) * TILE}
                  r={POWER_RADIUS}
                  fill={state.pellets[p.row * COLS + p.col] === 2 ? '#ffd6ae' : 'transparent'}
                />
              ))
            : null}

          {state.fruit ? (
            <G transform={fruitTransform(state.fruit)}>
              {CHERRY_PATHS.map(([key, d]) => (
                <Path key={`fruit-${key}`} d={d} fill={CHERRY_PALETTE[key] ?? '#fff'} />
              ))}
            </G>
          ) : null}

          {/* Pac-Man disparaît pendant que les fantômes regagnent leur place. */}
          {state.phase === 'clear' ? null : <PacSprite pac={state.pac} dying={dying} />}

          {state.phase === 'dying'
            ? null
            : state.ghosts.map((g) => (
                <GhostSprite key={g.name} ghost={g} frame={ghostFrame} ending={frightEnding} />
              ))}

          {state.popup ? (
            <SvgText
              x={state.popup.col * TILE + TILE / 2}
              y={state.popup.row * TILE + TILE / 2 + 3}
              fill="#72fbff"
              fontSize={9}
              fontWeight="bold"
              textAnchor="middle"
            >
              {state.popup.text}
            </SvgText>
          ) : null}
        </Svg>

        {overlayText ? (
          <View pointerEvents={paused || over ? 'auto' : 'none'} style={styles.overlay}>
            <Text style={[styles.overTitle, !paused && !over && styles.readyTitle]}>
              {overlayText}
            </Text>
            {paused || over ? (
              <>
                <ArcadeButton
                  label={paused ? 'Reprendre' : 'Rejouer'}
                  onPress={paused ? controls.pause : controls.restart}
                />
                <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      <PacmanControls onSteer={controls.steer} />

      <View style={styles.bottom}>
        <ArcadeButton label="Pause" onPress={controls.pause} fullWidth />
      </View>

      <HighScorePrompt
        visible={askName}
        saving={saving}
        onSubmit={(initials) => void submit(initials)}
        onDismiss={() => setAskName(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, alignItems: 'center' },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 8,
  },
  hudText: { color: '#ffe083', fontWeight: '900' },
  lives: { flexDirection: 'row', gap: 3 },
  stage: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(98,246,255,0.28)',
  },
  bottom: { width: '100%', maxWidth: 620, flexDirection: 'row' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  overTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 28,
    textAlign: 'center',
  },
  readyTitle: { color: '#ffe083', fontSize: 22 },
});
