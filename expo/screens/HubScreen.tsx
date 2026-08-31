import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gamepad2, Medal, Rocket } from 'lucide-react-native';

export function HubScreen({
  onAsteroids,
  onInvaders,
  onOlympic,
}: {
  onAsteroids: () => void;
  onInvaders: () => void;
  onOlympic: () => void;
}): React.ReactElement {
  // useWindowDimensions se met à jour à la rotation / au redimensionnement,
  // contrairement à un Dimensions.get() lu une seule fois au premier rendu.
  const { width } = useWindowDimensions();
  const compact = width < 620;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>INSERT COIN</Text>
      <Text style={styles.title}>Arcade Games</Text>
      <Text style={styles.subtitle}>
        Trois bornes. Deux classiques jouables, sprites d’époque et classement en ligne.
      </Text>
      <View style={[styles.grid, compact && styles.gridCompact]}>
        <GameOrb
          title="Asteroids"
          accent="#79fbff"
          onPress={onAsteroids}
          icon={<Rocket color="#00141a" size={44} />}
        />
        <GameOrb
          title="Space Invaders"
          accent="#ffe083"
          onPress={onInvaders}
          icon={<Gamepad2 color="#1a1000" size={44} />}
        />
        <GameOrb
          title="Olympic Summer Games"
          accent="#ff7a9c"
          onPress={onOlympic}
          comingSoon
          icon={<Medal color="#2b0712" size={44} />}
        />
      </View>
    </View>
  );
}

function GameOrb({
  title,
  accent,
  icon,
  onPress,
  comingSoon,
}: {
  title: string;
  accent: string;
  icon: React.ReactNode;
  onPress: () => void;
  comingSoon?: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${title} (bientôt disponible)` : title}
      style={[styles.orbWrap, comingSoon && styles.dimmed]}
    >
      <View style={[styles.orb, { backgroundColor: accent, shadowColor: accent }]}>{icon}</View>
      <Text style={styles.orbTitle}>{title}</Text>
      {comingSoon ? (
        <Text style={styles.soon}>Coming soon</Text>
      ) : (
        <Text style={styles.play}>Tap to play</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  kicker: { color: '#ffe083', fontWeight: '900', letterSpacing: 5, marginBottom: 8 },
  title: {
    color: '#f7ffff',
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#08ffff',
    textShadowRadius: 18,
  },
  subtitle: { color: '#9fb8c8', fontSize: 16, textAlign: 'center', marginTop: 12, maxWidth: 560 },
  grid: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  gridCompact: { flexDirection: 'column', marginTop: 30 },
  orbWrap: { alignItems: 'center', width: 178 },
  dimmed: { opacity: 0.55 },
  orb: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.75)',
    shadowOpacity: 0.75,
    shadowRadius: 25,
    elevation: 8,
  },
  orbTitle: { color: '#ffffff', fontWeight: '900', fontSize: 18, textAlign: 'center', marginTop: 14 },
  soon: { color: '#ffb4c5', fontWeight: '800', marginTop: 5 },
  play: { color: '#72fbff', fontWeight: '800', marginTop: 5 },
});
