import { useId } from 'preact/hooks';
import type { Cents } from '../engine/types';

/** One drawn series. All arrays are indexed by roll (0 = start). Money in cents; survival in 0..1. */
export interface ChartSeries {
  id: string;
  label: string;
  /** main line: equity (one session), median (many sessions) or solvent share (survival) */
  line: ArrayLike<number>;
  /** p10..p90 band for many sessions */
  band?: { lo: ArrayLike<number>; hi: ArrayLike<number> };
  /** dashed expected line (start - cumulative expected loss) */
  expected?: ArrayLike<number>;
}
export type ChartMode = 'running' | 'sessions' | 'survival';

export interface BankrollChartProps {
  mode: ChartMode;
  series: ChartSeries[];
  /** starting bankroll in cents (break-even reference line) */
  start: Cents;
  title?: string;
  /** extra sentence for the accessible description */
  summary?: string;
  /** how many sessions, for wording */
  sessions?: number;
}

const W = 640;
const H = 300;
const M = { l: 58, r: 96, t: 14, b: 38 };
const MAX_POINTS = 360;
/** Line dash per series so lines differ without colour; expected lines are dotted. */
export const SERIES_DASH: Array<string | undefined> = [undefined, '14 5', '3 3 10 3'];
const EXPECTED_DASH = '2 4';
export const SERIES_COLORS = ['#2f6fed', '#d9480f', '#2b8a3e'];
const hidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export function formatAxisMoney(cents: number): string {
  const d = Math.round(cents) / 100;
  const a = Math.abs(d);
  const s = a >= 10_000 ? `${trim(a / 1000)}k` : a >= 1000 ? `${trim(a / 1000, 2)}k` : trim(a, 0);
  return `${d < 0 ? '-' : ''}$${s}`;
}
function trim(x: number, digits = 1): string {
  return String(Number(x.toFixed(digits)));
}
function money(cents: number): string {
  const d = cents / 100;
  const s = Math.abs(d).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(d) ? 0 : 2,
  });
  return `${d < 0 ? '-' : ''}$${s}`;
}

function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}
function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (hi - lo < 1e-9) {
    hi = lo + 1;
  }
  const step = niceStep(hi - lo, n);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Math.round(v / step) * step);
  return out;
}

function lastIndex(series: ChartSeries[]): number {
  let n = 1;
  for (const s of series) n = Math.max(n, s.line.length);
  return n - 1;
}

