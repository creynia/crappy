import { useEffect } from 'preact/hooks';
import type { Panels } from './SimControls';

const REVEALED_PANELS = { auto: '.sim-autoroll', session: '.sim-session-panel' } as const;

/**
 * Scroll an opened panel into view (nearest edge; instant under reduced motion) and move focus to its
 * heading, or to the panel itself when it has none. Tapping Auto-roll or Session on a phone otherwise
 * renders the panel below the fold, under the bottom nav.
 */
export function revealPanel(root: HTMLElement, reduceMotion: boolean): void {
  root.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  const target = root.querySelector<HTMLElement>('h1, h2, h3') ?? root;
  target.tabIndex = -1; // headings and sections are not focusable until given a tabindex
  target.focus({ preventScroll: true });
}

/** Reveals each panel only when its own toggle changes to open, so opening one never re-scrolls the other. */
export function usePanelReveal(panels: Panels): void {
  useEffect(() => {
    if (!panels.auto) return;
    const el = document.querySelector<HTMLElement>(REVEALED_PANELS.auto);
    if (el) revealPanel(el, prefersReducedMotion());
  }, [panels.auto]);
  useEffect(() => {
    if (!panels.session) return;
    const el = document.querySelector<HTMLElement>(REVEALED_PANELS.session);
    if (el) revealPanel(el, prefersReducedMotion());
  }, [panels.session]);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
