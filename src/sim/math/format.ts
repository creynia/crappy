import { frac, roundToInt, type Fraction } from './fraction';

function group(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "-$0.14" | "$0.00" | "+$3.33" (sign: true adds + to positives). Input in cents, rounded to the cent. */
export function money(cents: Fraction, sign = false): string {
  const c = roundToInt(cents);
  const a = c < 0n ? -c : c;
  const s = `$${group(a / 100n)}.${(a % 100n).toString().padStart(2, '0')}`;
  if (c < 0n) return `-${s}`;
  return sign && c > 0n ? `+${s}` : s;
}

/** Percentage with fixed digits, e.g. 7/495 -> "1.41%". */
export function pct(f: Fraction, digits = 2): string {
  const scale = 10n ** BigInt(digits);
  const v = roundToInt(frac(f.n * 100n * scale, f.d));
  const a = v < 0n ? -v : v;
  const whole = a / scale;
  const rest = (a % scale).toString().padStart(digits, '0');
  const body = digits > 0 ? `${whole}.${rest}` : `${whole}`;
  return `${v < 0n ? '-' : ''}${body}%`;
}

export function fracText(f: Fraction): string {
  return f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`;
}
