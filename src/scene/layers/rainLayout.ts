// Animation timing (delays/durations) is added in Phase 31 from the animation RNG stream.
export interface WindowPane {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WINDOW_PANES: readonly WindowPane[] = Object.freeze([
  { x: 130, y: 90, width: 265, height: 205 },
  { x: 415, y: 90, width: 265, height: 205 },
  { x: 130, y: 315, width: 265, height: 205 },
  { x: 415, y: 315, width: 265, height: 205 },
]);

export interface RainStreak {
  x: number;
  y: number;
  length: number;
  slant: number;
}

export const RAIN_STREAKS: readonly RainStreak[] = Object.freeze([
  { x: 155, y: 110, length: 42, slant: -3 },
  { x: 220, y: 145, length: 55, slant: -5 },
  { x: 330, y: 205, length: 36, slant: -2 },
  { x: 370, y: 235, length: 48, slant: -4 },
  { x: 445, y: 120, length: 60, slant: -5 },
  { x: 510, y: 175, length: 35, slant: -2 },
  { x: 590, y: 105, length: 50, slant: -4 },
  { x: 640, y: 220, length: 45, slant: -3 },
  { x: 150, y: 350, length: 52, slant: -4 },
  { x: 205, y: 420, length: 38, slant: -2 },
  { x: 310, y: 365, length: 65, slant: -6 },
  { x: 365, y: 455, length: 40, slant: -3 },
  { x: 435, y: 390, length: 44, slant: -2 },
  { x: 495, y: 335, length: 58, slant: -5 },
  { x: 570, y: 450, length: 33, slant: -3 },
  { x: 660, y: 355, length: 62, slant: -6 },
  { x: 260, y: 250, length: 31, slant: -1 },
  { x: 535, y: 250, length: 68, slant: -4 },
]);

export interface RainDrop {
  cx: number;
  cy: number;
  r: number;
}

export const RAIN_DROPS: readonly RainDrop[] = Object.freeze([
  { cx: 180, cy: 125, r: 4 },
  { cx: 285, cy: 265, r: 5 },
  { cx: 350, cy: 165, r: 3 },
  { cx: 470, cy: 270, r: 6 },
  { cx: 615, cy: 160, r: 4 },
  { cx: 175, cy: 480, r: 5 },
  { cx: 275, cy: 345, r: 3 },
  { cx: 375, cy: 500, r: 4 },
  { cx: 525, cy: 475, r: 6 },
  { cx: 635, cy: 325, r: 3 },
]);
