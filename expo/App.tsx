import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Rocket, Shield, Trophy } from 'lucide-react-native';
import { AsteroidsGameScreen } from './screens/AsteroidsGameScreen';
import { GameMenuScreen } from './screens/GameMenuScreen';
import { HighScoresScreen } from './screens/HighScoresScreen';
import { HubScreen } from './screens/HubScreen';
import { SpaceInvadersGameScreen } from './screens/SpaceInvadersGameScreen';
import { GameId } from './lib/highScores';

type Route = 'hub' | 'asteroidsMenu' | 'asteroidsGame' | 'asteroidsScores' | 'invadersMenu' | 'invadersGame' | 'invadersScores';

export default function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>('hub');

  const openScores = (game: GameId): void => setRoute(game === 'asteroids' ? 'asteroidsScores' : 'invadersScores');
  const openMenu = (game: GameId): void => setRoute(game === 'asteroids' ? 'asteroidsMenu' : 'invadersMenu');

  let content: React.ReactElement;
  if (route === 'hub') {
    content = <HubScreen onAsteroids={() => setRoute('asteroidsMenu')} onInvaders={() => setRoute('invadersMenu')} onOlympic={() => Alert.alert('Olympic Summer Games', 'Ce jeu sera développé plus tard.')} />;
  } else if (route === 'asteroidsMenu') {
    content = <GameMenuScreen title="Asteroids" icon={<Rocket color="#8ffcff" size={54} />} onPlay={() => setRoute('asteroidsGame')} onScores={() => setRoute('asteroidsScores')} onBack={() => setRoute('hub')} secondaryVariant="primary" />;
  } else if (route === 'invadersMenu') {
    content = <GameMenuScreen title="Space Invaders" icon={<Shield color="#ffe083" size={54} />} onPlay={() => setRoute('invadersGame')} onScores={() => setRoute('invadersScores')} onBack={() => setRoute('hub')} />;
  } else if (route === 'asteroidsScores') {
    content = <HighScoresScreen game="asteroids" title="Asteroids" onBack={() => setRoute('asteroidsMenu')} backVariant="primary" />;
  } else if (route === 'invadersScores') {
    content = <HighScoresScreen game="spaceInvaders" title="Space Invaders" onBack={() => setRoute('invadersMenu')} />;
  } else if (route === 'asteroidsGame') {
    content = <AsteroidsGameScreen onExit={() => openMenu('asteroids')} onScores={() => openScores('asteroids')} />;
  } else {
    content = <SpaceInvadersGameScreen onExit={() => openMenu('spaceInvaders')} onScores={() => openScores('spaceInvaders')} />;
  }

  return (
    <LinearGradient colors={["#050714", "#091225", "#130a1d"]} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>{content}</SafeAreaView>
    </LinearGradient>
  );
}

export function ArcadeButton({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger' }): React.ReactElement {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[styles.button, variant === 'ghost' && styles.ghost, variant === 'danger' && styles.danger]}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  button: { backgroundColor: '#12d6d6', borderColor: '#b8ffff', borderWidth: 2, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 24, minWidth: 210, shadowColor: '#12d6d6', shadowOpacity: 0.55, shadowRadius: 16, elevation: 5 },
  ghost: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.25)' },
  danger: { backgroundColor: '#ff4778', borderColor: '#ffc2d1' },
  buttonText: { color: '#031018', fontWeight: '900', textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' },
});
