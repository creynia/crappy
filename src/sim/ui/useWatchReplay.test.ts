import { describe, expect, it } from 'vitest';
import { watchAnimationSpeed } from './useWatchReplay';

describe('watchAnimationSpeed', () => {
  it('maps 1x to the player setting, 4x to fast and 16x to instant', () => {
    expect(watchAnimationSpeed(1, 'normal', false)).toBe('normal');
    expect(watchAnimationSpeed(1, 'fast', false)).toBe('fast');
    expect(watchAnimationSpeed(4, 'normal', false)).toBe('fast');
    expect(watchAnimationSpeed(16, 'normal', false)).toBe('instant');
  });
  it('reduced motion forces every watch speed to instant', () => {
    for (const s of [1, 4, 16] as const)
      expect(watchAnimationSpeed(s, 'normal', true)).toBe('instant');
  });
  it('reads prefers-reduced-motion when not told', () => {
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
    })) as typeof window.matchMedia;
    try {
      expect(watchAnimationSpeed(4, 'normal')).toBe('instant');
    } finally {
      window.matchMedia = real;
    }
  });
});
