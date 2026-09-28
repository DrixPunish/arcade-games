import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { bitmapCols, bitmapRows, spritePath } from '../lib/pixelArt';
import { TileArt } from '../lib/tileArt';

/**
 * Une borne du menu : son dessin en pixel art, son nom et le meilleur score
 * déjà réalisé dessus.
 */
export function GameTile({
  art,
  title,
  status,
  width,
  onPress,
}: {
  art: TileArt;
  title: string;
  /** Ligne du bas : le meilleur score, ou « Jamais joué ». */
  status: string;
  width: number;
  onPress: () => void;
}): React.ReactElement {
  const artSize = Math.round(width * 0.46);
  const cols = bitmapCols(art.bitmap);
  const rows = bitmapRows(art.bitmap);
  const cell = artSize / Math.max(cols, rows);
  const artW = cols * cell;
  const artH = rows * cell;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.tile,
        { width, borderColor: art.color, shadowColor: art.color },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.artBox, { height: Math.round(width * 0.52) }]}>
        <Svg width={artW} height={artH}>
          <Path d={spritePath(art.bitmap, 0, 0, cell, cell)} fill={art.color} />
        </Svg>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.status, { color: art.color }]}>{status}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(8,18,34,0.85)',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    // L'ombre colorée est statique : elle n'est peinte qu'une fois, contrairement
    // à celles des entités mobiles qu'on a retirées des jeux.
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  artBox: { alignItems: 'center', justifyContent: 'center' },
  title: {
    color: '#eaffff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  status: { fontWeight: '800', fontSize: 12, marginTop: 6, letterSpacing: 1 },
});
