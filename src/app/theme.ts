import type { Settings, SpeedSetting } from './storage';

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Reduced motion (setting or OS) forces instant. */
export function effectiveSpeed(s: Settings): SpeedSetting {
  return s.reduceMotion || prefersReducedMotion() ? 'instant' : s.animationSpeed;
}

export function applyTheme(s: Settings, root: HTMLElement = document.documentElement) {
  if (s.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.setAttribute('data-motion', effectiveSpeed(s) === 'instant' ? 'reduce' : 'full');
}

/** Calls `cb` when the OS reduced-motion preference changes. Returns an unsubscribe function. */
export function onReducedMotionChange(cb: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  } catch {
    return () => {};
  }
}
