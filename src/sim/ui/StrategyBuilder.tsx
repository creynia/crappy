import { useId } from 'preact/hooks';
import type { PointNumber } from '../engine/types';
import { PRESETS_AS_CUSTOM, MAX_COME_BETS, encodeCustom, validateCustom } from '../strategy/custom';
import { getStrategy } from '../strategy';
import type { CustomSystem, OddsSetting, StrategyId } from '../strategy/types';
import './strategyBuilder.css';

export interface StrategyBuilderProps {
  value: CustomSystem;
  onChange: (c: CustomSystem) => void;
  disabled?: boolean;
}

const POINTS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];
const ODDS: readonly OddsSetting[] = [0, 1, 2, 3, 5, 10, 'max'];
const UNITS: readonly number[] = [0.5, 1, 1.2, 2, 3, 5];
const oddsLabel = (o: OddsSetting) => (o === 'max' ? 'Max' : o === 0 ? 'None' : `${o}x`);
const unitsLabel = (u: number) => `${u}×`;
const START_FROM = Object.keys(PRESETS_AS_CUSTOM) as StrategyId[];

/** The "My system" form (I013): declarative blocks the custom strategy plays. */
export function StrategyBuilder({ value: c, onChange, disabled }: StrategyBuilderProps) {
  const id = useId();
  const set = (patch: Partial<CustomSystem>) => {
    const next: CustomSystem = { ...c, ...patch };
    for (const k of Object.keys(next) as (keyof CustomSystem)[])
      if (next[k] === undefined) delete next[k];
    onChange(next);
  };
  const errors = validateCustom(c).map((e) => e.replace(/^custom\.?[^:]*: /, ''));
  const lineSide = c.line?.side ?? 'none';
  const nums = c.numbers;
  const chosen = new Map((nums?.bets ?? []).map((b) => [b.n, b.units]));
  const setNumbers = (kind: 'place' | 'buy' | 'lay' | 'none', m: Map<PointNumber, number>) => {
    if (kind === 'none' || m.size === 0) {
      set({ numbers: undefined, onWin: undefined });
      return;
    }
    const bets = POINTS.filter((n) => m.has(n)).map((n) => ({ n, units: m.get(n)! }));
    let onWin = c.onWin;
    if (onWin?.kind === 'regress') {
      const keep = onWin.keep.filter((n) => m.has(n));
      onWin = keep.length && keep.length < bets.length ? { ...onWin, keep } : undefined;
    }
    if (kind === 'lay') onWin = undefined;
    set({ numbers: { kind, bets }, onWin });
  };
  const link = errors.length ? null : `#/play?system=${encodeCustom(c)}`;

  return (
    <div class="sim-sb" role="group" aria-labelledby={`${id}-h`}>
      <p id={`${id}-h`} class="sim-sb-title">
        Build your system
      </p>
      <label class="sim-sb-row">
        Start from
        <select
          value=""
          disabled={disabled}
          onChange={(e) => {
            const p = PRESETS_AS_CUSTOM[e.currentTarget.value as StrategyId];
            if (p) onChange(JSON.parse(JSON.stringify(p)) as CustomSystem);
          }}
        >
          <option value="">Pick a known system…</option>
          {START_FROM.map((s) => (
            <option key={s} value={s}>
              {getStrategy(s).name}
            </option>
          ))}
        </select>
      </label>

      <fieldset class="sim-sb-block">
        <legend>Line bet</legend>
        <label class="sim-sb-row">
          Bet
          <select
            name="line"
            value={lineSide}
            disabled={disabled}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v === 'none') set({ line: undefined, come: undefined, onLoss: undefined });
              else
                set({
                  line: { side: v as 'pass' | 'dont', odds: c.line?.odds ?? 'max' },
                  ...(v === 'dont' ? { onLoss: undefined } : {}),
                });
            }}
          >
            <option value="none">None</option>
            <option value="pass">Pass line</option>
            <option value="dont">Don't pass</option>
          </select>
        </label>
        {c.line ? (
          <>
            <label class="sim-sb-row">
              Odds
              <select
                name="lineOdds"
                value={String(c.line.odds)}
                disabled={disabled}
                onChange={(e) =>
                  set({ line: { ...c.line!, odds: parseOdds(e.currentTarget.value) } })
                }
              >
                {ODDS.map((o) => (
                  <option key={o} value={String(o)}>
                    {oddsLabel(o)}
                  </option>
                ))}
              </select>
            </label>
            <label class="sim-sb-row">
              {c.line.side === 'dont' ? "Don't come bets" : 'Come bets'}
              <select
                name="comeCount"
                value={String(c.come?.count ?? 0)}
                disabled={disabled || !!c.onLoss}
                onChange={(e) => {
                  const count = Number(e.currentTarget.value);
                  set({ come: count ? { count, odds: c.come?.odds ?? c.line!.odds } : undefined });
                }}
              >
                {Array.from({ length: MAX_COME_BETS + 1 }, (_, i) => (
                  <option key={i} value={String(i)}>
                    {i === 0 ? 'None' : `Up to ${i}`}
                  </option>
                ))}
              </select>
            </label>
            {c.come ? (
              <label class="sim-sb-row">
                Come odds
                <select
                  name="comeOdds"
                  value={String(c.come.odds)}
                  disabled={disabled}
                  onChange={(e) =>
                    set({ come: { ...c.come!, odds: parseOdds(e.currentTarget.value) } })
                  }
                >
                  {ODDS.map((o) => (
                    <option key={o} value={String(o)}>
                      {oddsLabel(o)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
      </fieldset>

      <fieldset class="sim-sb-block">
        <legend>Numbers (after a point)</legend>
        <label class="sim-sb-row">
          Bet type
          <select
            name="numbersKind"
            value={nums?.kind ?? 'none'}
            disabled={disabled}
            onChange={(e) => {
              const k = e.currentTarget.value as 'place' | 'buy' | 'lay' | 'none';
              const m = chosen.size
                ? chosen
                : new Map<PointNumber, number>([
                    [6, 1],
                    [8, 1],
                  ]);
              setNumbers(k, m);
            }}
          >
            <option value="none">None</option>
            <option value="place">Place</option>
            <option value="buy">Buy</option>
            <option value="lay">Lay</option>
          </select>
        </label>
        {nums ? (
          <div class="sim-sb-nums">
            {POINTS.map((n) => (
              <div key={n} class="sim-sb-num">
                <label>
                  <input
                    type="checkbox"
                    name={`n${n}`}
                    checked={chosen.has(n)}
                    disabled={disabled}
                    onChange={(e) => {
                      const m = new Map(chosen);
                      if (e.currentTarget.checked) m.set(n, 1);
                      else m.delete(n);
                      setNumbers(nums.kind, m);
                    }}
                  />
                  {n}
                </label>
                {chosen.has(n) ? (
                  <select
                    aria-label={`Units on ${n}`}
                    name={`u${n}`}
                    value={String(chosen.get(n))}
                    disabled={disabled}
                    onChange={(e) => {
                      const m = new Map(chosen);
                      m.set(n, Number(e.currentTarget.value));
                      setNumbers(nums.kind, m);
                    }}
                  >
                    {withValue(UNITS, chosen.get(n)!).map((u) => (
                      <option key={u} value={String(u)}>
                        {unitsLabel(u)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <label class="sim-sb-check">
          <input
            type="checkbox"
            name="field"
            checked={!!c.field}
            disabled={disabled}
            onChange={(e) => set({ field: e.currentTarget.checked ? { units: 1 } : undefined })}
          />
          Field bet on every roll after the point (1 unit)
        </label>
      </fieldset>

      <fieldset class="sim-sb-block">
        <legend>Progression</legend>
        <label class="sim-sb-row">
          After a number wins
          <select
            name="onWin"
            value={c.onWin?.kind ?? 'none'}
            disabled={disabled || !nums || nums.kind === 'lay'}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v === 'press') set({ onWin: { kind: 'press', units: 1, capTimes: 5 } });
              else if (v === 'regress') {
                const keep = (nums?.bets ?? []).map((b) => b.n).filter((n) => n === 6 || n === 8);
                const all = (nums?.bets ?? []).map((b) => b.n);
                const k = keep.length && keep.length < all.length ? keep : all.slice(0, -1);
                set({ onWin: { kind: 'regress', keep: k } });
              } else set({ onWin: undefined });
            }}
          >
            <option value="none">Collect (no change)</option>
            <option value="press">Press it</option>
            <option value="regress" disabled={(nums?.bets.length ?? 0) < 2}>
              Regress (take some down)
            </option>
          </select>
        </label>
        {c.onWin?.kind === 'press' ? (
          <label class="sim-sb-row">
            Press up to
            <select
              name="pressCap"
              value={String(c.onWin.capTimes)}
              disabled={disabled}
              onChange={(e) =>
                set({ onWin: { kind: 'press', units: 1, capTimes: Number(e.currentTarget.value) } })
              }
            >
              {[2, 3, 5, 10].map((x) => (
                <option key={x} value={String(x)}>
                  {x}× the starting bet
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {c.onWin?.kind === 'regress' && nums ? (
          <div class="sim-sb-row" role="group" aria-label="Keep up after the first hit">
            Keep up
            {nums.bets.map((b) => (
              <label key={b.n} class="sim-sb-check">
                <input
                  type="checkbox"
                  name={`keep${b.n}`}
                  checked={(c.onWin as { keep: PointNumber[] }).keep.includes(b.n)}
                  disabled={disabled}
                  onChange={(e) => {
                    const cur = (c.onWin as { keep: PointNumber[] }).keep;
                    const keep = e.currentTarget.checked
                      ? [...cur, b.n]
                      : cur.filter((x) => x !== b.n);
                    set({ onWin: { kind: 'regress', keep } });
                  }}
                />
                {b.n}
              </label>
            ))}
          </div>
        ) : null}
        <label class="sim-sb-row">
          After a pass line loss
          <select
            name="onLoss"
            value={c.onLoss ? String(c.onLoss.maxDoublings) : 'none'}
            disabled={disabled || c.line?.side !== 'pass' || !!c.come}
            onChange={(e) => {
              const v = e.currentTarget.value;
              set({
                onLoss: v === 'none' ? undefined : { kind: 'martingale', maxDoublings: Number(v) },
              });
            }}
          >
            <option value="none">Same bet</option>
            {[3, 5, 8, 30].map((x) => (
              <option key={x} value={String(x)}>
                Double it (Martingale), up to {x} times
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {errors.length ? (
        <ul class="sim-sb-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {link ? (
        <label class="sim-sb-row sim-sb-link">
          Link to this system
          <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </label>
      ) : null}
    </div>
  );
}

function parseOdds(v: string): OddsSetting {
  return v === 'max' ? 'max' : Number(v);
}
function withValue(xs: readonly number[], v: number): number[] {
  return [...new Set([...xs, v])].sort((a, b) => a - b);
}
