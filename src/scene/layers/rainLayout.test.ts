import { describe, expect, it } from 'vitest';
import { RAIN_DROPS, RAIN_STREAKS, WINDOW_PANES } from './rainLayout';

describe('rain layout', () => {
  it('defines fixed geometry contained in the window panes', () => {
    expect(WINDOW_PANES).toHaveLength(4);
    expect(RAIN_STREAKS).toHaveLength(18);
    expect(RAIN_DROPS).toHaveLength(10);
    expect(Object.isFrozen(WINDOW_PANES)).toBe(true);
    expect(Object.isFrozen(RAIN_STREAKS)).toBe(true);
    expect(Object.isFrozen(RAIN_DROPS)).toBe(true);
    expect(new Set(RAIN_STREAKS.map(({ x }) => x)).size).toBeGreaterThan(1);

    const contains = (x: number, y: number) => WINDOW_PANES.some((pane) =>
      x >= pane.x && x <= pane.x + pane.width && y >= pane.y && y <= pane.y + pane.height,
    );
    for (const streak of RAIN_STREAKS) {
      expect(contains(streak.x, streak.y)).toBe(true);
      expect(contains(streak.x + streak.slant, streak.y + streak.length)).toBe(true);
    }
    for (const drop of RAIN_DROPS) {
      expect(contains(drop.cx - drop.r, drop.cy - drop.r)).toBe(true);
      expect(contains(drop.cx + drop.r, drop.cy + drop.r)).toBe(true);
    }
  });
});
