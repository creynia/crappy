/** Exact rational, normalized (d > 0, gcd(n, d) = 1). */
export interface Fraction {
  n: bigint;
  d: bigint;
}
export function frac(_n: bigint | number, _d?: bigint | number): Fraction {
  throw new Error('TODO(math)');
}
export function fromInt(_n: number): Fraction {
  throw new Error('TODO(math)');
}
export function add(_a: Fraction, _b: Fraction): Fraction {
  throw new Error('TODO(math)');
}
export function sub(_a: Fraction, _b: Fraction): Fraction {
  throw new Error('TODO(math)');
}
export function mul(_a: Fraction, _b: Fraction): Fraction {
  throw new Error('TODO(math)');
}
export function div(_a: Fraction, _b: Fraction): Fraction {
  throw new Error('TODO(math)');
}
export function neg(_a: Fraction): Fraction {
  throw new Error('TODO(math)');
}
export function cmp(_a: Fraction, _b: Fraction): -1 | 0 | 1 {
  throw new Error('TODO(math)');
}
export function toNumber(_a: Fraction): number {
  throw new Error('TODO(math)');
}
