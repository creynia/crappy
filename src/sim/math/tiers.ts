import { frac, cmp, type Fraction } from './fraction';
import type { EdgeTier } from './types';

const TWO_PCT = frac(2, 100);
const FIVE_PCT = frac(5, 100);
const NINE_PCT = frac(9, 100);

/** free: e <= 0; good: <= 2%; fair: <= 5%; poor: < 9%; avoid: >= 9% (decisions.md). */
export function edgeTier(edge: Fraction): EdgeTier {
  if (edge.n <= 0n) return 'free';
  if (cmp(edge, TWO_PCT) <= 0) return 'good';
  if (cmp(edge, FIVE_PCT) <= 0) return 'fair';
  if (cmp(edge, NINE_PCT) < 0) return 'poor';
  return 'avoid';
}
