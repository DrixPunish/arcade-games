import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArcadeButton, ArcadeButtonVariant } from '../components/ArcadeButton';
import { CONFIG } from '../lib/gameConfig';
import { GameId, getHighScores, HighScoreEntry } from '../lib/highScores';

export function HighScoresScreen({
  game,
  title,
  onBack,
  backVariant = 'ghost',
}: {
  game: GameId;
  title: string;
  onBack: () => void;
  backVariant?: ArcadeButtonVariant;
}): React.ReactElement {
  const [scores, setScores] = useState<HighScoreEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getHighScores(game).then((rows) => {
      if (!cancelled) setScores(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>TOP {CONFIG.highScoreLimit} PILOTS</Text>
      <View style={styles.board}>
        {scores.length === 0 ? (
          <Text style={styles.empty}>Aucun score pour l’instant.</Text>
        ) : (
          scores.map((s, i) => (
            <View key={`${s.date}-${i}`} style={styles.row}>
              <Text style={styles.rank}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.name}>{s.initials}</Text>
              <Text style={styles.score}>{s.score}</Text>
            </View>
          ))
        )}
      </View>
      <ArcadeButton label="Retour" onPress={onBack} variant={backVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '900' },
  subtitle: { color: '#ffe083', fontWeight: '900', letterSpacing: 3, marginTop: 6, marginBottom: 20 },
  board: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(98,246,255,0.3)',
    marginBottom: 22,
    minHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rank: { color: '#72fbff', width: 42, fontWeight: '900' },
  name: { color: '#fff', flex: 1, fontWeight: '900', letterSpacing: 2 },
  score: { color: '#ffe083', fontWeight: '900', fontSize: 18 },
  empty: { color: '#9fb8c8', textAlign: 'center', marginTop: 120 },
});
