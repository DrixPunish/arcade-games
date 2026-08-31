import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { InvadersControls } from '../components/TouchPad';
import { HighScorePrompt } from '../components/HighScorePrompt';
import {
  BunkerBlock,
  INVADERS_DIMENSIONS,
  Invader,
  useSpaceInvadersGame,
} from '../games/space-invaders/useSpaceInvadersGame';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';

const D = INVADERS_DIMENSIONS;

/**
 * Les ~55 envahisseurs et ~80 blocs de bunker ne bougent pas à chaque frame :
 * le moteur conserve la référence de leurs tableaux tant que rien ne change.
 * En les isolant derrière un memo, React ne rejoue ces 135 nœuds SVG que sur
 * les frames où ils bougent vraiment — le reste du temps seuls le joueur, les
 * tirs et l'OVNI sont redessinés.
 */
const Invaders = React.memo(function Invaders({
  invaders,
}: {
  invaders: Invader[];
}): React.ReactElement {
  return (
    <>
      {invaders
        .filter((i) => i.alive)
        .map((i) => (
          <Rect
            key={i.id}
            x={i.x}
            y={i.y}
            width={D.INVADER_W}
            height={D.INVADER_H}
            rx={4}
            fill={i.points === 30 ? '#ff7a9c' : i.points === 20 ? '#ffe083' : '#72fbff'}
          />
        ))}
    </>
  );
});

const Bunkers = React.memo(function Bunkers({
  bunkers,
}: {
  bunkers: BunkerBlock[];
}): React.ReactElement {
  return (
    <>
      {bunkers
        .filter((b) => b.alive)
        .map((b) => (
          <Rect key={b.id} x={b.x} y={b.y} width={D.BLOCK - 1} height={D.BLOCK - 1} fill="#46e68c" />
        ))}
    </>
  );
});

export function SpaceInvadersGameScreen({
  onExit,
  onScores,
}: {
  onExit: () => void;
  onScores: () => void;
}): React.ReactElement {
  const { state, controls } = useSpaceInvadersGame();
  const [askName, setAskName] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (state.status !== 'gameOver') return;
    let cancelled = false;
    void qualifiesForHighScore('spaceInvaders', state.score).then((ok) => {
      if (!cancelled) setAskName(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.score]);

  const submit = useCallback(
    async (initials: string): Promise<void> => {
      setSaving(true);
      await saveHighScore('spaceInvaders', { initials, score: state.score, date: Date.now() });
      setSaving(false);
      setAskName(false);
      onScores();
    },
    [state.score, onScores],
  );

  // Le joueur clignote pendant son invincibilité de réapparition.
  const playerVisible = state.invincible <= 0 || Math.floor(state.invincible * 10) % 2 === 0;
  const paused = state.status === 'paused';

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText}>Score {state.score}</Text>
        <Text style={styles.hudText}>Vies {state.lives}</Text>
        <Text style={styles.hudText}>Wave {state.wave}</Text>
      </View>

      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${D.W} ${D.H}`} width="100%" height="100%">
          <Rect
            x={0}
            y={0}
            width={D.W}
            height={D.H}
            fill="rgba(0,0,0,0.25)"
            stroke="#24536b"
            strokeWidth={2}
          />

          {state.ufo.active ? (
            <Rect
              x={state.ufo.x - D.UFO_W / 2}
              y={state.ufo.y - D.UFO_H / 2}
              width={D.UFO_W}
              height={D.UFO_H}
              rx={8}
              fill="#ff4778"
            />
          ) : null}

          <Invaders invaders={state.invaders} />
          <Bunkers bunkers={state.bunkers} />

          {playerVisible ? (
            <>
              <Rect
                x={state.playerX - D.PLAYER_W / 2}
                y={D.PLAYER_Y - D.PLAYER_H / 2}
                width={D.PLAYER_W}
                height={D.PLAYER_H}
                rx={3}
                fill="#eaffff"
              />
              <Rect
                x={state.playerX - 4}
                y={D.PLAYER_Y - D.PLAYER_H / 2 - 10}
                width={8}
                height={12}
                fill="#eaffff"
              />
            </>
          ) : null}

          {state.playerBullet ? (
            <Rect
              x={state.playerBullet.x - D.BULLET_W / 2}
              y={state.playerBullet.y}
              width={D.BULLET_W}
              height={D.BULLET_H}
              fill="#fff"
            />
          ) : null}

          {state.enemyBullets.map((b, i) => (
            <Circle key={`enemy-bullet-${i}`} cx={b.x} cy={b.y} r={3} fill="#ffb000" />
          ))}
        </Svg>

        {state.status !== 'running' ? (
          <View style={styles.overlay}>
            <Text style={styles.overTitle}>{paused ? 'PAUSE' : 'GAME OVER'}</Text>
            <ArcadeButton
              label={paused ? 'Reprendre' : 'Rejouer'}
              onPress={paused ? controls.pause : controls.restart}
            />
            <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
          </View>
        ) : null}
      </View>

      <InvadersControls
        onLeft={controls.left}
        onRight={controls.right}
        onFire={controls.fire}
      />

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
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 8,
  },
  hudText: { color: '#ffe083', fontWeight: '900' },
  stage: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bottom: { width: '100%', maxWidth: 620, flexDirection: 'row' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overTitle: { color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' },
});
