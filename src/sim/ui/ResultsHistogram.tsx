import { useId } from 'preact/hooks';

export const RESULT_BINS = 15;
const W = 560;
const H = 300;
const M = { l: 64, r: 16, t: 16, b: 64 };
/** SVG text size in user units (the viewBox is 560 wide, so ~11px on a 390px phone). */
const FONT = 18;
/** Below this many user units from the plot edge, the $0 label would collide with an end label. */
const EDGE_CLEARANCE = 80;
const EPS = 1e-9;

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

export interface BinLayout {
  /** Left edge of the first bin, cents. Always <= 0. */
  lo: number;
  /** Right edge of the last bin, cents. Always >= 0. */
  hi: number;
  /** Bin width, cents. */
  width: number;
  /** Index of the bin that starts at 0. Bins below it hold losses, bins from it on hold wins and break-even. */
  zeroBin: number;
}

export interface Bucketed extends BinLayout {
  /** counts[series][bin]. */
  counts: number[][];
}

/**
 * Equal-width bins with 0 as a bin edge: no bin mixes losers and winners.
 * Always RESULT_BINS bins. The loss side gets bins in proportion to the loss range; each side's
 * width is wide enough for its extreme value. A range of exactly 0 gets $1 bins around 0.
 */
export function binLayout(dataLo: number, dataHi: number): BinLayout {
  if (dataLo === 0 && dataHi === 0) return { lo: -700, hi: 800, width: 100, zeroBin: 7 };
  const span = dataHi - dataLo;
  let neg = dataLo < 0 ? Math.round((RESULT_BINS * -dataLo) / span) : 0;
  const maxNeg = dataHi > 0 ? RESULT_BINS - 1 : RESULT_BINS;
  neg = Math.min(maxNeg, Math.max(dataLo < 0 ? 1 : 0, neg));
  const pos = RESULT_BINS - neg;
  const width = Math.max(neg > 0 ? -dataLo / neg : 0, pos > 0 ? dataHi / pos : 0);
  return {
    lo: neg === 0 ? 0 : -neg * width,
    hi: pos * width,
    width,
    zeroBin: neg,
  };
}

/**
 * Bin of a result d (cents, end minus start). Bins are left-closed: a value exactly on an edge
 * goes to the bin that starts there, so 0 starts the first winning bin. The top edge clamps to the last bin.
 */
export function binIndex(d: number, layout: Pick<BinLayout, 'width' | 'zeroBin'>): number {
  const idx =
    d < 0
      ? layout.zeroBin - Math.ceil(-d / layout.width - EPS)
      : layout.zeroBin + Math.floor(d / layout.width + EPS);
  return Math.min(RESULT_BINS - 1, Math.max(0, idx));
}

