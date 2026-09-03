import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { InvadersControls } from '../components/TouchPad';
import { HighScorePrompt } from '../components/HighScorePrompt';
import {
  BunkerBlock,
  Explosion,
  INVADERS_DIMENSIONS,
  Invader,
  useSpaceInvadersGame,
} from '../games/space-invaders/useSpaceInvadersGame';
import {
  CANNON,
  EXPLOSION,
  INVADER_SPRITES,
  SAUCER,
  spritePath,
} from '../games/space-invaders/sprites';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';

const D = INVADERS_DIMENSIONS;

const INVADER_COLOR = { squid: '#ff7a9c', crab: '#ffe083', octopus: '#72fbff' } as const;

/**
 * Les ~55 envahisseurs et les ~250 morceaux de bunker ne changent pas à chaque
 * frame : le moteur conserve la référence de leurs tableaux tant que rien ne
 * les touche. Isolés derrière un memo, ils ne sont retracés que sur les frames
 * où ils bougent vraiment. Chaque envahisseur et chaque bunker est un unique
 * `<Path>`, pas un nœud par pixel.
 */
const Invaders = React.memo(function Invaders({
  invaders,
  animFrame,
}: {
  invaders: Invader[];
  animFrame: 0 | 1;
}): React.ReactElement {
  return (
    <>
      {invaders
        .filter((i) => i.alive)
        .map((i) => (
          <Path
            key={i.id}
            d={spritePath(
              INVADER_SPRITES[i.kind][animFrame],
              i.x,
              i.y,
              D.INVADER_PIXEL,
              D.INVADER_PIXEL,
            )}
            fill={INVADER_COLOR[i.kind]}
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
  // Un seul tracé pour tous les morceaux encore debout : quatre bunkers
  // deviennent un nœud unique au lieu de ~250.
  const d = useMemo(
    () =>
      bunkers
        .filter((b) => b.alive)
        .map(
          (b) =>
            `M${b.x} ${b.y}h${D.BUNKER_PIXEL}v${D.BUNKER_PIXEL}h${-D.BUNKER_PIXEL}z`,
        )
        .join(''),
    [bunkers],
  );
  return <Path d={d} fill="#46e68c" />;
});

const Explosions = React.memo(function Explosions({
  explosions,
}: {
  explosions: Explosion[];
}): React.ReactElement {
  return (
    <>
      {explosions.map((e) => (
        <Path
          key={e.id}
          d={spritePath(EXPLOSION, e.x - 13, e.y - 8, 2, 2)}
          fill="#fff2b0"
          opacity={0.9}
        />
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

  // Le canon clignote pendant son invincibilité de réapparition.
  const playerVisible = state.invincible <= 0 || Math.floor(state.invincible * 10) % 2 === 0;
  const paused = state.status === 'paused';

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText}>Score {state.score}</Text>
        <Text style={styles.hudText}>Vies {state.lives}</Text>
        <Text style={styles.hudText}>Vague {state.wave}</Text>
      </View>

      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${D.W} ${D.H}`} width="100%" height="100%">
          <Rect x={0} y={0} width={D.W} height={D.H} fill="#04070f" />

          {state.ufo.active ? (
            <Path
              d={spritePath(
                SAUCER,
                state.ufo.x - D.UFO_W / 2,
                state.ufo.y - D.UFO_H / 2,
                D.UFO_PIXEL,
                D.UFO_PIXEL,
              )}
              fill="#ff4778"
            />
          ) : null}

          <Invaders invaders={state.invaders} animFrame={state.animFrame} />
          <Bunkers bunkers={state.bunkers} />

          {playerVisible ? (
            <Path
              d={spritePath(
                CANNON,
                state.playerX - D.PLAYER_W / 2,
                D.PLAYER_Y - D.PLAYER_H / 2,
                D.PLAYER_PIXEL,
                D.PLAYER_PIXEL,
              )}
              fill="#eaffff"
            />
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
            <Rect
              key={`enemy-bullet-${i}`}
              x={b.x - D.BULLET_W / 2}
              y={b.y}
              width={D.BULLET_W}
              height={D.BULLET_H}
              fill="#ffb000"
            />
          ))}

          <Explosions explosions={state.explosions} />

          {/* Sol : la ligne que les envahisseurs ne doivent pas atteindre. */}
          <Rect x={0} y={D.PLAYER_Y + D.PLAYER_H} width={D.W} height={2} fill="#46e68c" />
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

      <InvadersControls onLeft={controls.left} onRight={controls.right} onFire={controls.fire} />

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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overTitle: { color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' },
});
