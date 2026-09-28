import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Medal, Rocket, Shield } from 'lucide-react-native';
import { AsteroidsGameScreen } from './screens/AsteroidsGameScreen';
import { GameMenuScreen } from './screens/GameMenuScreen';
import { HighScoresScreen } from './screens/HighScoresScreen';
import { HubScreen } from './screens/HubScreen';
import { SpaceInvadersGameScreen } from './screens/SpaceInvadersGameScreen';
import { TrackFieldGameScreen } from './screens/TrackFieldGameScreen';

type Route =
  | 'hub'
  | 'asteroidsMenu'
  | 'asteroidsGame'
  | 'asteroidsScores'
  | 'invadersMenu'
  | 'invadersGame'
  | 'invadersScores'
  | 'trackMenu'
  | 'trackGame'
  | 'trackScores';

function renderRoute(route: Route, go: (next: Route) => void): React.ReactElement {
  switch (route) {
    case 'hub':
      return (
        <HubScreen
          onAsteroids={() => go('asteroidsMenu')}
          onInvaders={() => go('invadersMenu')}
          onOlympic={() => go('trackMenu')}
          onPacman={() => Alert.alert('Pac-Man', 'Cette borne n’est pas encore développée.')}
        />
      );
    case 'asteroidsMenu':
      return (
        <GameMenuScreen
          title="Asteroids"
          icon={<Rocket color="#8ffcff" size={54} />}
          onPlay={() => go('asteroidsGame')}
          onScores={() => go('asteroidsScores')}
          onBack={() => go('hub')}
        />
      );
    case 'invadersMenu':
      return (
        <GameMenuScreen
          title="Space Invaders"
          icon={<Shield color="#ffe083" size={54} />}
          onPlay={() => go('invadersGame')}
          onScores={() => go('invadersScores')}
          onBack={() => go('hub')}
        />
      );
    case 'asteroidsScores':
      return (
        <HighScoresScreen game="asteroids" title="Asteroids" onBack={() => go('asteroidsMenu')} />
      );
    case 'invadersScores':
      return (
        <HighScoresScreen game="spaceInvaders" title="Space Invaders" onBack={() => go('invadersMenu')} />
      );
    case 'asteroidsGame':
      return (
        <AsteroidsGameScreen onExit={() => go('asteroidsMenu')} onScores={() => go('asteroidsScores')} />
      );
    case 'invadersGame':
      return (
        <SpaceInvadersGameScreen onExit={() => go('invadersMenu')} onScores={() => go('invadersScores')} />
      );
    case 'trackMenu':
      return (
        <GameMenuScreen
          title="Track & Field"
          icon={<Medal color="#ff9d5c" size={54} />}
          onPlay={() => go('trackGame')}
          onScores={() => go('trackScores')}
          onBack={() => go('hub')}
        />
      );
    case 'trackScores':
      return (
        <HighScoresScreen game="trackField" title="Track & Field" onBack={() => go('trackMenu')} />
      );
    case 'trackGame':
      return <TrackFieldGameScreen onExit={() => go('trackMenu')} onScores={() => go('trackScores')} />;
  }
}

export default function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>('hub');
  const go = useCallback((next: Route): void => setRoute(next), []);

  return (
    <LinearGradient colors={['#050714', '#091225', '#130a1d']} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>{renderRoute(route, go)}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
