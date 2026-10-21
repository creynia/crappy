import { useState } from 'preact/hooks';
import { fracText } from '../math/format';
import { scanStreaks } from '../strategy/streaks';
import type { StreakCondition, StreakResult, StreakStat, StreakTarget } from '../strategy/streaks';

export const LAB_ROLLS = 100_000;

type Kind = StreakCondition['kind'];
const KIND_LABEL: Record<Kind, string> = {
  sevens: 'sevens in a row',
  drought: 'rolls without a chosen number',
  points: 'points made in a row',
};
const TARGET_LABEL: Record<StreakTarget, string> = {
  seven: 'The next roll is a 7',
  six: 'The next roll is a 6',
  point: 'The next point is made (not a seven-out)',
};

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const count = (n: number): string => n.toLocaleString('en-US');

export function conditionText(c: StreakCondition): string {
  if (c.kind === 'sevens') return c.n === 1 ? 'after a 7' : `after ${c.n} sevens in a row`;
  if (c.kind === 'drought') return `after ${c.n} rolls without a ${c.total}`;
  return c.n === 1 ? 'after a point is made' : `after ${c.n} points made in a row`;
}

/** One plain sentence per row: what was seen, the range dice with no memory would normally give, the exact chance. */
export function statText(s: StreakStat): string {
  if (s.samples === 0 || s.frequency === null)
    return 'This never happened in these rolls. Try a shorter streak.';
  if (!s.enough || s.normalRange === null)
    return `Only ${count(s.samples)} ${s.samples === 1 ? 'time' : 'times'} (${count(s.hits)} followed): too few samples to tell anything. The exact chance is ${pct(s.exactNumber)} (${fracText(s.exact)}). Try a shorter streak.`;
  return `Observed ${pct(s.frequency)} (${count(s.hits)} of ${count(s.samples)}). Normal wobble for dice with no memory: ${pct(s.normalRange[0])} to ${pct(s.normalRange[1])}. The exact chance is ${pct(s.exactNumber)} (${fracText(s.exact)}).`;
}

export interface StreakLabProps {
  initialSeed?: number;
  /** a run finished (the scene step can complete) */
  onCompleted?: (rolls: number) => void;
}

/** Gambler's-fallacy lab: hunt for a pattern in 100,000 dice rolls and watch it fail to appear. */
export function StreakLab({ initialSeed = 1, onCompleted }: StreakLabProps) {
  const [kind, setKind] = useState<Kind>('sevens');
  const [n, setN] = useState(3);
  const [total, setTotal] = useState(6);
  const [seed, setSeed] = useState(initialSeed);
  const [result, setResult] = useState<StreakResult | null>(null);
  const [busy, setBusy] = useState(false);

  const condition: StreakCondition =
    kind === 'sevens' ? { kind, n } : kind === 'drought' ? { kind, total, n } : { kind, n };
  const run = (s: number) => {
    setBusy(true);
    // yield once so the button shows its busy state before the (short) scan blocks the thread
    setTimeout(() => {
      const r = scanStreaks({ seed: s, rolls: LAB_ROLLS, condition });
      setResult(r);
      setBusy(false);
      onCompleted?.(LAB_ROLLS);
    }, 0);
  };
  const maxN = kind === 'drought' ? 40 : kind === 'points' ? 6 : 6;
  const biggest = result
    ? Math.max(...Object.values(result.stats).map((s) => Math.abs(s.z ?? 0)))
    : 0;

  return (
    <section class="sim-autoroll sim-streaks" aria-label="Streak lab" data-testid="streak-lab">
      <h3>Streak lab</h3>
      <p class="sim-sweep-intro">
        {count(LAB_ROLLS)} dice rolls, no bets. Pick a streak and see what the dice do next. If dice
        had a memory, the numbers below would drift away from the exact chance.
      </p>
      <div class="sim-streak-form">
        <label>
          Streak
          <select
            value={kind}
            onChange={(e) => {
              const k = e.currentTarget.value as Kind;
              setKind(k);
              setN(k === 'drought' ? 15 : 3);
            }}
          >
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {kind === 'drought' ? (
          <label>
            Number
            <select value={total} onChange={(e) => setTotal(Number(e.currentTarget.value))}>
              {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          How many
          <input
            type="number"
            min={1}
            max={maxN}
            value={n}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v)) setN(Math.round(v));
            }}
            onBlur={() => setN((v) => Math.max(1, Math.min(maxN, Math.round(v) || 1)))}
          />
        </label>
      </div>
      <div class="sim-sweep-actions">
        <button
          type="button"
          class="sim-ar-run"
          data-testid="streak-run"
          disabled={busy}
          onClick={() => run(seed)}
        >
          {busy ? 'Rolling...' : result ? 'Run again' : `Roll ${count(LAB_ROLLS)}`}
        </button>
        {result ? (
          <button
            type="button"
            class="sim-ar-btn"
            disabled={busy}
            onClick={() => {
              setSeed(seed + 1);
              run(seed + 1);
            }}
          >
            New dice
          </button>
        ) : null}
      </div>
      {result ? (
        <div data-testid="streak-result">
          <p class="sim-sr" role="status">
            Done: {conditionText(result.condition)}, {count(result.rolls)} rolls scanned.
          </p>
          <p>
            <strong>{conditionText(result.condition)}:</strong>
          </p>
          <ul class="sim-streak-list">
            {(Object.keys(TARGET_LABEL) as StreakTarget[]).map((t) => (
              <li key={t} data-testid="streak-row">
                <strong>{TARGET_LABEL[t]}:</strong> {statText(result.stats[t])}
              </li>
            ))}
          </ul>
          <p class="sim-sweep-intro">
            {biggest < 3
              ? 'Every figure sits within the normal wobble of its exact chance. A streak tells you nothing about the next roll.'
              : 'One figure wandered a little, but with this few samples a bit of wobble is expected. Run it again with new dice and it will wander somewhere else.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}
