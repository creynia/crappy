import { useEffect, useRef, useState } from 'preact/hooks';
import { DieIcon } from './Dice';
import { matchesFilter, type LogFilter, type RollLogEntry } from './rollLog';
import { fmtMoney } from './text';

const FILTERS: [LogFilter, string][] = [
  ['all', 'All'],
  ['wins', 'Wins'],
  ['losses', 'Losses'],
  ['points', 'Point events'],
];

export interface RollLogProps {
  /** chronological (oldest first); shown newest first */
  entries: readonly RollLogEntry[];
  /** roll number to scroll to and highlight (from tapping a history pill) */
  focusRoll?: number | null;
}

/** Every roll's status text, newest first, with All / Wins / Losses / Point events filters. */
export function RollLog({ entries, focusRoll }: RollLogProps) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const rootRef = useRef<HTMLElement>(null);
  const shown = entries.filter((e) => matchesFilter(e, filter)).reverse();

  useEffect(() => {
    if (focusRoll == null) return;
    setFilter('all');
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-roll="${focusRoll}"]`);
    el?.scrollIntoView?.({ block: 'center' });
  }, [focusRoll]);

  return (
    <section class="sim-roll-log" aria-label="Roll log" ref={rootRef}>
      <h3>Roll log</h3>
      <div class="sim-log-filters" role="group" aria-label="Filter rolls">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            class="sim-tab sim-log-filter"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p class="sim-muted">
          {entries.length === 0
            ? 'No rolls yet. Every roll will be listed here.'
            : 'No rolls match.'}
        </p>
      ) : (
        <ol class="sim-log-list" aria-label="Rolls, newest first">
          {shown.map((e) => (
            <li
              key={e.id}
              class={`sim-log-entry is-${e.kind}${e.net > 0 ? ' is-win' : e.net < 0 ? ' is-loss' : ''}${e.n === focusRoll && e.kind === 'roll' ? ' is-focus' : ''}`}
              {...(e.kind === 'roll' ? { 'data-roll': String(e.n) } : {})}
            >
              <span class="sim-log-head">
                {e.kind === 'roll' && e.dice ? (
                  <>
                    <span class="sim-log-n">#{e.n}</span>
                    <span aria-hidden="true" class="sim-log-dice">
                      <DieIcon value={e.dice[0]} size={16} />
                      <DieIcon value={e.dice[1]} size={16} />
                    </span>
                  </>
                ) : (
                  <span class="sim-log-n">After roll {e.n}</span>
                )}
              </span>
              <span class="sim-log-text">
                {e.kind === 'roll' ? <span class="sim-sr">{`Roll ${e.n}. `}</span> : null}
                {e.text}
              </span>
              <span class="sim-log-bank">
                Bankroll {fmtMoney(e.bankroll)}
                {e.kind === 'roll'
                  ? ` (${e.net === 0 ? '$0' : fmtMoney(e.net, { sign: true })})`
                  : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
