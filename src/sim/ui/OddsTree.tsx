import type { OutcomeTree, TreeLeaf } from '../math/types';
import { fracText } from '../math/format';
import { fmtMoney, fmtPct, fracToNumber } from './text';

function Leaf({ leaf }: { leaf: TreeLeaf }) {
  return (
    <li class="sim-tree-leaf">
      <span class="sim-tree-label">{leaf.label}</span>
      <span class="sim-tree-chance">
        {fracText(leaf.probability)} ({fmtPct(fracToNumber(leaf.probability), 1)})
      </span>
      <span class="sim-tree-net">
        {fmtMoney(fracToNumber(leaf.net), { sign: true, exact: true })}
      </span>
    </li>
  );
}

/** Compact two-level outcome tree: come-out result, then one collapsible branch per point. */
export function OddsTree({ tree }: { tree: OutcomeTree }) {
  return (
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
                {fracText(pt.probability)} ({fmtPct(fracToNumber(pt.probability), 1)})
              </span>
            </summary>
            <ul>
              {pt.leaves.map((l, i) => (
                <Leaf key={i} leaf={l} />
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
