import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Panels } from './SimControls';

type RevealKey = 'auto' | 'session';
const SELECTOR: Record<RevealKey, string> = {
  auto: '.sim-autoroll',
  session: '.sim-session-panel',
};

/** Reduced motion if the app setting or the OS preference asks for it. */
export function prefersReducedMotion(doc: Document = document): boolean {
  if (doc.documentElement.dataset.motion === 'reduce') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scroll an opened panel's top into view (instant under reduced motion) and move focus to its heading,
 * or to the panel when it has none. Tapping Auto-roll or Session on a phone otherwise renders the panel
 * below the fold, under the bottom nav.
 */
export function revealPanel(root: HTMLElement, reduceMotion: boolean): void {
  root.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  const target = root.querySelector<HTMLElement>('h1, h2, h3') ?? root;
  target.tabIndex = -1; // headings and sections are not focusable until given a tabindex
  target.focus({ preventScroll: true });
}

/**
 * Reveals a panel only when the learner opens it with its own toggle. Call `request(name)` from the toggle
 * handler before the state flips; the effect consumes the request once the panel is rendered. Panels opened
 * by the app (lesson steps) make no request, so they never scroll or move focus. The lookup is scoped to
 * the simulator root, not the document.
 */
export function usePanelReveal(
  panels: Panels,
  scope: RefObject<HTMLElement>,
): (name: keyof Panels) => void {
  const pending = useRef<RevealKey | null>(null);
  useEffect(() => {
    const key = pending.current;
    pending.current = null;
    if (!key || !panels[key]) return;
    const el = scope.current?.querySelector<HTMLElement>(SELECTOR[key]);
    if (el) revealPanel(el, prefersReducedMotion());
  }, [panels.auto, panels.session]);
  return (name) => {
    if (name === 'auto' || name === 'session') pending.current = panels[name] ? null : name;
  };
}
