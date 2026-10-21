import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Bet } from '../engine/types';
import { betLabel } from './text';
import { fmtDelta, type WinChoice } from './winPrompt';
import './sim.css';

export interface WinPromptProps {
  bet: Bet;
  choices: readonly WinChoice[];
  onChoose: (c: WinChoice) => void;
  /** "Always same bet": stop asking (remembered) */
  onAlwaysSame: () => void;
  onDismiss: () => void;
}

/** What to do with a place or buy bet that just won: Press, Same bet, Regress or Take down, with the cost of each. */
export function WinPrompt({ bet, choices, onChoose, onAlwaysSame, onDismiss }: WinPromptProps) {
  // keyboard: Tab reaches the choices after the controls, Escape dismisses; focus is never stolen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // Normally the prompt sits just above the felt. When the page is scrolled so far that the status row
  // above the felt is off screen (short phones), it would be off screen too: then it drops inside the
  // top edge of the felt, so the choices are always reachable.
  const ref = useRef<HTMLDivElement>(null);
  const [inside, setInside] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = el?.offsetParent as HTMLElement | null;
    if (!el || !anchor) return;
    const check = () => {
      if (el.closest('.sim-land')) return; // landscape: anchored to the rail, no flip
      setInside(anchor.getBoundingClientRect().top < el.offsetHeight + 8);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  return (
    <div
      ref={ref}
      data-inside={inside ? '' : undefined}
      class="sim-winprompt"
      role="group"
      aria-label={`${betLabel(bet.type)} won. What now?`}
      data-testid="win-prompt"
    >
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          class="sim-winprompt-btn"
          data-choice={c.id}
          aria-label={`${c.label}: ${c.detail}, ${fmtDelta(c.deltaPerRoll)} expected loss`}
          onClick={() => onChoose(c)}
        >
          <span>{c.short}</span>
          <small>{fmtDelta(c.deltaPerRoll, true)}</small>
        </button>
      ))}
      <button
        type="button"
        class="sim-winprompt-btn sim-winprompt-x"
        aria-label="Always same bet: stop asking"
        onClick={onAlwaysSame}
      >
        <span>Always</span>
        <small>same bet</small>
      </button>
    </div>
  );
}
