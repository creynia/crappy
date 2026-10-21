import { memo } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DieIcon } from './Dice';
import { matchesFilter, type LogFilter, type RollLogEntry } from './rollLog';
import { fmtMoney } from './text';

const FILTERS: [LogFilter, string][] = [
  ['all', 'All'],
  ['wins', 'Wins'],
  ['losses', 'Losses'],
  ['points', 'Point events'],
];
/** Entries rendered at first; "Show more" adds this many each time (the log keeps up to 500). */
const PAGE = 100;

export interface RollLogFocus {
  /** roll number to scroll to, focus and highlight */
  n: number;
  /** changes on every tap, so tapping the same pill again still works */
  nonce: number;
}

export interface RollLogProps {
  /** chronological (oldest first); shown newest first */
  entries: readonly RollLogEntry[];
  focus?: RollLogFocus | null;
}

const Entry = memo(function Entry({ e, focused }: { e: RollLogEntry; focused: boolean }) {
  return (
    <li
      class={`sim-log-entry is-${e.kind}${e.net > 0 ? ' is-win' : e.net < 0 ? ' is-loss' : ''}${focused ? ' is-focus' : ''}`}
      tabIndex={-1}
      {...(e.kind === 'roll' ? { 'data-roll': String(e.n) } : {})}
    >
      <span class="sim-log-head">
        {e.kind === 'roll' && e.dice ? (
          <>
            <span class="sim-log-n" aria-hidden="true">
              #{e.n}
            </span>
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
        {e.kind === 'roll' ? ` (${e.net === 0 ? '$0' : fmtMoney(e.net, { sign: true })})` : ''}
      </span>
    </li>
  );
});

/** Every roll's status text, newest first, with All / Wins / Losses / Point events filters. */
export const RollLog = memo(function RollLog({ entries, focus }: RollLogProps) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [target, setTarget] = useState<RollLogFocus | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const matching = useMemo(
    () => entries.filter((e) => matchesFilter(e, filter)).reverse(),
    [entries, filter],
  );
  const shown = matching.slice(0, limit);

  // a tapped history pill: show everything, then focus the roll once the list has re-rendered
  useEffect(() => {
    if (!focus) return;
    setFilter('all');
    setTarget(focus);
  }, [focus]);
  useEffect(() => {
    if (!target || filter !== 'all') return;
    const idx = [...entries].reverse().findIndex((e) => e.kind === 'roll' && e.n === target.n);
    if (idx >= limit) {
      setLimit(idx + 1);
      return;
    }
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-roll="${target.n}"]`);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus({ preventScroll: true });
    setTarget(null);
  }, [target, filter, limit, entries]);

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
            onClick={() => {
              setFilter(id);
              setLimit(PAGE);
            }}
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
        <ol class="sim-log-list" role="list" tabIndex={0} aria-label="Rolls, newest first">
          {shown.map((e) => (
            <Entry key={e.id} e={e} focused={focus?.n === e.n && e.kind === 'roll'} />
          ))}
        </ol>
      )}
      {matching.length > shown.length ? (
        <button type="button" class="sim-tab sim-log-more" onClick={() => setLimit(limit + PAGE)}>
          Show {Math.min(PAGE, matching.length - shown.length)} older rolls
        </button>
      ) : null}
    </section>
  );
});
