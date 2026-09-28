import React from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';

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
 *   Row 3 (y=256..320): 3 small asteroids 64x64, ship 96x64, ship thrust 96x64,
 *                       then two 32x32 bullets at y=288
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
  bullet: { sx: 448, sy: 288, sw: 32, sh: 32 },
};

type Geometry = { dispW: number; dispH: number; imageStyle: ImageStyle };

/**
 * La géométrie d'un sprite ne dépend que de (clé, taille), jamais de sa
 * position. On la calcule une fois et on la garde : le style de l'`Image`
 * conserve ainsi la même identité d'un rendu à l'autre, donc React n'envoie
 * aucune mise à jour à la couche native pour elle — seule la transformation
 * du conteneur change.
 */
const geometryCache = new Map<string, Geometry>();

function geometryFor(spriteKey: AsteroidsSpriteKey, size: number): Geometry {
  const cacheKey = `${spriteKey}:${size.toFixed(2)}`;
  const cached = geometryCache.get(cacheKey);
  if (cached) return cached;

  const frame = SPRITE_FRAMES[spriteKey];
  const scale = size / Math.max(frame.sw, frame.sh);
  const geometry: Geometry = {
    dispW: frame.sw * scale,
    dispH: frame.sh * scale,
    imageStyle: {
      width: SHEET_W * scale,
      height: SHEET_H * scale,
      marginLeft: -frame.sx * scale,
      marginTop: -frame.sy * scale,
    },
  };
  geometryCache.set(cacheKey, geometry);
  return geometry;
}

type Props = {
  spriteKey: AsteroidsSpriteKey;
  size: number;
  /** Centre du sprite, en pixels écran. */
  x: number;
  y: number;
  rotation?: number;
};

/**
 * Découpe un sprite de la planche et le place à (x, y).
 *
 * Le positionnement passe par `transform: translate` et non par `left`/`top` :
 * une translation ne touche pas à la mise en page, alors que left/top relance
 * le calcul de layout de la vue à chaque frame — coûteux sur iOS quand une
 * trentaine d'entités bougent en même temps.
 */
export const AsteroidsSprite = React.memo(function AsteroidsSprite({
  spriteKey,
  size,
  x,
  y,
  rotation = 0,
}: Props): React.ReactElement {
  const { dispW, dispH, imageStyle } = geometryFor(spriteKey, size);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.sprite,
        {
          width: dispW,
          height: dispH,
          transform: [
            { translateX: x - dispW / 2 },
            { translateY: y - dispH / 2 },
            { rotate: `${rotation}rad` },
          ],
        },
      ]}
    >
      <Image source={SHEET} style={imageStyle} resizeMode="stretch" fadeDuration={0} />
    </View>
  );
});

const styles = StyleSheet.create({
  sprite: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
});
