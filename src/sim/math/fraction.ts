/** Exact rational, normalized (d > 0, gcd(n, d) = 1). */
export interface Fraction {
  n: bigint;
  d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

function toBig(x: bigint | number): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isInteger(x)) throw new Error(`Fraction needs an integer, got ${x}`);
  return BigInt(x);
}

export function frac(n: bigint | number, d: bigint | number = 1): Fraction {
  let nn = toBig(n);
  let dd = toBig(d);
  if (dd === 0n) throw new Error('Fraction with zero denominator');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd);
  if (g > 1n) {
    nn /= g;
    dd /= g;
  }
  if (nn === 0n) dd = 1n;
  return { n: nn, d: dd };
}

export function fromInt(n: number): Fraction {
  return frac(n, 1);
}

export const ZERO: Fraction = { n: 0n, d: 1n };
export const ONE: Fraction = { n: 1n, d: 1n };

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function sub(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.n, a.d * b.d);
}
export function div(a: Fraction, b: Fraction): Fraction {
  if (b.n === 0n) throw new Error('Fraction division by zero');
  return frac(a.n * b.d, a.d * b.n);
}
export function neg(a: Fraction): Fraction {
  return { n: -a.n, d: a.d };
}
export function abs(a: Fraction): Fraction {
  return a.n < 0n ? neg(a) : a;
}
export function sign(a: Fraction): -1 | 0 | 1 {
  return a.n < 0n ? -1 : a.n > 0n ? 1 : 0;
}
export function cmp(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}
export function eq(a: Fraction, b: Fraction): boolean {
  return a.n === b.n && a.d === b.d;
}
export function toNumber(a: Fraction): number {
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  const an = a.n < 0n ? -a.n : a.n;
  if (an <= MAX && a.d <= MAX) return Number(a.n) / Number(a.d);
  // Large values: integer part plus a scaled remainder keeps precision.
  const whole = a.n / a.d;
  const rem = a.n - whole * a.d;
  const SCALE = 10n ** 15n;
  return Number(whole) + Number((rem * SCALE) / a.d) / 1e15;
}

/** Round to the nearest integer, ties away from zero. */
export function roundToInt(a: Fraction): bigint {
  const neg_ = a.n < 0n;
  const an = neg_ ? -a.n : a.n;
  const q = (2n * an + a.d) / (2n * a.d);
  return neg_ ? -q : q;
}
