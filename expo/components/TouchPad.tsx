import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type ControlKey = 'rotateLeft' | 'rotateRight' | 'thrust' | 'fire' | 'hyperspace';
type Rect = { x: number; y: number; width: number; height: number };
type RectMap = Record<ControlKey, Rect | null>;
type ActiveMap = Record<ControlKey, boolean>;

type AsteroidsControlsProps = {
  onRotateLeft: (active: boolean) => void;
  onRotateRight: (active: boolean) => void;
  onThrust: (active: boolean) => void;
  onFire: () => void;
  onHyperspace: () => void;
  /** When true, draws the measured hitboxes as a translucent overlay for debugging. */
  debugHitboxes?: boolean;
};

const KEYS: ControlKey[] = ['rotateLeft', 'rotateRight', 'thrust', 'fire', 'hyperspace'];

const emptyRects = (): RectMap => ({
  rotateLeft: null,
  rotateRight: null,
  thrust: null,
  fire: null,
  hyperspace: null,
});

const emptyActive = (): ActiveMap => ({
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
  fire: false,
  hyperspace: false,
});

const isInside = (x: number, y: number, r: Rect | null): boolean =>
  !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

type VisualButtonProps = {
  label: string;
  active: boolean;
  style?: StyleProp<ViewStyle>;
  innerRef: (view: View | null) => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

function VisualButton({
  label,
  active,
  style,
  innerRef,
  onLayout,
}: VisualButtonProps): React.ReactElement {
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

export function AsteroidsControls({
  onRotateLeft,
  onRotateRight,
  onThrust,
  onFire,
  onHyperspace,
  debugHitboxes = false,
}: AsteroidsControlsProps): React.ReactElement {
  const panelRef = useRef<View | null>(null);
  const rectsRef = useRef<RectMap>(emptyRects());
  const prevActiveRef = useRef<ActiveMap>(emptyActive());
  const viewRefs = useRef<Record<ControlKey, View | null>>({
    rotateLeft: null,
    rotateRight: null,
    thrust: null,
    fire: null,
    hyperspace: null,
  });
  const [active, setActive] = useState<ActiveMap>(emptyActive);
  const [debugRects, setDebugRects] = useState<RectMap>(emptyRects());

  // Measure every button in PAGE coordinates (pageX/pageY).
  // Touches use pageX/pageY too so the coordinate systems match.
  // This works on both native and web (no findNodeHandle).
  const panelOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const measureKey = useCallback((key: ControlKey): void => {
    const node = viewRefs.current[key];
    if (!node) return;
    try {
      node.measure((_x, _y, width, height, pageX, pageY) => {
        if (width > 0 && height > 0) {
          const rect = { x: pageX, y: pageY, width, height };
          rectsRef.current[key] = rect;
          if (debugHitboxes) {
            setDebugRects((prev) => ({ ...prev, [key]: rect }));
          }
        }
      });
    } catch {
      // ignore
    }
  }, [debugHitboxes]);

  const measurePanel = useCallback((): void => {
    const panel = panelRef.current;
    if (!panel) return;
    try {
      panel.measure((_x, _y, _w, _h, pageX, pageY) => {
        panelOriginRef.current = { x: pageX, y: pageY };
      });
    } catch {
      // ignore
    }
  }, []);

  const measureAll = useCallback((): void => {
    measurePanel();
    KEYS.forEach(measureKey);
  }, [measureKey, measurePanel]);

  useEffect(() => {
    // Re-measure a few times to catch async layout settling.
    const t1 = setTimeout(measureAll, 0);
    const t2 = setTimeout(measureAll, 80);
    const t3 = setTimeout(measureAll, 250);
    const t4 = setTimeout(measureAll, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [measureAll]);

  const setRef = useCallback(
    (key: ControlKey) => (view: View | null) => {
      viewRefs.current[key] = view;
    },
    [],
  );

  const onButtonLayout = useCallback(
    (key: ControlKey) => () => {
      measureKey(key);
    },
    [measureKey],
  );

  const sync = useCallback(
    (next: ActiveMap): void => {
      const prev = prevActiveRef.current;
      if (next.rotateLeft !== prev.rotateLeft) onRotateLeft(next.rotateLeft);
      if (next.rotateRight !== prev.rotateRight) onRotateRight(next.rotateRight);
      if (next.thrust !== prev.thrust) onThrust(next.thrust);
      if (next.fire && !prev.fire) onFire();
      if (next.hyperspace && !prev.hyperspace) onHyperspace();
      prevActiveRef.current = next;
      setActive(next);
    },
    [onRotateLeft, onRotateRight, onThrust, onFire, onHyperspace],
  );

  const handleTouches = useCallback(
    (event: GestureResponderEvent): void => {
      const touches = event.nativeEvent.touches;
      const next = emptyActive();
      const rects = rectsRef.current;
      for (const touch of touches) {
        // Use pageX/pageY: same coordinate system as rects measured via measure().
        const lx = touch.pageX;
        const ly = touch.pageY;
        if (isInside(lx, ly, rects.rotateLeft)) next.rotateLeft = true;
        if (isInside(lx, ly, rects.rotateRight)) next.rotateRight = true;
        if (isInside(lx, ly, rects.thrust)) next.thrust = true;
        if (isInside(lx, ly, rects.fire)) next.fire = true;
        if (isInside(lx, ly, rects.hyperspace)) next.hyperspace = true;
      }
      sync(next);
    },
    [sync],
  );

  const releaseAll = useCallback((): void => {
    const prev = prevActiveRef.current;
    if (prev.rotateLeft) onRotateLeft(false);
    if (prev.rotateRight) onRotateRight(false);
    if (prev.thrust) onThrust(false);
    const cleared = emptyActive();
    prevActiveRef.current = cleared;
    setActive(cleared);
  }, [onRotateLeft, onRotateRight, onThrust]);

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
      <View style={styles.row} onLayout={measureAll}>
        <VisualButton
          label="Rotate Left"
          active={active.rotateLeft}
          style={styles.buttonHalf}
          innerRef={setRef('rotateLeft')}
          onLayout={onButtonLayout('rotateLeft')}
        />
        <VisualButton
          label="Thrust"
          active={active.thrust}
          style={styles.buttonHalf}
          innerRef={setRef('thrust')}
          onLayout={onButtonLayout('thrust')}
        />
      </View>

      <View style={styles.row} onLayout={measureAll}>
        <VisualButton
          label="Rotate Right"
          active={active.rotateRight}
          style={styles.buttonHalf}
          innerRef={setRef('rotateRight')}
          onLayout={onButtonLayout('rotateRight')}
        />
        <VisualButton
          label="Fire"
          active={active.fire}
          style={styles.buttonHalf}
          innerRef={setRef('fire')}
          onLayout={onButtonLayout('fire')}
        />
      </View>

      <View style={styles.row} onLayout={measureAll}>
        <VisualButton
          label="Hyperspace"
          active={active.hyperspace}
          style={styles.buttonFull}
          innerRef={setRef('hyperspace')}
          onLayout={onButtonLayout('hyperspace')}
        />
      </View>

      {debugHitboxes && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {KEYS.map((key) => {
            const r = debugRects[key];
            if (!r) return null;
            const origin = panelOriginRef.current;
            return (
              <View
                key={`debug-${key}`}
                style={{
                  position: 'absolute',
                  left: r.x - origin.x,
                  top: r.y - origin.y,
                  width: r.width,
                  height: r.height,
                  borderWidth: 2,
                  borderColor: 'rgba(255,71,120,0.95)',
                  backgroundColor: 'rgba(255,71,120,0.18)',
                  borderRadius: 18,
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 620,
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
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
  buttonHalf: {
    flex: 1,
  },
  buttonFull: {
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(98,246,255,0.28)',
  },
  text: {
    color: '#ecfeff',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },
});
