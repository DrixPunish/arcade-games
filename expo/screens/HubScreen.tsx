import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GameTile } from '../components/GameTile';
import { TILE_ART } from '../lib/tileArt';
import { getLocalHighScores } from '../lib/highScores';

const GAP = 14;
const MAX_TILE = 190;

export function HubScreen({
  onAsteroids,
  onInvaders,
  onOlympic,
  onPacman,
}: {
  onAsteroids: () => void;
  onInvaders: () => void;
  onOlympic: () => void;
  onPacman: () => void;
}): React.ReactElement {
  // useWindowDimensions se met à jour à la rotation, contrairement à un
  // Dimensions.get() lu une seule fois au premier rendu.
  const { width } = useWindowDimensions();
  const available = Math.min(width, 620) - 44;
  const tileWidth = Math.min(MAX_TILE, (available - GAP) / 2);

  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getLocalHighScores('asteroids'),
      getLocalHighScores('spaceInvaders'),
      getLocalHighScores('trackField'),
    ]).then(([a, s, t]) => {
      if (!cancelled) {
        setBest({
          asteroids: a[0]?.score ?? 0,
          spaceInvaders: s[0]?.score ?? 0,
          trackField: t[0]?.score ?? 0,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // « INSERT COIN » qui clignote : une borne ne reste jamais tout à fait immobile.
  const [coinOn, setCoinOn] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setCoinOn((on) => !on), 650);
    return () => clearInterval(timer);
  }, []);

  const scoreLabel = (score: number): string =>
    score > 0 ? `★ ${score.toLocaleString('fr-FR')}` : 'Jamais joué';

  return (
    <View style={styles.container}>
      <Text style={[styles.coin, !coinOn && styles.coinOff]}>◆ INSERT COIN ◆</Text>

      <View style={styles.marquee}>
        <Text style={styles.title}>ARCADE</Text>
        <View style={styles.rule} />
        <Text style={styles.subtitle}>Quatre bornes, une salle</Text>
      </View>

      <View style={[styles.grid, { width: tileWidth * 2 + GAP }]}>
        <GameTile
          art={TILE_ART.asteroids}
          title="Asteroids"
          status={scoreLabel(best.asteroids ?? 0)}
          width={tileWidth}
          onPress={onAsteroids}
        />
        <GameTile
          art={TILE_ART.invaders}
          title="Space Invaders"
          status={scoreLabel(best.spaceInvaders ?? 0)}
          width={tileWidth}
          onPress={onInvaders}
        />
        <GameTile
          art={TILE_ART.olympic}
          title="Track & Field"
          status={scoreLabel(best.trackField ?? 0)}
          width={tileWidth}
          onPress={onOlympic}
        />
        <GameTile
          art={TILE_ART.pacman}
          title="Pac-Man"
          status="Bientôt"
          width={tileWidth}
          onPress={onPacman}
          comingSoon
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  coin: {
    color: '#ffe083',
    fontWeight: '900',
    letterSpacing: 4,
    fontSize: 12,
    marginBottom: 14,
  },
  coinOff: { opacity: 0.15 },
  marquee: { alignItems: 'center', marginBottom: 26 },
  title: {
    color: '#f7ffff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    textShadowColor: '#08ffff',
    textShadowRadius: 22,
    textShadowOffset: { width: 0, height: 0 },
  },
  rule: {
    height: 2,
    width: 150,
    marginTop: 10,
    backgroundColor: 'rgba(114,251,255,0.55)',
    borderRadius: 1,
  },
  subtitle: {
    color: '#9fb8c8',
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
});
