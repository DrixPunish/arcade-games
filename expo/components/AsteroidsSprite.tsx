import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const SHEET = require('../assets/images/asteroids/sprites.png');
const SHEET_W = 512;
const SHEET_H = 320;

export type AsteroidsSpriteKey =
  | 'asteroidLarge1'
  | 'asteroidLarge2'
  | 'asteroidLarge3'
  | 'asteroidMedium1'
  | 'asteroidMedium2'
  | 'asteroidMedium3'
  | 'asteroidSmall1'
  | 'asteroidSmall2'
  | 'asteroidSmall3'
  | 'ship'
  | 'shipThrust'
  | 'saucer'
  | 'bullet';

type Frame = { sx: number; sy: number; sw: number; sh: number };

/**
 * Sprite sheet coordinates derived from analyzing the source PNG.
 * Layout (Joe Strout, miniscript.org):
 *   Row 1 (y=0..160):   3 large asteroids, 160x160 each
 *   Row 2 (y=160..256): 3 medium asteroids 96x96, then saucer 96x80
 *   Row 3 (y=256..320): 3 small asteroids 64x64, ship 96x64, ship thrust 96x64, two 32x32 bullets
 */
export const SPRITE_FRAMES: Record<AsteroidsSpriteKey, Frame> = {
  asteroidLarge1: { sx: 0, sy: 0, sw: 160, sh: 160 },
  asteroidLarge2: { sx: 160, sy: 0, sw: 160, sh: 160 },
  asteroidLarge3: { sx: 320, sy: 0, sw: 160, sh: 160 },
  asteroidMedium1: { sx: 0, sy: 160, sw: 96, sh: 96 },
  asteroidMedium2: { sx: 96, sy: 160, sw: 96, sh: 96 },
  asteroidMedium3: { sx: 192, sy: 160, sw: 96, sh: 96 },
  asteroidSmall1: { sx: 0, sy: 256, sw: 64, sh: 64 },
  asteroidSmall2: { sx: 64, sy: 256, sw: 64, sh: 64 },
  asteroidSmall3: { sx: 128, sy: 256, sw: 64, sh: 64 },
  ship: { sx: 192, sy: 256, sw: 96, sh: 64 },
  shipThrust: { sx: 288, sy: 256, sw: 96, sh: 64 },
  saucer: { sx: 416, sy: 160, sw: 96, sh: 80 },
  bullet: { sx: 448, sy: 272, sw: 32, sh: 32 },
};

type Props = {
  spriteKey: AsteroidsSpriteKey;
  size: number;
  rotation?: number;
  tint?: string;
};

/**
 * Renders a single sprite from the sheet, scaled to `size` (square).
 * Uses clipping + scaled Image with negative offsets.
 */
export const AsteroidsSprite = React.memo(function AsteroidsSprite({
  spriteKey,
  size,
  rotation = 0,
  tint,
}: Props): React.ReactElement {
  const frame = SPRITE_FRAMES[spriteKey];
  const scale = size / Math.max(frame.sw, frame.sh);
  const dispW = frame.sw * scale;
  const dispH = frame.sh * scale;
  const sheetW = SHEET_W * scale;
  const sheetH = SHEET_H * scale;

  return (
    <View
      style={[
        styles.clip,
        {
          width: dispW,
          height: dispH,
          transform: [{ rotate: `${rotation}rad` }],
        },
      ]}
      pointerEvents="none"
    >
      <Image
        source={SHEET}
        style={{
          width: sheetW,
          height: sheetH,
          marginLeft: -frame.sx * scale,
          marginTop: -frame.sy * scale,
          tintColor: tint,
        }}
        resizeMode="stretch"
        fadeDuration={0}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
