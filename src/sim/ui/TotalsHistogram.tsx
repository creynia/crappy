/** Counts of each dice total (index 2..12) against the expected 1-2-3-4-5-6-5-4-3-2-1 shape. */
const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
const W = 560;
const H = 260;
const M = { l: 40, r: 10, t: 14, b: 42 };
const hidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export interface TotalsHistogramProps {
  counts: ArrayLike<number>;
  title?: string;
}

export function TotalsHistogram({ counts, title = 'Dice totals' }: TotalsHistogramProps) {
  let n = 0;
  for (let t = 2; t <= 12; t++) n += counts[t] ?? 0;
  const expected = (t: number) => (n * WAYS[t]!) / 36;
  let max = 1;
  for (let t = 2; t <= 12; t++) max = Math.max(max, counts[t] ?? 0, expected(t));
  const top = Math.ceil(max * 1.1);
  const bw = (W - M.l - M.r) / 11;
  const py = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const desc =
    n === 0
      ? 'No rolls yet.'
      : `${n} rolls. ` +
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
          .map((t) => `${t}: ${counts[t] ?? 0} (expected ${expected(t).toFixed(1)})`)
          .join(', ');
  const yTicks = [0, 0.5, 1].map((f) => Math.round(top * f));
  return (
    <figure data-testid="totals-histogram" style={{ margin: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="totals-t totals-d"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title id="totals-t">{title}</title>
        <desc id="totals-d">{desc}</desc>
        <g font-size="11" fill="currentColor" aria-hidden="true">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={py(v)} y2={py(v)} stroke="currentColor" stroke-opacity="0.15" />
              <text x={M.l - 6} y={py(v) + 4} text-anchor="end">
                {v}
              </text>
            </g>
          ))}
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => {
            const x = M.l + (t - 2) * bw;
            const c = counts[t] ?? 0;
            return (
              <g key={t} data-total={t}>
                <rect
                  x={x + bw * 0.12}
                  y={py(c)}
                  width={bw * 0.76}
                  height={py(0) - py(c)}
                  fill="#2f6fed"
                  fill-opacity="0.75"
                />
                <rect
                  x={x + bw * 0.12}
                  y={py(expected(t))}
                  width={bw * 0.76}
                  height={py(0) - py(expected(t))}
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-dasharray="4 3"
                />
                <text x={x + bw / 2} y={py(c) - 3} text-anchor="middle">
                  {c}
                </text>
                <text x={x + bw / 2} y={H - M.b + 16} text-anchor="middle" font-weight={t === 7 ? 700 : 400}>
                  {t}
                </text>
              </g>
            );
          })}
          <text x={(M.l + W - M.r) / 2} y={H - 4} text-anchor="middle">
            Dice total
          </text>
        </g>
      </svg>
      <p style={{ margin: '4px 0 0', fontSize: '0.85em' }}>
        Filled bars are your rolls. Dashed outlines show the expected 1-2-3-4-5-6-5-4-3-2-1 shape.
      </p>
      <table style={hidden}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Total</th>
            <th scope="col">Rolled</th>
            <th scope="col">Expected</th>
          </tr>
        </thead>
        <tbody>
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => (
            <tr key={t}>
              <th scope="row">{t}</th>
              <td>{counts[t] ?? 0}</td>
              <td>{expected(t).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
