import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { bitmapCols, bitmapRows, spritePath } from '../lib/pixelArt';
import { TileArt } from '../lib/tileArt';

/**
 * Une borne du menu : son dessin en pixel art, son nom, et soit le meilleur
 * score déjà réalisé, soit la mention « bientôt » si le jeu n'existe pas encore.
 */
export function GameTile({
  art,
  title,
  status,
  width,
  onPress,
  comingSoon = false,
}: {
  art: TileArt;
  title: string;
  /** Ligne du bas : meilleur score, « Nouveau », ou « Bientôt ». */
  status: string;
  width: number;
  onPress: () => void;
  comingSoon?: boolean;
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
      accessibilityLabel={comingSoon ? `${title}, bientôt disponible` : title}
      style={({ pressed }) => [
        styles.tile,
        { width, borderColor: art.color, shadowColor: art.color },
        comingSoon && styles.dimmed,
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
      <Text style={[styles.status, comingSoon ? styles.soon : { color: art.color }]}>{status}</Text>
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
  dimmed: { opacity: 0.55 },
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
  soon: { color: '#8fa6bb' },
});
