export type Vec = { x: number; y: number };
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const wrap = (value: number, max: number): number => (value < 0 ? value + max : value > max ? value - max : value);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const rectsHit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
