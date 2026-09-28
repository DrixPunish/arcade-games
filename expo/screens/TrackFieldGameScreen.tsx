import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { HighScorePrompt } from '../components/HighScorePrompt';
import { TrackFieldControls } from '../components/TouchPad';
import { CONFIG } from '../lib/gameConfig';
import { spritePath } from '../lib/pixelArt';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';
import {
  EVENT_LABEL,
  EVENT_ORDER,
  EVENT_UNIT,
  TRACK_DIMENSIONS,
  isFieldEvent,
  useTrackFieldGame,
} from '../games/track-field/useTrackFieldGame';
import { ATHLETE_JUMP, JAVELIN, RUN_FRAMES } from '../games/track-field/sprites';

/** Terrain logique : 360 de large, sol à 150, comme les autres jeux. */
const W = 360;
const H = 190;
const GROUND = 150;
const PX_PER_M = 9;
const ATHLETE_PIXEL = 3;
/** Repères tous les 10 m, calculés une seule fois. */
const MARKERS = Array.from({ length: 24 }, (_, i) => i * 10);

export function TrackFieldGameScreen({
  onExit,
  onScores,
}: {
  onExit: () => void;
  onScores: () => void;
}): React.ReactElement {
  const { state, controls } = useTrackFieldGame();
  const [askName, setAskName] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const event = EVENT_ORDER[state.eventIndex] ?? 'dash100';
  const unit = EVENT_UNIT[event];
  const target = CONFIG.trackField.qualify[event];

  useEffect(() => {
    if (state.status !== 'gameOver') return;
    let cancelled = false;
    void qualifiesForHighScore('trackField', state.score).then((ok) => {
      if (!cancelled) setAskName(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.score]);

  const submit = useCallback(
    async (initials: string): Promise<void> => {
      setSaving(true);
      await saveHighScore('trackField', { initials, score: state.score, date: Date.now() });
      setSaving(false);
      setAskName(false);
      onScores();
    },
    [state.score, onScores],
  );

  // --- Caméra : l'athlète reste au tiers gauche de l'écran ---
  const athleteWorld = state.phase === 'flying' ? TRACK_DIMENSIONS.RUNWAY_LENGTH : state.runDistance;
  const camera = Math.max(0, athleteWorld - 12);
  const toScreen = (metres: number): number => (metres - camera) * PX_PER_M + 40;

  const running = state.phase === 'running' || state.phase === 'ready';
  const frame = RUN_FRAMES[Math.floor(state.runDistance * 2.2) % RUN_FRAMES.length];
  const inAir = state.airborne || state.phase === 'flying';
  const athleteBitmap = inAir ? ATHLETE_JUMP : running ? frame : RUN_FRAMES[1];

  // Hauteur du sauteur : le saut de haies est un arc court, le saut en
  // longueur suit la trajectoire calculée par le moteur.
  const hopHeight = state.airborne ? Math.sin(state.flightHeight * Math.PI) * 26 : 0;
  const flightLift = state.phase === 'flying' ? state.flightHeight * 6 : 0;
  const athleteX =
    state.phase === 'flying' && event === 'longJump'
      ? toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH + state.flightDistance)
      : toScreen(state.runDistance);
  const athleteY = GROUND - 36 - hopHeight - flightLift;

  const speedRatio = Math.min(1, state.speed / CONFIG.trackField.topSpeed);
  const finished = state.phase === 'result' || state.phase === 'eventOver';

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText}>{EVENT_LABEL[event]}</Text>
        <Text style={styles.hudText}>
          {isFieldEvent(event) ? `Essai ${state.attempt}/${CONFIG.trackField.fieldAttempts}` : 'Manche unique'}
        </Text>
        <Text style={styles.hudText}>Vies {state.lives}</Text>
      </View>

      <View style={styles.hud}>
        <Text style={styles.metric}>
          {unit === 's' ? `${state.time.toFixed(2)} s` : `${state.runDistance.toFixed(1)} m`}
        </Text>
        <Text style={styles.target}>
          Minima {target}
          {unit}
        </Text>
        <Text style={styles.metric}>Score {state.score}</Text>
      </View>

      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <Rect x={0} y={0} width={W} height={H} fill="#06101c" />

          {/* Piste et repères tous les 10 m */}
          <Rect x={0} y={GROUND} width={W} height={H - GROUND} fill="#123049" />
          <Line x1={0} y1={GROUND} x2={W} y2={GROUND} stroke="#46e68c" strokeWidth={2} />
          {MARKERS.map((m) => {
            const x = toScreen(m);
            if (x < -20 || x > W + 20) return null;
            return (
              <Line key={`m${m}`} x1={x} y1={GROUND} x2={x} y2={GROUND + 8} stroke="#2c5f80" strokeWidth={2} />
            );
          })}

          {/* Haies */}
          {event === 'hurdles' &&
            state.hurdles.map((h, i) => {
              const x = toScreen(h.x);
              if (x < -20 || x > W + 20) return null;
              return (
                <Rect
                  key={`h${i}`}
                  x={x}
                  y={GROUND - 20}
                  width={3}
                  height={20}
                  fill={h.cleared ? '#2c5f80' : '#ffe083'}
                />
              );
            })}

          {/* Planche d'appel et zone de réception */}
          {isFieldEvent(event) && (
            <>
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH)}
                y={GROUND - 4}
                width={4}
                height={4}
                fill="#ff4778"
              />
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH)}
                y={GROUND}
                width={Math.max(0, W - toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH))}
                height={H - GROUND}
                fill="#1b3d24"
              />
            </>
          )}

          {/* Ligne d'arrivée */}
          {!isFieldEvent(event) && (
            <Rect
              x={toScreen(event === 'hurdles' ? TRACK_DIMENSIONS.HURDLES_LENGTH : TRACK_DIMENSIONS.DASH_LENGTH)}
              y={GROUND - 40}
              width={3}
              height={40}
              fill="#eaffff"
            />
          )}

          {/* Javelot en vol */}
          {state.phase === 'flying' && event === 'javelin' && (
            <Path
              d={spritePath(
                JAVELIN,
                toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH + state.flightDistance),
                GROUND - 20 - state.flightHeight * 2.2,
                3,
                3,
              )}
              fill="#ff9d5c"
            />
          )}

          {/* L'athlète */}
          <Path
            d={spritePath(athleteBitmap, athleteX, athleteY, ATHLETE_PIXEL, ATHLETE_PIXEL)}
            fill="#eaffff"
          />

          {/* Jauge de vitesse */}
          <Rect x={12} y={12} width={120} height={8} rx={4} fill="rgba(255,255,255,0.12)" />
          <Rect x={12} y={12} width={120 * speedRatio} height={8} rx={4} fill="#72fbff" />

          {/* Angle en cours de réglage */}
          {state.settingAngle && (
            <>
              <Line
                x1={athleteX}
                y1={GROUND}
                x2={athleteX + Math.cos((state.angle * Math.PI) / 180) * 60}
                y2={GROUND - Math.sin((state.angle * Math.PI) / 180) * 60}
                stroke="#ffe083"
                strokeWidth={3}
              />
            </>
          )}
        </Svg>

        {state.settingAngle && (
          <View style={styles.angleBadge}>
            <Text style={styles.angleText}>{Math.round(state.angle)}°</Text>
          </View>
        )}

        {finished && (
          <View style={styles.overlay}>
            <Text style={styles.overTitle}>
              {state.result > 0
                ? `${state.result.toFixed(unit === 's' ? 2 : 2)} ${unit}`
                : state.message || 'Essai manqué'}
            </Text>
            {state.phase === 'eventOver' && <Text style={styles.overSub}>{state.message}</Text>}
            <ArcadeButton label="Continuer" onPress={controls.next} />
          </View>
        )}

        {state.status === 'gameOver' && (
          <View style={styles.overlay}>
            <Text style={styles.overTitle}>GAME OVER</Text>
            <ArcadeButton label="Rejouer" onPress={controls.restart} />
            <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
          </View>
        )}

        {state.status === 'paused' && (
          <View style={styles.overlay}>
            <Text style={styles.overTitle}>PAUSE</Text>
            <ArcadeButton label="Reprendre" onPress={controls.pause} />
            <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
          </View>
        )}
      </View>

      <TrackFieldControls
        onRunA={controls.runA}
        onRunB={controls.runB}
        onAction={controls.action}
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
    marginBottom: 2,
  },
  hudText: { color: '#ffe083', fontWeight: '900', fontSize: 13 },
  metric: { color: '#eaffff', fontWeight: '900', fontSize: 15 },
  target: { color: '#9fb8c8', fontWeight: '700', fontSize: 12 },
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
  angleBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  angleText: { color: '#ffe083', fontWeight: '900', fontSize: 18 },
  bottom: { width: '100%', maxWidth: 620, flexDirection: 'row' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overTitle: { color: '#fff', fontWeight: '900', fontSize: 30, textAlign: 'center' },
  overSub: { color: '#72fbff', fontWeight: '800', fontSize: 16 },
});
