import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { ControlButton } from '../components/ControlButton';
import { INVADERS_DIMENSIONS, useSpaceInvadersGame } from '../games/space-invaders/useSpaceInvadersGame';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';

const D = INVADERS_DIMENSIONS;

export function SpaceInvadersGameScreen({
  onExit,
  onScores,
}: {
  onExit: () => void;
  onScores: () => void;
}): React.ReactElement {
  const { state, controls } = useSpaceInvadersGame();
  const [initials, setInitials] = useState<string>('AAA');
  const [askName, setAskName] = useState<boolean>(false);

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

  const submit = useCallback(async (): Promise<void> => {
    await saveHighScore('spaceInvaders', {
      initials: initials.slice(0, 3).toUpperCase(),
      score: state.score,
      date: Date.now(),
    });
    setAskName(false);
    onScores();
  }, [initials, state.score, onScores]);

  // Le joueur clignote pendant son invincibilité de réapparition.
  const playerVisible = state.invincible <= 0 || Math.floor(state.invincible * 10) % 2 === 0;

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

          {state.invaders
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

          {state.bunkers
            .filter((b) => b.alive)
            .map((b) => (
              <Rect
                key={b.id}
                x={b.x}
                y={b.y}
                width={D.BLOCK - 1}
                height={D.BLOCK - 1}
                fill="#46e68c"
              />
            ))}

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
            <Text style={styles.overTitle}>{state.status === 'paused' ? 'PAUSE' : 'GAME OVER'}</Text>
            <ArcadeButton
              label={state.status === 'paused' ? 'Reprendre' : 'Rejouer'}
              onPress={state.status === 'paused' ? controls.pause : controls.restart}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <View style={styles.row}>
          <ControlButton label="←" onDown={() => controls.left(true)} onUp={() => controls.left(false)} />
          <ControlButton label="→" onDown={() => controls.right(true)} onUp={() => controls.right(false)} />
        </View>
        <View style={styles.row}>
          <ControlButton label="Pause" onPress={controls.pause} />
          <ControlButton label="Tirer" onPress={controls.fire} wide />
        </View>
      </View>

      <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />

      <Modal transparent visible={askName} onRequestClose={() => setAskName(false)}>
        <View style={styles.modal}>
          <View style={styles.card}>
            <Text style={styles.overTitle}>Nouveau high score</Text>
            <TextInput
              value={initials}
              onChangeText={setInitials}
              maxLength={3}
              autoCapitalize="characters"
              style={styles.input}
            />
            <ArcadeButton label="Enregistrer" onPress={() => void submit()} />
          </View>
        </View>
      </Modal>
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
  controls: {
    width: '100%',
    maxWidth: 620,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: { flexDirection: 'row' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overTitle: { color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#071426',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#72fbff',
    gap: 16,
    alignItems: 'center',
  },
  input: {
    color: '#fff',
    borderBottomWidth: 2,
    borderColor: '#ffe083',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    minWidth: 130,
    textAlign: 'center',
  },
});
