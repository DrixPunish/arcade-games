import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { ArcadeButton } from '../components/ArcadeButton';
import { AsteroidsControls } from '../components/TouchPad';
import { HighScorePrompt } from '../components/HighScorePrompt';
import { AsteroidsSprite, type AsteroidsSpriteKey } from '../components/AsteroidsSprite';
import { ASTEROIDS_DIMENSIONS, useAsteroidsGame } from '../games/asteroids/useAsteroidsGame';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';
import { getAsteroidsSounds } from '../lib/asteroidsSounds';

const LARGE_SPRITES: AsteroidsSpriteKey[] = ['asteroidLarge1', 'asteroidLarge2', 'asteroidLarge3'];
const MEDIUM_SPRITES: AsteroidsSpriteKey[] = ['asteroidMedium1', 'asteroidMedium2', 'asteroidMedium3'];
const SMALL_SPRITES: AsteroidsSpriteKey[] = ['asteroidSmall1', 'asteroidSmall2', 'asteroidSmall3'];

const pickSprite = (id: string, pool: AsteroidsSpriteKey[]): AsteroidsSpriteKey => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
};

export function AsteroidsGameScreen({
  onExit,
  onScores,
}: {
  onExit: () => void;
  onScores: () => void;
}): React.ReactElement {
  const { state, controls } = useAsteroidsGame();
  const [askName, setAskName] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const sounds = useMemo(() => {
    try {
      return getAsteroidsSounds();
    } catch (e) {
      console.warn('[AsteroidsGameScreen] failed to get audio manager', e);
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      sounds?.init();
    } catch (e) {
      console.warn('[AsteroidsGameScreen] audio init failed', e);
    }
    return () => {
      try {
        sounds?.stopAllLoops();
      } catch {}
    };
  }, [sounds]);

  // --- Sound event detection ---
  const prevAsteroidsRef = useRef(state.asteroids);
  const prevSaucersRef = useRef(state.saucers);
  const prevDeathRef = useRef(state.death.active);
  const prevLivesRef = useRef(state.lives);
  const prevLevelRef = useRef(state.level);

  useEffect(() => {
    const mgr = sounds;
    if (!mgr) return;
    try {
      // Asteroid destroyed -> bang based on previous size.
      // On saute la comparaison quand le champ entier est remplacé (restart,
      // niveau suivant) : sinon toute la liste « disparaît » d'un coup et on
      // déclencherait une dizaine d'explosions simultanées.
      const fieldReplaced = state.level !== prevLevelRef.current;
      prevLevelRef.current = state.level;
      if (!fieldReplaced) {
        const prev = prevAsteroidsRef.current;
        const currentIds = new Set(state.asteroids.map((a) => a.id));
        for (const old of prev) {
          if (!currentIds.has(old.id)) {
            if (old.size === 'large') mgr.play('bangLarge');
            else if (old.size === 'medium') mgr.play('bangMedium');
            else mgr.play('bangSmall');
          }
        }
      }
      prevAsteroidsRef.current = state.asteroids;

      // Saucer presence -> loop sound
      const hasBig = state.saucers.some((s) => s.kind === 'large');
      const hasSmall = state.saucers.some((s) => s.kind === 'small');
      mgr.setLoop('saucerBig', hasBig);
      mgr.setLoop('saucerSmall', hasSmall);

      // Saucer destroyed
      const prevSaucers = prevSaucersRef.current;
      if (prevSaucers.length > state.saucers.length) {
        mgr.play('bangMedium');
      }
      prevSaucersRef.current = state.saucers;

      // Ship death
      if (!prevDeathRef.current && state.death.active) {
        mgr.play('bangLarge');
        mgr.setLoop('thrust', false);
      }
      prevDeathRef.current = state.death.active;

      // Extra life
      if (state.lives > prevLivesRef.current) {
        mgr.play('extraShip');
      }
      prevLivesRef.current = state.lives;
    } catch (e) {
      console.warn('[AsteroidsGameScreen] sound effect error', e);
    }
  }, [sounds, state.asteroids, state.saucers, state.death.active, state.lives, state.level]);

  useEffect(() => {
    if (state.status === 'gameOver') {
      try { sounds?.stopAllLoops(); } catch {}
      void qualifiesForHighScore('asteroids', state.score).then(setAskName).catch(() => {});
    }
  }, [sounds, state.status, state.score]);

  const submit = useCallback(
    async (initials: string): Promise<void> => {
      setSaving(true);
      await saveHighScore('asteroids', { initials, score: state.score, date: Date.now() });
      setSaving(false);
      setAskName(false);
      onScores();
    },
    [state.score, onScores],
  );

  // --- Wrap controls to drive sounds ---
  const [thrusting, setThrusting] = useState<boolean>(false);
  const wrappedThrust = useCallback(
    (active: boolean) => {
      setThrusting(active);
      try { sounds?.setLoop('thrust', active && !prevDeathRef.current); } catch {}
      controls.thrust(active);
    },
    [sounds, controls],
  );

  const wrappedFire = useCallback(() => {
    try { sounds?.play('fire'); } catch {}
    controls.fire();
  }, [sounds, controls]);

  const wrappedHyperspace = useCallback(() => {
    try { sounds?.play('bangSmall'); } catch {}
    controls.hyperspace();
  }, [sounds, controls]);

  // --- Stage layout / scaling ---
  const onStageLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize({ w: width, h: height });
  }, []);

  const scale = useMemo(() => {
    if (!stageSize.w || !stageSize.h) return 1;
    return Math.min(stageSize.w / ASTEROIDS_DIMENSIONS.W, stageSize.h / ASTEROIDS_DIMENSIONS.H);
  }, [stageSize]);

  const fieldW = ASTEROIDS_DIMENSIONS.W * scale;
  const fieldH = ASTEROIDS_DIMENSIONS.H * scale;
  const offX = (stageSize.w - fieldW) / 2;
  const offY = (stageSize.h - fieldH) / 2;

  const renderAsteroid = (a: typeof state.asteroids[number]) => {
    const pool = a.size === 'large' ? LARGE_SPRITES : a.size === 'medium' ? MEDIUM_SPRITES : SMALL_SPRITES;
    const spriteKey = pickSprite(a.id, pool);
    const visualSize = a.r * 2.2 * scale;
    return (
      <View
        key={a.id}
        style={{
          position: 'absolute',
          left: offX + a.x * scale - visualSize / 2,
          top: offY + a.y * scale - visualSize / 2,
        }}
      >
        <AsteroidsSprite spriteKey={spriteKey} size={visualSize} />
      </View>
    );
  };

  const shipVisualSize = 38 * scale;
  const shipBlinking =
    state.ship.invincible > 0 && Math.floor(state.ship.invincible * 10) % 2 === 0;

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText}>Score {state.score}</Text>
        <Text style={styles.hudText}>Vies {state.lives}</Text>
        <Text style={styles.hudText}>Niveau {state.level}</Text>
      </View>

      <View style={styles.stage} onLayout={onStageLayout}>
        {scale > 0 && (
          <>
            {state.asteroids.map(renderAsteroid)}

            {state.saucers.map((sc) => {
              const saucerSize = (sc.kind === 'small' ? 32 : 46) * scale;
              const saucerH = saucerSize * (80 / 96);
              return (
                <View
                  key={sc.id}
                  style={{
                    position: 'absolute',
                    left: offX + sc.x * scale - saucerSize / 2,
                    top: offY + sc.y * scale - saucerH / 2,
                  }}
                >
                  <AsteroidsSprite spriteKey="saucer" size={saucerSize} />
                </View>
              );
            })}

            {state.bullets.map((b) => {
              const bSize = (b.enemy ? 7 : 6) * scale;
              return (
                <View
                  key={b.id}
                  style={{
                    position: 'absolute',
                    left: offX + b.x * scale - bSize / 2,
                    top: offY + b.y * scale - bSize / 2,
                    width: bSize,
                    height: bSize,
                    borderRadius: bSize / 2,
                    backgroundColor: b.enemy ? '#ff4778' : '#ffffff',
                    shadowColor: b.enemy ? '#ff4778' : '#ffffff',
                    shadowOpacity: 0.9,
                    shadowRadius: 4,
                  }}
                />
              );
            })}

            {!state.death.active && !shipBlinking && (
              <View
                style={{
                  position: 'absolute',
                  left: offX + state.ship.x * scale - shipVisualSize / 2,
                  top: offY + state.ship.y * scale - shipVisualSize / 2,
                  width: shipVisualSize,
                  height: shipVisualSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AsteroidsSprite
                  spriteKey={thrusting ? 'shipThrust' : 'ship'}
                  size={shipVisualSize}
                  rotation={state.ship.angle}
                />
              </View>
            )}

            {state.death.active && (
              <View
                style={{
                  position: 'absolute',
                  left: offX + state.death.x * scale - (40 + state.death.t * 60) / 2,
                  top: offY + state.death.y * scale - (40 + state.death.t * 60) / 2,
                  width: 40 + state.death.t * 60,
                  height: 40 + state.death.t * 60,
                  borderRadius: (40 + state.death.t * 60) / 2,
                  borderWidth: 3,
                  borderColor: '#ff4778',
                  opacity: Math.max(0, 1 - state.death.t),
                }}
              />
            )}
          </>
        )}

        {state.status !== 'running' && (
          <View style={styles.overlay}>
            <Text style={styles.overTitle}>
              {state.status === 'paused' ? 'PAUSE' : 'GAME OVER'}
            </Text>
            <ArcadeButton
              label={state.status === 'paused' ? 'Reprendre' : 'Rejouer'}
              onPress={state.status === 'paused' ? controls.pause : controls.restart}
            />
            <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
          </View>
        )}
      </View>

      <AsteroidsControls
        onRotateLeft={controls.rotateLeft}
        onRotateRight={controls.rotateRight}
        onThrust={wrappedThrust}
        onFire={wrappedFire}
        onHyperspace={wrappedHyperspace}
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
  container: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 8,
  },
  hudText: {
    color: '#ffe083',
    fontWeight: '900',
  },
  stage: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#04070f',
    borderWidth: 1,
    borderColor: 'rgba(98,246,255,0.28)',
  },
  bottom: {
    width: '100%',
    maxWidth: 620,
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
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
  overTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 28,
    textAlign: 'center',
  },
});
