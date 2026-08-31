import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArcadeButton } from '../components/ArcadeButton';

export function GameMenuScreen({ title, icon, onPlay, onScores, onBack, secondaryVariant = 'ghost' }: { title: string; icon: React.ReactNode; onPlay: () => void; onScores: () => void; onBack: () => void; secondaryVariant?: 'primary' | 'ghost' }): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.panel}>
        <ArcadeButton label="Jouer" onPress={onPlay} />
        <ArcadeButton label="High scores" onPress={onScores} variant={secondaryVariant} />
        <ArcadeButton label="Retour au hub" onPress={onBack} variant={secondaryVariant} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  badge: { width: 106, height: 106, borderRadius: 53, borderWidth: 2, borderColor: '#62f6ff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 18 },
  title: { color: '#fff', fontSize: 38, fontWeight: '900', textAlign: 'center', marginBottom: 26 },
  panel: { gap: 14, alignItems: 'center' },
});
