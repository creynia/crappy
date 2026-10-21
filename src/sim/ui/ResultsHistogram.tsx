import { useId } from 'preact/hooks';

export const RESULT_BINS = 15;
const W = 560;
const H = 240;
const M = { l: 40, r: 10, t: 14, b: 44 };

export interface ResultSeries {
  label: string;
  color: string;
  /** Final equity of each session (cents), in any order. */
  finals: ArrayLike<number>;
  /** Sessions that busted. */
  busted: number;
  /** Expected result, cents (expected final bankroll minus the start). */
  expected?: number;
}

export interface Bucketed {
  lo: number;
  hi: number;
  /** counts[series][bin], bins are equal-width over [lo, hi]. */
  counts: number[][];
}

/** Final equity minus start, bucketed into RESULT_BINS equal bins over the range that holds 0 and every result. */
export function bucketResults(series: ResultSeries[], start: number): Bucketed {
  let lo = 0;
  let hi = 0;
  for (const s of series) {
    for (let i = 0; i < s.finals.length; i++) {
      const d = s.finals[i]! - start;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    if (s.expected !== undefined) {
      lo = Math.min(lo, s.expected);
      hi = Math.max(hi, s.expected);
    }
  }
  if (hi === lo) hi = lo + 1;
  const width = (hi - lo) / RESULT_BINS;
  const counts = series.map((s) => {
    const c: number[] = new Array<number>(RESULT_BINS).fill(0);
    for (let i = 0; i < s.finals.length; i++) {
      const d = s.finals[i]! - start;
      c[Math.min(RESULT_BINS - 1, Math.floor((d - lo) / width))]! += 1;
    }
    return c;
  });
  return { lo, hi, counts };
}

/** Sessions that ended below the start. */
export function countBehind(finals: ArrayLike<number>, start: number): number {
  let n = 0;
  for (let i = 0; i < finals.length; i++) if (finals[i]! < start) n++;
  return n;
}

export function captionFor(s: ResultSeries, start: number): string {
  const n = s.finals.length;
  return `${countBehind(s.finals, start)} of ${n} sessions ended behind; ${s.busted} busted`;
}

function dollars(c: number): string {
  const sign = c < 0 ? '−' : c > 0 ? '+' : '';
  const abs = Math.abs(c) / 100;
  return `${sign}$${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
}

export interface ResultsHistogramProps {
  series: ResultSeries[];
  /** Starting bankroll, cents. */
  start: number;
}

export function ResultsHistogram({ series, start }: ResultsHistogramProps) {
  const uid = useId();
  const { lo, hi, counts } = bucketResults(series, start);
  const max = Math.max(1, ...counts.flat());
  const top = Math.ceil(max * 1.1);
  const plotW = W - M.l - M.r;
  const bw = plotW / RESULT_BINS;
  const px = (v: number) => M.l + ((v - lo) / (hi - lo)) * plotW;
  const py = (c: number) => M.t + (1 - c / top) * (H - M.t - M.b);
  const S = series.length;
  const summary = series.map((s) => `${s.label}: ${captionFor(s, start)}`).join('. ');
  const showZero = lo < 0 && hi > 0;
  const showExpected = series.filter((s) => s.expected !== undefined);
  return (
    <figure data-testid="results-histogram" style={{ margin: '8px 0 0', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title id={`${uid}-t`}>Session results</title>
        <desc id={`${uid}-d`}>{summary}</desc>
        <g font-size="11" fill="currentColor" aria-hidden="true">
          <line
            x1={M.l}
            x2={W - M.r}
            y1={py(0)}
            y2={py(0)}
            stroke="currentColor"
            stroke-opacity="0.15"
          />
          <text x={M.l - 6} y={py(0) + 4} text-anchor="end">
            0
          </text>
          <text x={M.l - 6} y={py(top) + 4} text-anchor="end">
            {top}
          </text>
          {series.map((s, si) =>
            counts[si]!.map((c, b) => {
              const x = M.l + b * bw + bw * 0.1 + (si * bw * 0.8) / S;
              const w = (bw * 0.8) / S;
              return (
                <rect
                  key={`${si}-${b}`}
                  data-series={si}
                  data-bin={b}
                  data-count={c}
                  x={x}
                  y={py(c)}
                  width={w * 0.9}
                  height={py(0) - py(c)}
                  fill={s.color}
                  fill-opacity="0.75"
                />
              );
            }),
          )}
          {showZero && (
            <line
              data-testid="zero-line"
              x1={px(0)}
              x2={px(0)}
              y1={M.t}
              y2={H - M.b}
              stroke="currentColor"
              stroke-width="1.5"
            />
          )}
          {showExpected.map((s) => {
            const x = px(s.expected!);
            return (
              <line
                key={s.label}
                data-testid="expected-marker"
                x1={x}
                x2={x}
                y1={M.t}
                y2={H - M.b}
                stroke={s.color}
                stroke-width="2"
                stroke-dasharray="4 3"
              />
            );
          })}
          <text x={M.l} y={H - M.b + 16} text-anchor="start">
            {dollars(lo)}
          </text>
          {showZero && (
            <text x={px(0)} y={H - M.b + 16} text-anchor="middle">
              $0
            </text>
          )}
          <text x={W - M.r} y={H - M.b + 16} text-anchor="end">
            {dollars(hi)}
          </text>
          <text x={(M.l + W - M.r) / 2} y={H - 6} text-anchor="middle">
            Final result per session (end minus start)
          </text>
        </g>
      </svg>
      {S > 1 && (
        <ul
          class="sim-hist-legend"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '4px 0 0',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: '0.85em',
          }}
        >
          {series.map((s) => (
            <li key={s.label} style={{ color: s.color }}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '4px 0 0', fontSize: '0.85em' }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: 'block' }}>
            {S > 1 ? `${s.label}: ` : ''}
            {captionFor(s, start)}
          </span>
        ))}
      </p>
    </figure>
  );
}
