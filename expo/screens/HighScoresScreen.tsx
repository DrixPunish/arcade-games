import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArcadeButton } from '../components/ArcadeButton';
import { CONFIG } from '../lib/gameConfig';
import {
  Board,
  GameId,
  getHighScores,
  HighScoreEntry,
  isOnlineEnabled,
} from '../lib/highScores';

type Status = 'loading' | 'ready' | 'unavailable';
/** Dernier chargement abouti, avec ce qu'il concernait : sert à savoir s'il est encore d'actualité. */
type Loaded = { game: GameId; board: Board; rows: HighScoreEntry[] | null };

export function HighScoresScreen({
  game,
  title,
  onBack,
}: {
  game: GameId;
  title: string;
  onBack: () => void;
}): React.ReactElement {
  const [board, setBoard] = useState<Board>(isOnlineEnabled ? 'online' : 'local');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getHighScores(game, board).then((rows) => {
      if (!cancelled) setLoaded({ game, board, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [game, board]);

  const fresh = loaded !== null && loaded.game === game && loaded.board === board;
  const status: Status = !fresh ? 'loading' : loaded.rows === null ? 'unavailable' : 'ready';
  const scores = fresh ? (loaded.rows ?? []) : [];

  const renderBody = (): React.ReactElement => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="#72fbff" />
        </View>
      );
    }
    if (status === 'unavailable') {
      return (
        <View style={styles.centered}>
          <Text style={styles.empty}>
            Classement en ligne indisponible.{'\n'}Vérifie ta connexion.
          </Text>
        </View>
      );
    }
    if (scores.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.empty}>Aucun score pour l’instant.</Text>
        </View>
      );
    }
    return (
      <>
        {scores.map((s, i) => (
          <View key={`${s.date}-${i}`} style={styles.row}>
            <Text style={styles.rank}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={styles.name}>{s.initials}</Text>
            <Text style={styles.score}>{s.score}</Text>
          </View>
        ))}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>TOP {CONFIG.highScoreLimit} PILOTS</Text>

      {isOnlineEnabled ? (
        <View style={styles.tabs}>
          <BoardTab label="En ligne" active={board === 'online'} onPress={() => setBoard('online')} />
          <BoardTab label="Ce téléphone" active={board === 'local'} onPress={() => setBoard('local')} />
        </View>
      ) : null}

      <View style={styles.board}>{renderBody()}</View>
      <ArcadeButton label="Retour" onPress={onBack} variant="ghost" />
    </View>
  );
}

function BoardTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '900' },
  subtitle: { color: '#ffe083', fontWeight: '900', letterSpacing: 3, marginTop: 6, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(114,251,255,0.35)',
  },
  tabActive: { backgroundColor: 'rgba(114,251,255,0.18)', borderColor: '#72fbff' },
  tabPressed: { opacity: 0.7 },
  tabText: { color: '#9fb8c8', fontWeight: '900', letterSpacing: 1 },
  tabTextActive: { color: '#eaffff' },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  empty: { color: '#9fb8c8', textAlign: 'center', lineHeight: 22 },
});