export function BankrollChart({
  mode,
  series,
  start,
  title,
  summary,
  sessions,
}: BankrollChartProps) {
  const last = lastIndex(series);
  const money$ = mode !== 'survival';
  const heading =
    title ??
    (mode === 'survival'
      ? 'Share of sessions still solvent'
      : mode === 'sessions'
        ? 'Bankroll across many sessions'
        : 'Bankroll over the session');

  // y domain
  let lo = money$ ? start : 0;
  let hi = money$ ? start : 1;
  if (money$) {
    for (const s of series) {
      for (const arr of [s.line, s.expected, s.band?.lo, s.band?.hi]) {
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]!;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    const pad = Math.max((hi - lo) * 0.06, 100);
    lo -= pad;
    hi += pad;
  }
  const yTicks = money$ ? niceTicks(lo, hi) : [0, 0.25, 0.5, 0.75, 1];
  if (money$) {
    lo = Math.min(lo, yTicks[0]!);
    hi = Math.max(hi, yTicks[yTicks.length - 1]!);
  }
  const xTicks = niceTicks(0, Math.max(last, 1), 5).map(Math.round);
  const px = (i: number) => M.l + (last === 0 ? 0 : (i / last) * (W - M.l - M.r));
  const py = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const stride = Math.max(1, Math.ceil(last / MAX_POINTS));
  const idxs: number[] = [];
  for (let i = 0; i <= last; i += stride) idxs.push(i);
  if (idxs[idxs.length - 1] !== last) idxs.push(last);

  const path = (arr: ArrayLike<number>): string => {
    let d = '';
    let started = false;
    for (const i of idxs) {
      if (i >= arr.length) break;
      d += `${started ? 'L' : 'M'}${px(i).toFixed(1)} ${py(arr[i]!).toFixed(1)}`;
      started = true;
    }
    return d;
  };
  const bandPath = (b: { lo: ArrayLike<number>; hi: ArrayLike<number> }): string => {
    const ix = idxs.filter((i) => i < b.hi.length);
    const up = ix.map((i) => `${px(i).toFixed(1)} ${py(b.hi[i]!).toFixed(1)}`);
    const down = ix
      .slice()
      .reverse()
      .map((i) => `${px(i).toFixed(1)} ${py(b.lo[i]!).toFixed(1)}`);
    return up.length ? `M${up.join('L')}L${down.join('L')}Z` : '';
  };

  // direct end label per series; nudged apart when the lines finish close together
  const endLabels = series
    .map((s, k) => ({
      id: s.id,
      color: SERIES_COLORS[k % SERIES_COLORS.length]!,
      text: s.label.length > 14 ? `${s.label.slice(0, 13)}…` : s.label,
      y: py(s.line[Math.min(last, s.line.length - 1)] ?? 0),
    }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    endLabels[i]!.y = Math.max(endLabels[i]!.y, endLabels[i - 1]!.y + 13);
  }

  const fmtY = (v: number) => (money$ ? formatAxisMoney(v) : `${Math.round(v * 100)}%`);
  const fmtVal = (v: number) => (money$ ? money(v) : `${Math.round(v * 1000) / 10}%`);
  const checkpoints = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * last));
  const ids = useId();
  const desc = [
    summary,
    ...series.map((s) => {
      const end = s.line[Math.min(last, s.line.length - 1)] ?? 0;
      const base = `${s.label}: ${money$ ? 'ends at' : 'ends with'} ${fmtVal(end)} after ${last} rolls.`;
      if (s.expected && money$) {
        return `${base} Expected value ${fmtVal(s.expected[Math.min(last, s.expected.length - 1)] ?? 0)}.`;
      }
      return base;
    }),
    money$ ? `Starting bankroll ${money(start)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure
      class="sim-chart"
      data-testid="bankroll-chart"
      style={{ margin: 0, position: 'relative' }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${ids}-t ${ids}-d`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title id={`${ids}-t`}>{heading}</title>
        <desc id={`${ids}-d`}>{desc}</desc>
        {/* grid and axes */}
        <g font-size="11" fill="currentColor" aria-hidden="true">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={py(v)}
                y2={py(v)}
                stroke="currentColor"
                stroke-opacity="0.15"
              />
              <text x={M.l - 6} y={py(v) + 4} text-anchor="end">
                {fmtY(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={px(v)} y={H - M.b + 16} text-anchor="middle">
              {v}
            </text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} text-anchor="middle">
            Rolls
          </text>
          <line
            x1={M.l}
            x2={M.l}
            y1={M.t}
            y2={H - M.b}
            stroke="currentColor"
            stroke-opacity="0.5"
          />
          <line
            x1={M.l}
            x2={W - M.r}
            y1={H - M.b}
            y2={H - M.b}
            stroke="currentColor"
            stroke-opacity="0.5"
          />
        </g>
        {money$ && (
          <g aria-hidden="true">
            <line
              data-testid="break-even"
              x1={M.l}
              x2={W - M.r}
              y1={py(start)}
              y2={py(start)}
              stroke="currentColor"
              stroke-opacity="0.6"
              stroke-width="1.5"
            />
            <text
              x={W - M.r - 2}
              y={py(start) - 4}
              font-size="11"
              fill="currentColor"
              text-anchor="end"
            >
              Break even {money(start)}
            </text>
          </g>
        )}
        <g font-size="11" aria-hidden="true" data-role="end-labels">
          {endLabels.map((l) => (
            <text key={l.id} x={px(last) + 6} y={l.y + 4} fill={l.color}>
              {l.text}
            </text>
          ))}
        </g>
        {series.map((s, k) => {
          const c = SERIES_COLORS[k % SERIES_COLORS.length]!;
          return (
            <g key={s.id} data-series={s.id} aria-hidden="true">
              {s.band && (
                <path
                  d={bandPath(s.band)}
                  fill={c}
                  fill-opacity="0.18"
                  stroke="none"
                  data-role="band"
                />
              )}
              {s.expected && (
                <path
                  d={path(s.expected)}
                  fill="none"
                  stroke={c}
                  stroke-width="1.5"
                  stroke-dasharray={EXPECTED_DASH}
                  stroke-opacity="0.85"
                  data-role="expected"
                />
              )}
              <path
                d={path(s.line)}
                fill="none"
                stroke={c}
                stroke-width="2.25"
                stroke-linejoin="round"
                stroke-dasharray={SERIES_DASH[k % SERIES_DASH.length]}
                data-role="line"
              />
            </g>
          );
        })}
      </svg>
      <ul
        class="sim-chart-legend"
        style={{
          listStyle: 'none',
          margin: '4px 0 0',
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          fontSize: '0.85em',
        }}
      >
        {series.map((s, k) => {
          const c = SERIES_COLORS[k % SERIES_COLORS.length]!;
          return (
            <li key={s.id}>
              <svg
                width="28"
                height="10"
                aria-hidden="true"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              >
                <line
                  x1="0"
                  x2="28"
                  y1="5"
                  y2="5"
                  stroke={c}
                  stroke-width="3"
                  stroke-dasharray={SERIES_DASH[k % SERIES_DASH.length]}
                />
              </svg>
              {s.label}
              {s.band ? ' (median, shaded 10th to 90th percentile)' : ''}
            </li>
          );
        })}
        {money$ && series.some((s) => s.expected) && (
          <li>
            <svg
              width="28"
              height="10"
              aria-hidden="true"
              style={{ verticalAlign: 'middle', marginRight: 4 }}
            >
              <line
                x1="0"
                x2="28"
                y1="5"
                y2="5"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray={EXPECTED_DASH}
              />
            </svg>
            Expected (start minus expected loss)
          </li>
        )}
      </ul>
      <table style={hidden} data-testid="chart-summary">
        <caption>
          {heading}
          {sessions && sessions > 1 ? `, ${sessions} sessions` : ''}
        </caption>
        <thead>
          <tr>
            <th scope="col">Series</th>
            {checkpoints.map((c) => (
              <th key={c} scope="col">
                Roll {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.flatMap((s) => {
            const at = (a: ArrayLike<number>, i: number) =>
              fmtVal(a[Math.min(i, a.length - 1)] ?? 0);
            const rows = [
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                {checkpoints.map((c) => (
                  <td key={c}>{at(s.line, c)}</td>
                ))}
              </tr>,
            ];
            if (s.expected) {
              rows.push(
                <tr key={`${s.id}-e`}>
                  <th scope="row">{s.label} expected</th>
                  {checkpoints.map((c) => (
                    <td key={c}>{at(s.expected!, c)}</td>
                  ))}
                </tr>,
              );
            }
            if (s.band) {
              rows.push(
                <tr key={`${s.id}-lo`}>
                  <th scope="row">{s.label} 10th percentile</th>
                  {checkpoints.map((c) => (
                    <td key={c}>{at(s.band!.lo, c)}</td>
                  ))}
                </tr>,
                <tr key={`${s.id}-hi`}>
                  <th scope="row">{s.label} 90th percentile</th>
                  {checkpoints.map((c) => (
                    <td key={c}>{at(s.band!.hi, c)}</td>
                  ))}
                </tr>,
              );
            }
            return rows;
          })}
        </tbody>
      </table>
    </figure>
  );
}
