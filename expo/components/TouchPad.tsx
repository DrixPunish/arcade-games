import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

/**
 * Pavé de contrôle multi-touch.
 *
 * Deux `Pressable` voisins ne peuvent pas être enfoncés en même temps : le
 * système de responder de React Native attribue un geste à une seule vue. Or un
 * jeu d'arcade a besoin qu'on tire *pendant* qu'on se déplace. Ce composant
 * prend donc la main sur tout le pavé, mesure la position de chaque bouton en
 * coordonnées page, et déduit lui-même des touches actives quels boutons sont
 * enfoncés — autant à la fois qu'il y a de doigts.
 */

/** `hold` = actif tant que le doigt reste dessus. `tap` = déclenché à l'appui. */
export type PadButtonMode = 'hold' | 'tap';
export type PadButton = { key: string; label: string; mode: PadButtonMode; flex?: number };
export type PadRow = PadButton[];

type Rect = { x: number; y: number; width: number; height: number };

const isInside = (x: number, y: number, r: Rect | null): boolean =>
  !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

export function MultiTouchPad({
  rows,
  onHoldChange,
  onTap,
  debugHitboxes = false,
}: {
  rows: PadRow[];
  /** Appelé au changement d'état d'un bouton `hold`. */
  onHoldChange: (key: string, active: boolean) => void;
  /** Appelé une fois par appui sur un bouton `tap`. */
  onTap: (key: string) => void;
  /** Dessine les zones tactiles mesurées, pour mettre au point un réglage. */
  debugHitboxes?: boolean;
}): React.ReactElement {
  const buttons = useMemo(() => rows.flat(), [rows]);
  const keys = useMemo(() => buttons.map((b) => b.key), [buttons]);
  const modes = useMemo(
    () => Object.fromEntries(buttons.map((b) => [b.key, b.mode])) as Record<string, PadButtonMode>,
    [buttons],
  );

  const panelRef = useRef<View | null>(null);
  const panelOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewRefs = useRef<Record<string, View | null>>({});
  const rectsRef = useRef<Record<string, Rect | null>>({});
  const prevActiveRef = useRef<Record<string, boolean>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [debugRects, setDebugRects] = useState<Record<string, Rect | null>>({});

  const measureKey = useCallback(
    (key: string): void => {
      const node = viewRefs.current[key];
      if (!node) return;
      try {
        node.measure((_x, _y, width, height, pageX, pageY) => {
          if (width > 0 && height > 0) {
            const rect = { x: pageX, y: pageY, width, height };
            rectsRef.current[key] = rect;
            if (debugHitboxes) setDebugRects((prev) => ({ ...prev, [key]: rect }));
          }
        });
      } catch {
        // ignore
      }
    },
    [debugHitboxes],
  );

  const measureAll = useCallback((): void => {
    try {
      panelRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        panelOriginRef.current = { x: pageX, y: pageY };
      });
    } catch {
      // ignore
    }
    keys.forEach(measureKey);
  }, [keys, measureKey]);

  useEffect(() => {
    // Plusieurs mesures : la mise en page se stabilise de façon asynchrone.
    const timers = [0, 80, 250, 600].map((d) => setTimeout(measureAll, d));
    return () => timers.forEach(clearTimeout);
  }, [measureAll]);

  const setRef = useCallback(
    (key: string) => (view: View | null) => {
      viewRefs.current[key] = view;
    },
    [],
  );

  const sync = useCallback(
    (next: Record<string, boolean>): void => {
      const prev = prevActiveRef.current;
      for (const key of keys) {
        const was = prev[key] === true;
        const now = next[key] === true;
        if (modes[key] === 'hold') {
          if (now !== was) onHoldChange(key, now);
        } else if (now && !was) {
          onTap(key);
        }
      }
      prevActiveRef.current = next;
      setActive(next);
    },
    [keys, modes, onHoldChange, onTap],
  );

  const handleTouches = useCallback(
    (event: GestureResponderEvent): void => {
      const next: Record<string, boolean> = {};
      // pageX/pageY : même repère que les rectangles mesurés via measure().
      for (const touch of event.nativeEvent.touches) {
        for (const key of keys) {
          if (isInside(touch.pageX, touch.pageY, rectsRef.current[key] ?? null)) next[key] = true;
        }
      }
      sync(next);
    },
    [keys, sync],
  );

  const releaseAll = useCallback((): void => {
    const prev = prevActiveRef.current;
    for (const key of keys) {
      if (prev[key] && modes[key] === 'hold') onHoldChange(key, false);
    }
    prevActiveRef.current = {};
    setActive({});
  }, [keys, modes, onHoldChange]);

  return (
    <View
      ref={panelRef}
      collapsable={false}
      style={styles.panel}
      onLayout={measureAll}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleTouches}
      onResponderMove={handleTouches}
      onResponderRelease={handleTouches}
      onResponderTerminate={releaseAll}
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row} onLayout={measureAll}>
          {row.map((button) => (
            <VisualButton
              key={button.key}
              label={button.label}
              active={active[button.key] === true}
              style={{ flex: button.flex ?? 1 }}
              innerRef={setRef(button.key)}
              onLayout={() => measureKey(button.key)}
            />
          ))}
        </View>
      ))}

      {debugHitboxes ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {keys.map((key) => {
            const r = debugRects[key];
            if (!r) return null;
            const origin = panelOriginRef.current;
            return (
              <View
                key={`debug-${key}`}
                style={[
                  styles.debugBox,
                  { left: r.x - origin.x, top: r.y - origin.y, width: r.width, height: r.height },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function VisualButton({
  label,
  active,
  style,
  innerRef,
  onLayout,
}: {
  label: string;
  active: boolean;
  style?: StyleProp<ViewStyle>;
  innerRef: (view: View | null) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}): React.ReactElement {
  return (
    <View
      ref={innerRef}
      collapsable={false}
      onLayout={onLayout}
      pointerEvents="none"
      style={[styles.control, style, active && styles.pressed]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------- Asteroids -- */

const ASTEROIDS_ROWS: PadRow[] = [
  [
    { key: 'rotateLeft', label: 'Rotate Left', mode: 'hold' },
    { key: 'thrust', label: 'Thrust', mode: 'hold' },
  ],
  [
    { key: 'rotateRight', label: 'Rotate Right', mode: 'hold' },
    { key: 'fire', label: 'Fire', mode: 'tap' },
  ],
  [{ key: 'hyperspace', label: 'Hyperspace', mode: 'tap' }],
];

export function AsteroidsControls({
  onRotateLeft,
  onRotateRight,
  onThrust,
  onFire,
  onHyperspace,
  debugHitboxes,
}: {
  onRotateLeft: (active: boolean) => void;
  onRotateRight: (active: boolean) => void;
  onThrust: (active: boolean) => void;
  onFire: () => void;
  onHyperspace: () => void;
  debugHitboxes?: boolean;
}): React.ReactElement {
  const onHoldChange = useCallback(
    (key: string, activeNow: boolean): void => {
      if (key === 'rotateLeft') onRotateLeft(activeNow);
      else if (key === 'rotateRight') onRotateRight(activeNow);
      else if (key === 'thrust') onThrust(activeNow);
    },
    [onRotateLeft, onRotateRight, onThrust],
  );
  const onTap = useCallback(
    (key: string): void => {
      if (key === 'fire') onFire();
      else if (key === 'hyperspace') onHyperspace();
    },
    [onFire, onHyperspace],
  );
  return (
    <MultiTouchPad
      rows={ASTEROIDS_ROWS}
      onHoldChange={onHoldChange}
      onTap={onTap}
      debugHitboxes={debugHitboxes}
    />
  );
}

/* -------------------------------------------------------- Space Invaders -- */

const INVADERS_ROWS: PadRow[] = [
  [
    { key: 'left', label: '←', mode: 'hold' },
    { key: 'right', label: '→', mode: 'hold' },
    { key: 'fire', label: 'Tirer', mode: 'tap', flex: 1.4 },
  ],
];

export function InvadersControls({
  onLeft,
  onRight,
  onFire,
  debugHitboxes,
}: {
  onLeft: (active: boolean) => void;
  onRight: (active: boolean) => void;
  onFire: () => void;
  debugHitboxes?: boolean;
}): React.ReactElement {
  const onHoldChange = useCallback(
    (key: string, activeNow: boolean): void => {
      if (key === 'left') onLeft(activeNow);
      else if (key === 'right') onRight(activeNow);
    },
    [onLeft, onRight],
  );
  const onTap = useCallback(
    (key: string): void => {
      if (key === 'fire') onFire();
    },
    [onFire],
  );
  return (
    <MultiTouchPad
      rows={INVADERS_ROWS}
      onHoldChange={onHoldChange}
      onTap={onTap}
      debugHitboxes={debugHitboxes}
    />
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 620, gap: 10, marginTop: 8, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  control: {
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#62f6ff',
    backgroundColor: 'rgba(9,28,52,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pressed: { transform: [{ scale: 0.98 }], backgroundColor: 'rgba(98,246,255,0.28)' },
  text: { color: '#ecfeff', fontWeight: '900', fontSize: 14, textAlign: 'center' },
  debugBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,71,120,0.95)',
    backgroundColor: 'rgba(255,71,120,0.18)',
    borderRadius: 18,
  },
});
