import { useEffect } from 'preact/hooks';
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
  return (
    <div class="sim-winprompt" role="group" aria-label="After the win" data-testid="win-prompt">
      <div class="sim-winprompt-head">
        <span>{betLabel(bet.type)} won. What now?</span>
        <button
          type="button"
          class="sim-winprompt-x"
          aria-label="Always same bet: stop asking"
          onClick={onAlwaysSame}
        >
          <span class="sim-wp-long">Always same bet</span>
          <span class="sim-wp-short">Always same</span>
        </button>
      </div>
      <div class="sim-winprompt-row">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            class="sim-winprompt-btn"
            data-choice={c.id}
            aria-label={`${c.label}: ${c.detail}, ${fmtDelta(c.deltaPerRoll)} expected loss`}
            onClick={() => onChoose(c)}
          >
            <span>
              <span class="sim-wp-long">{c.label}</span>
              <span class="sim-wp-short">{c.short}</span>
            </span>
            <small>{c.detail}</small>
            <small>{fmtDelta(c.deltaPerRoll)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
