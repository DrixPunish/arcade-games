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
/**
 * `spacer` réserve une case vide dans la grille, sans zone tactile. C'est ce
 * qui permet de dessiner une vraie croix directionnelle, avec ses coins et son
 * centre creux, au lieu d'aligner les flèches côte à côte.
 */
export type PadButtonMode = 'hold' | 'tap' | 'spacer';
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
  const buttons = useMemo(() => rows.flat().filter((b) => b.mode !== 'spacer'), [rows]);
  const keys = useMemo(() => buttons.map((b) => b.key), [buttons]);
  const modes = useMemo(
    () => Object.fromEntries(buttons.map((b) => [b.key, b.mode])) as Record<string, PadButtonMode>,
    [buttons],
  );

  const panelRef = useRef<View | null>(null);
  const viewRefs = useRef<Record<string, View | null>>({});
  const rectsRef = useRef<Record<string, Rect | null>>({});
  const prevActiveRef = useRef<Record<string, boolean>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [debugRects, setDebugRects] = useState<Record<string, Rect | null>>({});
  // Uniquement pour l'overlay de mise au point : en état, pas en ref, car lu au rendu.
  const [debugOrigin, setDebugOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    if (debugHitboxes) {
      try {
        panelRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
          setDebugOrigin({ x: pageX, y: pageY });
        });
      } catch {
        // ignore
      }
    }
    keys.forEach(measureKey);
  }, [debugHitboxes, keys, measureKey]);

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
      // Un doigt qui glisse émet des dizaines d'évènements par seconde : sans
      // cette comparaison, chacun provoquait un rendu du pavé pour rien.
      let changed = false;
      for (const key of keys) if ((prev[key] === true) !== (next[key] === true)) changed = true;
      if (changed) setActive(next);
    },
    [keys, modes, onHoldChange, onTap],
  );

  const applyTouches = useCallback(
    (event: GestureResponderEvent, dropChanged: boolean): void => {
      // Les doigts qui viennent de se lever restent parfois listés dans
      // `touches` sur iOS : on les retire explicitement, sinon le bouton
      // correspondant reste enfoncé jusqu'au geste suivant.
      const lifted = dropChanged
        ? new Set((event.nativeEvent.changedTouches ?? []).map((t) => t.identifier))
        : null;
      const next: Record<string, boolean> = {};
      // pageX/pageY : même repère que les rectangles mesurés via measure().
      for (const touch of event.nativeEvent.touches) {
        if (lifted?.has(touch.identifier)) continue;
        for (const key of keys) {
          if (isInside(touch.pageX, touch.pageY, rectsRef.current[key] ?? null)) next[key] = true;
        }
      }
      sync(next);
    },
    [keys, sync],
  );

  const handleTouches = useCallback(
    (event: GestureResponderEvent): void => applyTouches(event, false),
    [applyTouches],
  );

  /**
   * `onResponderRelease` n'arrive qu'au lever du DERNIER doigt. Lâcher une
   * flèche tout en gardant « Tirer » enfoncé ne déclenchait donc rien, et la
   * flèche restait active. `onTouchEnd` est émis pour chaque doigt.
   */
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent): void => applyTouches(event, true),
    [applyTouches],
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
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row} onLayout={measureAll}>
          {row.map((button) =>
            button.mode === 'spacer' ? (
              <View key={button.key} style={{ flex: button.flex ?? 1 }} />
            ) : (
              <VisualButton
                key={button.key}
                label={button.label}
                active={active[button.key] === true}
                style={{ flex: button.flex ?? 1 }}
                innerRef={setRef(button.key)}
                onLayout={() => measureKey(button.key)}
              />
            ),
          )}
        </View>
      ))}

      {debugHitboxes ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {keys.map((key) => {
            const r = debugRects[key];
            if (!r) return null;
            return (
              <View
                key={`debug-${key}`}
                style={[
                  styles.debugBox,
                  { left: r.x - debugOrigin.x, top: r.y - debugOrigin.y, width: r.width, height: r.height },
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
    { key: 'rotateLeft', label: 'Rotation ←', mode: 'hold' },
    { key: 'thrust', label: 'Propulsion', mode: 'hold' },
  ],
  [
    { key: 'rotateRight', label: 'Rotation →', mode: 'hold' },
    { key: 'fire', label: 'Tirer', mode: 'tap' },
  ],
  [{ key: 'hyperspace', label: 'Hyperespace', mode: 'tap' }],
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

/* --------------------------------------------------------- Track & Field -- */

/**
 * Deux boutons de course à marteler en alternance, et un bouton d'action
 * maintenu pour régler l'angle. C'est le schéma de commande de la borne
 * Konami de 1983, transposé au tactile.
 */
const TRACK_ROWS: PadRow[] = [
  [
    { key: 'runA', label: 'COURIR ◀', mode: 'tap' },
    { key: 'runB', label: 'COURIR ▶', mode: 'tap' },
  ],
  [{ key: 'action', label: 'SAUT / LANCER', mode: 'hold' }],
];

export function TrackFieldControls({
  onRunA,
  onRunB,
  onAction,
}: {
  onRunA: () => void;
  onRunB: () => void;
  onAction: (held: boolean) => void;
}): React.ReactElement {
  const onHoldChange = useCallback(
    (key: string, activeNow: boolean): void => {
      if (key === 'action') onAction(activeNow);
    },
    [onAction],
  );
  const onTap = useCallback(
    (key: string): void => {
      if (key === 'runA') onRunA();
      else if (key === 'runB') onRunB();
    },
    [onRunA, onRunB],
  );
  return <MultiTouchPad rows={TRACK_ROWS} onHoldChange={onHoldChange} onTap={onTap} />;
}

/* ------------------------------------------------------------- Pac-Man --- */

/**
 * Une vraie croix directionnelle : coins et centre creux, comme sur une
 * manette. Les quatre flèches alignées sur deux rangées obligeaient à viser,
 * alors que le pouce trouve une croix sans regarder.
 *
 * Les boutons sont en mode maintenu et non en appui simple : la direction
 * demandée reste allumée tant que le doigt est posé, ce qui donne le même
 * retour visuel qu'un joystick — et le moteur, lui, l'applique au prochain
 * centre de case.
 */
const PACMAN_ROWS: PadRow[] = [
  [
    { key: 'padNW', label: '', mode: 'spacer' },
    { key: 'up', label: '▲', mode: 'hold' },
    { key: 'padNE', label: '', mode: 'spacer' },
  ],
  [
    { key: 'left', label: '◀', mode: 'hold' },
    { key: 'padC', label: '', mode: 'spacer' },
    { key: 'right', label: '▶', mode: 'hold' },
  ],
  [
    { key: 'padSW', label: '', mode: 'spacer' },
    { key: 'down', label: '▼', mode: 'hold' },
    { key: 'padSE', label: '', mode: 'spacer' },
  ],
];

export function PacmanControls({
  onSteer,
  debugHitboxes,
}: {
  onSteer: (dir: 'up' | 'down' | 'left' | 'right') => void;
  debugHitboxes?: boolean;
}): React.ReactElement {
  const onHoldChange = useCallback(
    (key: string, activeNow: boolean): void => {
      // Seul l'appui compte : relâcher ne doit pas annuler la direction, sinon
      // Pac-Man s'arrêterait dès qu'on lève le pouce.
      if (activeNow) onSteer(key as 'up' | 'down' | 'left' | 'right');
    },
    [onSteer],
  );
  const onTap = useCallback((): void => {}, []);
  return (
    <MultiTouchPad
      rows={PACMAN_ROWS}
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
