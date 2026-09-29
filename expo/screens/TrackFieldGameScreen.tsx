import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { ArcadeButton } from '../components/ArcadeButton';
import { HighScorePrompt } from '../components/HighScorePrompt';
import { TrackFieldControls } from '../components/TouchPad';
import { CONFIG } from '../lib/gameConfig';
import { spritePath, spritePathsByKey } from '../lib/pixelArt';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';
import {
  EVENT_LABEL,
  EVENT_ORDER,
  EVENT_UNIT,
  TRACK_DIMENSIONS,
  isFieldEvent,
  useTrackFieldGame,
} from '../games/track-field/useTrackFieldGame';
import { ATHLETE_JUMP, ATHLETE_PALETTE, JAVELIN, RUN_FRAMES } from '../games/track-field/sprites';

import {
  ATHLETE_PIXEL,
  COLORS,
  CROWD,
  FLOODLIGHTS,
  CROWD_TOP,
  GROUND,
  H,
  LANES,
  MARKERS,
  HURDLE_HEIGHT,
  HURDLE_LIFT,
  PX_PER_M,
  SKY,
  TAKEOFF_ZONE,
  TRACK_TOP,
  W,
  WALL_TOP,
} from '../games/track-field/stadium';

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
  // `flightHeight` est déjà l'arc (0 au sol, 1 au sommet) : le moteur s'en
  // charge, l'écran ne fait que le mettre à l'échelle. Le sommet dépasse
  // franchement la haie, sans quoi un franchissement réussi ressemblait à un
  // passage au travers.
  const hopHeight = state.airborne ? state.flightHeight * HURDLE_LIFT : 0;
  const flightLift = state.phase === 'flying' ? state.flightHeight * 6 : 0;
  const athleteX =
    state.phase === 'flying' && event === 'longJump'
      ? toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH + state.flightDistance)
      : toScreen(state.runDistance);
  // 12 rangées de sprite : les pieds tombent pile sur la ligne de course.
  const ATHLETE_H = 12 * ATHLETE_PIXEL;
  const athleteY = GROUND - ATHLETE_H - hopHeight - flightLift;

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
          {isFieldEvent(event)
            ? state.best > 0
              ? `Record ${state.best.toFixed(2)} m`
              : `Élan ${Math.min(state.runDistance, TRACK_DIMENSIONS.RUNWAY_LENGTH).toFixed(0)} / ${TRACK_DIMENSIONS.RUNWAY_LENGTH} m`
            : `${state.time.toFixed(2)} s`}
        </Text>
        <Text style={styles.target}>
          Minima {target}
          {unit}
        </Text>
        <Text style={styles.metric}>Score {state.score}</Text>
      </View>

      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          {/* Ciel, gradins, muret, piste */}
          <Rect x={0} y={SKY} width={W} height={CROWD_TOP} fill="#0b1b35" />
          {FLOODLIGHTS.map((f, i) => (
            <React.Fragment key={`fl${i}`}>
              <Rect x={f.x} y={f.y + 8} width={3} height={CROWD_TOP - f.y - 8} fill={COLORS.mast} />
              <Rect x={f.x - 11} y={f.y} width={25} height={8} fill={COLORS.lamp} />
            </React.Fragment>
          ))}
          <Rect x={0} y={CROWD_TOP} width={W} height={WALL_TOP - CROWD_TOP} fill="#16243d" />
          {CROWD.map((c, i) => (
            <Rect key={`c${i}`} x={c.x} y={c.y} width={5} height={5} fill={c.color} />
          ))}
          <Rect x={0} y={WALL_TOP} width={W} height={TRACK_TOP - WALL_TOP} fill="#7a8ba8" />
          <Rect x={0} y={TRACK_TOP} width={W} height={H - TRACK_TOP} fill="#b4542f" />
          {LANES.map((y, i) => (
            <Rect key={`l${i}`} x={0} y={y} width={W} height={1.5} fill="rgba(255,255,255,0.45)" />
          ))}

          {/* Repères de distance : trait court tous les 10 m, long tous les 50 */}
          {MARKERS.map((m) => {
            const x = toScreen(m);
            if (x < -20 || x > W + 20) return null;
            const long = m % 50 === 0;
            return (
              <Rect
                key={`m${m}`}
                x={x}
                y={GROUND + 2}
                width={long ? 3 : 2}
                height={long ? 16 : 7}
                fill={long ? '#ffe083' : 'rgba(255,255,255,0.55)'}
              />
            );
          })}

          {/* Zone d'appel : c'est là que la vitesse se fige quand on tient
              le bouton, il faut donc la voir venir de loin. */}
          {isFieldEvent(event) && (
            <>
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH - TAKEOFF_ZONE)}
                y={GROUND - 1}
                width={TAKEOFF_ZONE * PX_PER_M}
                height={H - GROUND + 1}
                fill="rgba(255,224,131,0.22)"
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <Rect
                  key={`chev${i}`}
                  x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH - TAKEOFF_ZONE + i * 1.6)}
                  y={GROUND + 4}
                  width={6}
                  height={3}
                  fill="#ffe083"
                />
              ))}
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH) - 1}
                y={GROUND - 30}
                width={2}
                height={30}
                fill="rgba(255,71,120,0.75)"
              />
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH)}
                y={GROUND - 1}
                width={Math.max(0, W - toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH))}
                height={H - GROUND + 1}
                fill="#d9c08a"
              />
              <Rect
                x={toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH) - 3}
                y={GROUND - 3}
                width={4}
                height={6}
                fill="#ff4778"
              />
            </>
          )}

          {/* Haies : la zone d'appel au sol, puis deux pieds et une barre */}
          {event === 'hurdles' &&
            state.hurdles.map((h, i) => {
              const x = toScreen(h.x);
              if (x < -80 || x > W + 20) return null;
              const colour = h.cleared ? '#8a6a55' : '#eaffff';
              const zoneW = CONFIG.trackField.hurdleTakeoffZone * PX_PER_M;
              return (
                <React.Fragment key={`h${i}`}>
                  {/* Appuyer sur cette bande cale le saut sur la haie. */}
                  {h.cleared ? null : (
                    <>
                      <Rect
                        x={x - zoneW}
                        y={GROUND - 3}
                        width={zoneW}
                        height={3}
                        fill="rgba(255,224,131,0.5)"
                      />
                      <Rect x={x - zoneW} y={GROUND - 8} width={2} height={8} fill="#ffe083" />
                    </>
                  )}
                  <Rect x={x} y={GROUND - HURDLE_HEIGHT} width={10} height={3} fill={colour} />
                  <Rect x={x} y={GROUND - HURDLE_HEIGHT} width={2} height={HURDLE_HEIGHT} fill={colour} />
                  <Rect
                    x={x + 8}
                    y={GROUND - HURDLE_HEIGHT}
                    width={2}
                    height={HURDLE_HEIGHT}
                    fill={colour}
                  />
                </React.Fragment>
              );
            })}

          {/* Ligne d'arrivée en damier */}
          {!isFieldEvent(event) &&
            (() => {
              const x = toScreen(
                event === 'hurdles' ? TRACK_DIMENSIONS.HURDLES_LENGTH : TRACK_DIMENSIONS.DASH_LENGTH,
              );
              if (x < -20 || x > W + 20) return null;
              return (
                <>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Rect
                      key={`f${i}`}
                      x={x}
                      y={GROUND - 42 + i * 7}
                      width={6}
                      height={7}
                      fill={i % 2 === 0 ? '#eaffff' : '#2b3f63'}
                    />
                  ))}
                </>
              );
            })()}

          {/* Javelot en vol */}
          {state.phase === 'flying' && event === 'javelin' && (
            <Path
              d={spritePath(
                JAVELIN,
                toScreen(TRACK_DIMENSIONS.RUNWAY_LENGTH + state.flightDistance),
                GROUND - 16 - state.flightHeight * PX_PER_M * 0.35,
                3.5,
                3.5,
              )}
              fill="#ff9d5c"
            />
          )}

          {/* L'athlète */}
          {Object.entries(
            spritePathsByKey(athleteBitmap, athleteX, athleteY, ATHLETE_PIXEL, ATHLETE_PIXEL),
          ).map(([key, d]) => (
            <Path key={key} d={d} fill={ATHLETE_PALETTE[key] ?? COLORS.athlete} />
          ))}

          {/* Jauge de vitesse */}
          <Rect x={10} y={10} width={126} height={12} rx={6} fill="rgba(0,0,0,0.45)" />
          <Rect
            x={13}
            y={13}
            width={120 * speedRatio}
            height={6}
            rx={3}
            fill={speedRatio > 0.85 ? '#46e68c' : speedRatio > 0.5 ? '#ffe083' : '#ff7a9c'}
          />

          {/* Angle en cours de réglage */}
          {state.settingAngle && (
            <>
              <Line
                x1={athleteX}
                y1={GROUND - ATHLETE_H / 2}
                x2={athleteX + Math.cos((state.angle * Math.PI) / 180) * 70}
                y2={GROUND - ATHLETE_H / 2 - Math.sin((state.angle * Math.PI) / 180) * 70}
                stroke={Math.abs(state.angle - 42) < 4 ? '#46e68c' : '#ffe083'}
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