/** Final equity minus start, bucketed over the range that holds 0 and every result and expected value. */
export function bucketResults(series: ResultSeries[], start: number): Bucketed {
  let dataLo = 0;
  let dataHi = 0;
  for (const s of series) {
    for (let i = 0; i < s.finals.length; i++) {
      const d = s.finals[i]! - start;
      if (d < dataLo) dataLo = d;
      if (d > dataHi) dataHi = d;
    }
    if (s.expected !== undefined) {
      dataLo = Math.min(dataLo, s.expected);
      dataHi = Math.max(dataHi, s.expected);
    }
  }
  const layout = binLayout(dataLo, dataHi);
  const counts = series.map((s) => {
    const c: number[] = new Array<number>(RESULT_BINS).fill(0);
    for (let i = 0; i < s.finals.length; i++) c[binIndex(s.finals[i]! - start, layout)]! += 1;
    return c;
  });
  return { ...layout, counts };
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

export function dollars(c: number): string {
  const sign = c < 0 ? '−' : c > 0 ? '+' : '';
  const abs = Math.abs(c) / 100;
  return `${sign}$${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
}

/**
 * Series are told apart by fill as well as colour: 0 solid, 1 outlined, 2 hatched.
 * (Series beyond three reuse the pattern by index.)
 */
function styleFor(
  si: number,
  color: string,
): { fill: string; opacity?: string; stroke?: string; sw?: string } {
  switch (si % 3) {
    case 0:
      return { fill: color, opacity: '0.8' };
    case 1:
      return { fill: 'none', stroke: color, sw: '2.5' };
    default:
      return { fill: 'currentColor' };
  }
}

export interface ResultsHistogramProps {
  series: ResultSeries[];
  /** Starting bankroll, cents. */
  start: number;
}

export function ResultsHistogram({ series, start }: ResultsHistogramProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const { lo, hi, counts } = bucketResults(series, start);
  const max = Math.max(1, ...counts.flat());
  const top = Math.ceil(max * 1.1);
  const plotW = W - M.l - M.r;
  const bw = plotW / RESULT_BINS;
  const px = (v: number) => M.l + ((v - lo) / (hi - lo)) * plotW;
  const py = (c: number) => M.t + (1 - c / top) * (H - M.t - M.b);
  const S = series.length;
  const zeroX = px(0);
  const showZeroLabel = zeroX - M.l >= EDGE_CLEARANCE && W - M.r - zeroX >= EDGE_CLEARANCE;
  const labels = series.map((s) => s.label);
  const hatchId = (si: number) => `${uid}-h${si}`;
  return (
    <figure data-testid="results-histogram" style={{ margin: '8px 0 0', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        aria-describedby={`${uid}-c`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title id={`${uid}-t`}>Session results</title>
        <defs>
          {series.map((s, si) =>
            si % 3 === 2 ? (
              <pattern
                key={s.label}
                id={hatchId(si)}
                patternUnits="userSpaceOnUse"
                width="9"
                height="9"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="9" stroke={s.color} stroke-width="3.5" />
              </pattern>
            ) : null,
          )}
        </defs>
        <g font-size={FONT} fill="currentColor" aria-hidden="true">
          <line
            x1={M.l}
            x2={W - M.r}
            y1={py(0)}
            y2={py(0)}
            stroke="currentColor"
            stroke-opacity="0.15"
          />
          <text x={M.l - 8} y={py(0) + 6} text-anchor="end">
            0
          </text>
          <text x={M.l - 8} y={py(top) + 6} text-anchor="end">
            {top}
          </text>
          <text transform={`translate(20 ${(M.t + H - M.b) / 2}) rotate(-90)`} text-anchor="middle">
            sessions
          </text>
          {series.map((s, si) => {
            const st = styleFor(si, s.color);
            const fill = si % 3 === 2 ? `url(#${hatchId(si)})` : st.fill;
            return counts[si]!.map((c, b) => {
              const x = M.l + b * bw + bw * 0.1 + (si * bw * 0.8) / S;
              const w = (bw * 0.8) / S;
              return (
                <rect
                  key={`${s.label}:${b}`}
                  data-series={si}
                  data-bin={b}
                  data-count={c}
                  x={x}
                  y={py(c)}
                  width={w * 0.9}
                  height={py(0) - py(c)}
                  fill={fill}
                  fill-opacity={st.opacity}
                  stroke={st.stroke}
                  stroke-width={st.sw}
                />
              );
            });
          })}
          <line
            data-testid="zero-line"
            x1={zeroX}
            x2={zeroX}
            y1={M.t}
            y2={H - M.b}
            stroke="currentColor"
            stroke-width="2.5"
          />
          {series.map((s) =>
            s.expected === undefined ? null : (
              <line
                key={s.label}
                data-testid="expected-marker"
                x1={px(s.expected)}
                x2={px(s.expected)}
                y1={M.t}
                y2={H - M.b}
                stroke={s.color}
                stroke-width="3"
                stroke-dasharray="7 5"
              />
            ),
          )}
          <text x={M.l} y={H - M.b + 24} text-anchor="start">
            {dollars(lo)}
          </text>
          {showZeroLabel && (
            <text x={zeroX} y={H - M.b + 24} text-anchor="middle">
              $0
            </text>
          )}
          <text x={W - M.r} y={H - M.b + 24} text-anchor="end">
            {dollars(hi)}
          </text>
          <text x={(M.l + W - M.r) / 2} y={H - 8} text-anchor="middle">
            Final result per session
          </text>
        </g>
      </svg>
      {S > 1 && (
        <div class="sim-hist-legend" style={{ margin: '6px 0 0', fontSize: '0.9em' }}>
          <p style={{ margin: 0 }}>Bars in each bin, left to right: {labels.join(', ')}.</p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '4px 0 0',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {series.map((s, si) => {
              const st = styleFor(si, s.color);
              const fill = si % 3 === 2 ? `url(#${hatchId(si)})` : st.fill;
              return (
                <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <rect
                      x="1.5"
                      y="1.5"
                      width="13"
                      height="13"
                      fill={fill}
                      fill-opacity={st.opacity}
                      stroke={st.stroke ?? s.color}
                      stroke-width={st.sw ?? '1'}
                    />
                  </svg>
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p id={`${uid}-c`} style={{ margin: '6px 0 0', fontSize: '0.85em' }}>
        <span style={{ display: 'block' }}>Solid line: break-even.</span>
        {series.map((s) =>
          s.expected === undefined ? null : (
            <span key={`e-${s.label}`} style={{ display: 'block' }}>
              Dashed: expected result {dollars(s.expected)} ({s.label}).
            </span>
          ),
        )}
        {series.map((s) => (
          <span key={`c-${s.label}`} style={{ display: 'block' }}>
            {S > 1 ? `${s.label}: ` : ''}
            {captionFor(s, start)}
          </span>
        ))}
      </p>
    </figure>
  );
}
