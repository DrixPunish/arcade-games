export type Vec = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** True modulo wrap: always lands inside [0, max), whatever the overshoot. */
export const wrap = (value: number, max: number): number => ((value % max) + max) % max;

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export const rectsHit = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

let idCounter = 0;
/** Monotonic id, stable enough to key React lists across frames. */
export const uid = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};
