import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { ArcadeButton } from '../App';

function ControlButton({ label, onPress, onDown, onUp, wide }: { label: string; onPress?: () => void; onDown?: () => void; onUp?: () => void; wide?: boolean }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onDown}
      onPressOut={onUp}
      style={({ pressed }) => [ctrlStyles.btn, wide && ctrlStyles.wide, pressed && ctrlStyles.pressed]}
    >
      <Text style={ctrlStyles.label}>{label}</Text>
    </Pressable>
  );
}
const ctrlStyles = StyleSheet.create({
  btn: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(114,251,255,0.5)', borderWidth: 2, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 22, minWidth: 84, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  wide: { minWidth: 140 },
  pressed: { backgroundColor: 'rgba(114,251,255,0.18)' },
  label: { color: '#eaffff', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
});
import { INVADERS_DIMENSIONS, useSpaceInvadersGame } from '../games/space-invaders/useSpaceInvadersGame';
import { qualifiesForHighScore, saveHighScore } from '../lib/highScores';

export function SpaceInvadersGameScreen({ onExit, onScores }: { onExit: () => void; onScores: () => void }): React.ReactElement {
  const { state, controls } = useSpaceInvadersGame();
  const [initials, setInitials] = useState<string>('AAA');
  const [askName, setAskName] = useState<boolean>(false);
  useEffect(() => { if (state.status === 'gameOver') void qualifiesForHighScore('spaceInvaders', state.score).then(setAskName); }, [state.status, state.score]);
  const submit = async (): Promise<void> => { await saveHighScore('spaceInvaders', { initials: initials.slice(0, 3).toUpperCase(), score: state.score, date: Date.now() }); setAskName(false); onScores(); };
  return (
    <View style={styles.container}>
      <View style={styles.hud}><Text style={styles.hudText}>Score {state.score}</Text><Text style={styles.hudText}>Vies {state.lives}</Text><Text style={styles.hudText}>Wave {state.wave}</Text></View>
      <View style={styles.stage}>
        <Svg viewBox={`0 0 ${INVADERS_DIMENSIONS.W} ${INVADERS_DIMENSIONS.H}`} width="100%" height="100%">
          <Rect x={0} y={0} width={INVADERS_DIMENSIONS.W} height={INVADERS_DIMENSIONS.H} fill="rgba(0,0,0,0.25)" stroke="#24536b" strokeWidth={2} />
          {state.ufo.active ? <Rect x={state.ufo.x - 18} y={state.ufo.y - 8} width={36} height={16} rx={8} fill="#ff4778" /> : null}
          {state.invaders.filter(i => i.alive).map(i => <Rect key={i.id} x={i.x} y={i.y} width={18} height={15} rx={4} fill={i.points === 30 ? '#ff7a9c' : i.points === 20 ? '#ffe083' : '#72fbff'} />)}
          {state.bunkers.filter(b => b.alive).map(b => <Rect key={b.id} x={b.x} y={b.y} width={INVADERS_DIMENSIONS.BLOCK - 1} height={INVADERS_DIMENSIONS.BLOCK - 1} fill="#46e68c" />)}
          <Rect x={state.playerX - 16} y={INVADERS_DIMENSIONS.PLAYER_Y - 8} width={32} height={16} rx={3} fill="#eaffff" />
          <Rect x={state.playerX - 4} y={INVADERS_DIMENSIONS.PLAYER_Y - 18} width={8} height={12} fill="#eaffff" />
          {state.playerBullet ? <Rect x={state.playerBullet.x - 2} y={state.playerBullet.y} width={4} height={12} fill="#fff" /> : null}
          {state.enemyBullets.map((b, i) => <Circle key={i} cx={b.x} cy={b.y} r={3} fill="#ffb000" />)}
        </Svg>
        {state.status !== 'running' ? <View style={styles.overlay}><Text style={styles.overTitle}>{state.status === 'paused' ? 'PAUSE' : 'GAME OVER'}</Text><ArcadeButton label={state.status === 'paused' ? 'Reprendre' : 'Rejouer'} onPress={state.status === 'paused' ? controls.pause : controls.restart} /></View> : null}
      </View>
      <View style={styles.controls}><View style={styles.row}><ControlButton label="←" onDown={() => controls.left(true)} onUp={() => controls.left(false)} /><ControlButton label="→" onDown={() => controls.right(true)} onUp={() => controls.right(false)} /></View><View style={styles.row}><ControlButton label="Pause" onPress={controls.pause} /><ControlButton label="Tirer" onPress={controls.fire} wide /></View></View>
      <ArcadeButton label="Quitter" onPress={onExit} variant="ghost" />
      <Modal transparent visible={askName}><View style={styles.modal}><View style={styles.card}><Text style={styles.overTitle}>Nouveau high score</Text><TextInput value={initials} onChangeText={setInitials} maxLength={3} autoCapitalize="characters" style={styles.input} /><ArcadeButton label="Enregistrer" onPress={() => void submit()} /></View></View></Modal>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 12, alignItems: 'center' }, hud: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', maxWidth: 720, paddingHorizontal: 8 }, hudText: { color: '#ffe083', fontWeight: '900' }, stage: { flex: 1, width: '100%', maxWidth: 620, marginVertical: 8, borderRadius: 18, overflow: 'hidden' }, controls: { width: '100%', maxWidth: 620, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, row: { flexDirection: 'row' }, overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: 'rgba(0,0,0,0.45)' }, overTitle: { color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' }, modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }, card: { backgroundColor: '#071426', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#72fbff', gap: 16, alignItems: 'center' }, input: { color: '#fff', borderBottomWidth: 2, borderColor: '#ffe083', fontSize: 32, fontWeight: '900', letterSpacing: 8, minWidth: 130, textAlign: 'center' } });
