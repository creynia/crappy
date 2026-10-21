import { fracText } from '../math/format';
import type { OutcomeTree, TreeLeaf } from '../math/types';
import { fmtMoney, fmtPct, fracToNumber } from './text';

const net = (l: TreeLeaf) => fmtMoney(fracToNumber(l.net), { sign: true, exact: true });

/** "3/9" for P(4 before 7) rather than the reduced 1/3, so the 36ths line up with the dice. */
function givenText(l: TreeLeaf, pointWays: number): string {
  const g = l.given;
  if (!g) return '';
  const den = BigInt(pointWays + 6);
  return (g.n * den) % g.d === 0n ? `${(g.n * den) / g.d}/${den}` : fracText(g);
}

function Leaf({
  leaf,
  pointWays,
  pointProb,
}: {
  leaf: TreeLeaf;
  pointWays?: number;
  pointProb?: string;
}) {
  return (
    <li class="sim-tree-leaf">
      <span class="sim-tree-label">{leaf.label}</span>
      <span class="sim-tree-chance">
        {pointWays !== undefined && pointProb ? (
          <>
            {pointProb} × {givenText(leaf, pointWays)} = {fracText(leaf.probability)}
          </>
        ) : (
          <>
            {fracText(leaf.probability)} ({fmtPct(fracToNumber(leaf.probability), 1)})
          </>
        )}
      </span>
      <span class="sim-tree-net">{net(leaf)}</span>
    </li>
  );
}

/** Compact two-level outcome tree: come-out result, then one collapsible branch per point. */
export function OddsTree({ tree }: { tree: OutcomeTree }) {
  const { win, lose, push } = tree.totals;
  const totals = [
    ['win', win],
    ['lose', lose],
    ['push', push],
  ] as const;
  return (
    <>
      <ul class="sim-tree" aria-label="Outcome tree">
        {tree.comeOut.map((l, i) => (
          <Leaf key={`c${i}`} leaf={l} />
        ))}
        {tree.points.map((pt) => (
          <li key={pt.point} class="sim-tree-point">
            <details>
              <summary>
                <span class="sim-tree-label">Point {pt.point}</span>
                <span class="sim-tree-chance">
                  {pt.ways}/36 ({fmtPct(fracToNumber(pt.probability), 1)})
                </span>
              </summary>
              <ul>
                {pt.leaves.map((l, i) => (
                  <Leaf key={i} leaf={l} pointWays={pt.ways} pointProb={`${pt.ways}/36`} />
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      <p class="sim-tree-total">
        {totals
          .filter(([, f]) => f.n !== 0n)
          .map(([k, f]) => `Total ${k} ${fracText(f)}`)
          .join(' · ')}
      </p>
    </>
  );
}
