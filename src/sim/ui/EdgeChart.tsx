import { useId } from 'preact/hooks';

export interface EdgeChartProps {
  label: string;
  /** actual result / total wagered after each roll (index = roll, 0 unused); NaN where nothing was wagered yet */
  ratio: ArrayLike<number>;
  /** house edge as a positive fraction of money bet (0.0141 = 1.41%) */
  edge: number;
  /** spread of the ratio: after n rolls its standard deviation is about sigma / sqrt(n) */
  sigma: number;
}

const W = 640;
const H = 300;
const M = { l: 58, r: 20, t: 14, b: 44 };
const BAND = 2;

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

/** Decade ticks (1, 10, 100, ...) that fit under `last`. */
function decadeTicks(last: number): number[] {
  const out = [1];
  for (let v = 10; v <= last; v *= 10) out.push(v);
  if (out[out.length - 1] !== last && last > 1 && last / out[out.length - 1]! > 2) out.push(last);
  return out;
}

function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Your result per dollar wagered, against the number of rolls on a log axis. The house edge is the
 * flat line it settles toward; the funnel is the plus or minus two standard deviations range that
 * shrinks as 1/sqrt(rolls).
 */
export function EdgeChart({ label, ratio, edge, sigma }: EdgeChartProps) {
  const ids = useId();
  const last = Math.max(1, ratio.length - 1);
  const center = -edge;
  const funnel = (n: number) => (BAND * sigma) / Math.sqrt(n);

  // y domain: wide enough for the funnel from roll `n0` on and for the final value; the very first
  // rolls (funnel of hundreds of percent) are clipped rather than allowed to flatten the chart
  const n0 = Math.min(last, Math.max(5, Math.round(last / 50)));
  let hi = center + funnel(n0);
  let lo = center - funnel(n0);
  const lastVal = ratio[last];
  if (lastVal !== undefined && Number.isFinite(lastVal)) {
    hi = Math.max(hi, lastVal);
    lo = Math.min(lo, lastVal);
  }
  hi = Math.max(hi, 0);
  const pad = (hi - lo) * 0.05;
  hi += pad;
  lo -= pad;
  const step = niceStep(hi - lo, 5);
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step)
    yTicks.push(Math.round(v / step) * step);

  const logMax = Math.log10(Math.max(last, 2));
  const px = (n: number) => M.l + (Math.log10(Math.max(n, 1)) / logMax) * (W - M.l - M.r);
  const py = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const clampY = (v: number) => Math.min(Math.max(v, lo), hi);

  // log-spaced sample points (every roll at the start, ~220 points overall)
  const idxs: number[] = [];
  for (let i = 1; i <= last; i += Math.max(1, Math.floor(i * 0.035))) idxs.push(i);
  if (idxs[idxs.length - 1] !== last) idxs.push(last);

  let line = '';
  let started = false;
  for (const i of idxs) {
    const v = ratio[i];
    if (v === undefined || !Number.isFinite(v)) continue;
    line += `${started ? 'L' : 'M'}${px(i).toFixed(1)} ${py(clampY(v)).toFixed(1)}`;
    started = true;
  }
  const up = idxs.map((i) => `${px(i).toFixed(1)} ${py(clampY(center + funnel(i))).toFixed(1)}`);
  const down = idxs
    .slice()
    .reverse()
    .map((i) => `${px(i).toFixed(1)} ${py(clampY(center - funnel(i))).toFixed(1)}`);
  const funnelPath = `M${up.join('L')}L${down.join('L')}Z`;
  const xTicks = decadeTicks(last);

  const endVal = Number.isFinite(lastVal ?? NaN) ? (lastVal as number) : 0;
  const inside = Math.abs(endVal - center) <= funnel(last);
  const desc =
    `Result per dollar wagered after ${last} rolls: ${pct(endVal, 2)}. ` +
    `House edge on this strategy: ${pct(-center, 2)} (a loss of that much per dollar bet). ` +
    `The shaded funnel is the range two standard deviations either side of the house edge; ` +
    `after ${last} rolls it is plus or minus ${pct(funnel(last), 2)}, and ` +
    (inside ? 'this session ended inside it.' : 'this session ended outside it.');
  const checkpoints = Array.from(new Set([1, 10, 100, 1000, last].filter((n) => n <= last)));

  return (
    <figure class="sim-chart" data-testid="edge-chart" style={{ margin: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${ids}-t ${ids}-d`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title id={`${ids}-t`}>Result per dollar wagered</title>
        <desc id={`${ids}-d`}>{desc}</desc>
        <defs>
          <clipPath id={`${ids}-c`}>
            <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
          </clipPath>
        </defs>
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
                {pct(v, step < 0.01 ? 1 : 0)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line
                x1={px(v)}
                x2={px(v)}
                y1={M.t}
                y2={H - M.b}
                stroke="currentColor"
                stroke-opacity="0.08"
              />
              <text x={px(v)} y={H - M.b + 16} text-anchor="middle">
                {v >= 1000 ? `${v / 1000}k` : v}
              </text>
            </g>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 6} text-anchor="middle">
            Rolls (log scale)
          </text>
          <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} text-anchor="middle">
            Result per $1 wagered
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
        <g clip-path={`url(#${ids}-c)`} aria-hidden="true">
          <line
            data-testid="edge-break-even"
            x1={M.l}
            x2={W - M.r}
            y1={py(0)}
            y2={py(0)}
            stroke="currentColor"
            stroke-opacity="0.6"
            stroke-width="1.5"
          />
          <path d={funnelPath} fill="#2f6fed" fill-opacity="0.15" data-role="funnel" />
          <line
            data-role="house-edge"
            x1={M.l}
            x2={W - M.r}
            y1={py(center)}
            y2={py(center)}
            stroke="#d9480f"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
          <path
            d={line}
            fill="none"
            stroke="#2f6fed"
            stroke-width="2.25"
            stroke-linejoin="round"
            data-role="line"
          />
        </g>
        <text x={W - M.r - 2} y={py(0) - 4} font-size="11" fill="currentColor" text-anchor="end">
          Break even
        </text>
        <text
          x={W - M.r - 2}
          y={py(center) + 14}
          font-size="11"
          fill="#d9480f"
          text-anchor="end"
          aria-hidden="true"
        >
          House edge {pct(-center, 2)}
        </text>
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
        <li>{label}: your result per dollar wagered</li>
        <li>Dashed: house edge</li>
        <li>Shaded: plus or minus 2 standard deviations, shrinking with more rolls</li>
      </ul>
      <table
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
        data-testid="edge-chart-summary"
      >
        <caption>Result per dollar wagered, {label}</caption>
        <thead>
          <tr>
            <th scope="col">Rolls</th>
            <th scope="col">Result per $1 wagered</th>
            <th scope="col">Funnel (2 standard deviations)</th>
          </tr>
        </thead>
        <tbody>
          {checkpoints.map((n) => (
            <tr key={n}>
              <th scope="row">{n}</th>
              <td>
                {Number.isFinite(ratio[n] ?? NaN) ? pct(ratio[n]!, 2) : 'nothing wagered yet'}
              </td>
              <td>
                {pct(center - funnel(n), 2)} to {pct(center + funnel(n), 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Cumulative result per dollar wagered from a session's arrays; NaN until something is wagered. */
export function edgeSeries(equity: ArrayLike<number>, wagered: ArrayLike<number>): Float64Array {
  const out = new Float64Array(equity.length);
  const start = equity[0] ?? 0;
  for (let i = 0; i < equity.length; i++) {
    const w = wagered[i] ?? 0;
    out[i] = w > 0 ? (equity[i]! - start) / w : NaN;
  }
  return out;
}
