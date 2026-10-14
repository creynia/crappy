import type { Cents } from './types';
/** Structural match for math's Fraction (engine must not import math). */
interface FractionLike {
  n: bigint;
  d: bigint;
}

/** "-$0.14" | "+$39" | "$1,250" (ASCII minus; cents omitted when zero unless < $1). */
export function formatMoney(_cents: Cents, _opts?: { sign?: boolean }): string {
  throw new Error('TODO(engine)');
}
/** "1.41%" */
export function formatPct(_fraction: FractionLike, _digits?: number): string {
  throw new Error('TODO(engine)');
}
