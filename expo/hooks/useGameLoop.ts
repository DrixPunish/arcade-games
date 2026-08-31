import { useEffect, useRef } from 'react';

/** Runs a requestAnimationFrame loop with delta time in seconds. */
export function useGameLoop(active: boolean, onFrame: (dt: number) => void): void {
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const callbackRef = useRef(onFrame);

  // Le callback est rafraîchi via un effet plutôt qu'en plein rendu :
  // écrire dans une ref pendant le rendu est un effet de bord interdit.
  useEffect(() => {
    callbackRef.current = onFrame;
  });

  useEffect(() => {
    if (!active) {
      lastRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      return;
    }
    const tick = (time: number): void => {
      const last = lastRef.current ?? time;
      const dt = Math.min(0.033, (time - last) / 1000);
      lastRef.current = time;
      callbackRef.current(dt);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);
}
