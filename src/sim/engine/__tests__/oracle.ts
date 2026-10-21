/**
 * Independent oracle: resolves one bet against one roll from the plain-English rules.
 * Deliberately does NOT import bets.ts; it only knows rule values (as plain data).
 */
export interface OracleRules {
  payoutUnit: number;
  vigTiming: 'on-win' | 'upfront';
  vigRounding: 'floor-dollar-min-1' | 'exact-cents';
  field2: number;
  field12: number;
}

export type OracleOut =
  | { kind: 'none' }
  | { kind: 'lose' }
  | { kind: 'push' }
  | { kind: 'win'; profit: number; vig: number }
  | { kind: 'travel'; point: number }
  | { kind: 'return'; reason: string };

export interface OracleIn {
  type: string; // bet type id
  amount: number; // cents
  betPoint: number | null; // come/dc/odds point
  phase: 'come-out' | 'point';
  point: number | null; // table point
  d1: number;
  d2: number;
  upfrontPaid?: boolean; // upfront vig already paid and not yet consumed by a win
  working: boolean; // already decided by the caller (only matters for toggleable bets)
  rules: OracleRules;
  hop?: [number, number]; // hop bets: the chosen pair, in either order
}

const WIN: OracleOut = { kind: 'win', profit: 0, vig: 0 };
const L: OracleOut = { kind: 'lose' };
const N: OracleOut = { kind: 'none' };

function paid(amount: number, num: number, den: number, unit: number): number {
  // profit = amount * num / den, never rounded up, in whole `unit`s
  const units = Math.floor((amount * num) / den / unit + 1e-9);
  return units * unit;
}

function vigOn(base: number, r: OracleRules): number {
  if (r.vigRounding === 'exact-cents') return Math.round(base / 20);
  return Math.max(100, Math.floor(base / 2000) * 100);
}

const PLACE: Record<number, [number, number]> = {
  4: [9, 5],
  10: [9, 5],
  5: [7, 5],
  9: [7, 5],
  6: [7, 6],
  8: [7, 6],
};
const TRUE: Record<number, [number, number]> = {
  4: [2, 1],
  10: [2, 1],
  5: [3, 2],
  9: [3, 2],
  6: [6, 5],
  8: [6, 5],
};
const AGAINST: Record<number, [number, number]> = {
  4: [1, 2],
  10: [1, 2],
  5: [2, 3],
  9: [2, 3],
  6: [5, 6],
  8: [5, 6],
};

const TOGGLEABLE = /^(place|buy|lay|hard|big)-|^come-odds$/;

export function oracle(i: OracleIn): OracleOut {
  const t = i.d1 + i.d2;
  const hard = i.d1 === i.d2;
  const { amount: a, rules: r } = i;
  const even = (): OracleOut => ({ kind: 'win', profit: paid(a, 1, 1, r.payoutUnit), vig: 0 });
  const winAt = (num: number, den: number, vig = 0): OracleOut => ({
    kind: 'win',
    profit: paid(a, num, den, r.payoutUnit),
    vig,
  });
  void WIN;
  const upfrontCovered = r.vigTiming === 'upfront' && i.upfrontPaid === true;

  if (TOGGLEABLE.test(i.type) && !i.working) {
    if (i.type === 'come-odds' && i.betPoint !== null && (t === 7 || t === i.betPoint)) {
      return { kind: 'return', reason: 'odds-off' };
    }
    return N;
  }
  const m = /^(place|buy|lay|big|hard)-(\d+)$/.exec(i.type);
  const n = m ? Number(m[2]) : 0;
  const cat = m ? m[1] : '';

  if (cat === 'place') {
    if (t === n) return winAt(PLACE[n]![0], PLACE[n]![1]);
    return t === 7 ? L : N;
  }
  if (cat === 'buy') {
    if (t === n) {
      const [x, y] = TRUE[n]!;
      return winAt(x, y, upfrontCovered ? 0 : vigOn(a, r));
    }
    return t === 7 ? L : N;
  }
  if (cat === 'lay') {
    if (t === 7) {
      const [x, y] = AGAINST[n]!;
      const profit = paid(a, x, y, r.payoutUnit);
      return { kind: 'win', profit, vig: upfrontCovered ? 0 : vigOn(profit, r) };
    }
    return t === n ? L : N;
  }
  if (cat === 'big') {
    if (t === n) return even();
    return t === 7 ? L : N;
  }
  if (cat === 'hard') {
    const mult = n === 4 || n === 10 ? 7 : 9;
    if (t === n && hard) return winAt(mult, 1);
    if (t === 7 || t === n) return L; // seven, or the easy way
    return N;
  }

  switch (i.type) {
    case 'pass-line':
      if (i.phase === 'come-out') {
        if (t === 7 || t === 11) return even();
        if (t === 2 || t === 3 || t === 12) return L;
        return N;
      }
      if (t === i.point) return even();
      return t === 7 ? L : N;
    case 'dont-pass':
      if (i.phase === 'come-out') {
        if (t === 2 || t === 3) return even();
        if (t === 12) return { kind: 'push' };
        if (t === 7 || t === 11) return L;
        return N;
      }
      if (t === 7) return even();
      return t === i.point ? L : N;
    case 'come':
    case 'dont-come': {
      const dont = i.type === 'dont-come';
      if (i.betPoint === null) {
        if (!dont) {
          if (t === 7 || t === 11) return even();
          if (t === 2 || t === 3 || t === 12) return L;
        } else {
          if (t === 2 || t === 3) return even();
          if (t === 12) return { kind: 'push' };
          if (t === 7 || t === 11) return L;
        }
        return { kind: 'travel', point: t };
      }
      if (!dont) {
        if (t === i.betPoint) return even();
        return t === 7 ? L : N;
      }
      if (t === 7) return even();
      return t === i.betPoint ? L : N;
    }
    case 'pass-odds':
    case 'come-odds': {
      const p = i.betPoint!;
      if (t === p) return winAt(TRUE[p]![0], TRUE[p]![1]);
      return t === 7 ? L : N;
    }
    case 'dont-pass-odds':
    case 'dont-come-odds': {
      const p = i.betPoint!;
      if (t === 7) return winAt(AGAINST[p]![0], AGAINST[p]![1]);
      return t === p ? L : N;
    }
    case 'field':
      if (t === 2) return winAt(r.field2, 1);
      if (t === 12) return winAt(r.field12, 1);
      return [3, 4, 9, 10, 11].includes(t) ? even() : L;
    case 'any-7':
      return t === 7 ? winAt(4, 1) : L;
    case 'any-craps':
      return t === 2 || t === 3 || t === 12 ? winAt(7, 1) : L;
    case 'yo-11':
      return t === 11 ? winAt(15, 1) : L;
    case 'aces-2':
      return t === 2 ? winAt(30, 1) : L;
    case 'boxcars-12':
      return t === 12 ? winAt(30, 1) : L;
    case 'ace-deuce-3':
      return t === 3 ? winAt(15, 1) : L;
    case 'horn': {
      // a quarter of the bet on each of 2, 3, 11, 12; the winner pays, the other three lose
      const u = a / 4;
      if (t === 2 || t === 12) return { kind: 'win', profit: 30 * u - 3 * u, vig: 0 };
      if (t === 3 || t === 11) return { kind: 'win', profit: 15 * u - 3 * u, vig: 0 };
      return L;
    }
    case 'c-e': {
      const u = a / 2;
      if (t === 2 || t === 3 || t === 12) return { kind: 'win', profit: 7 * u - u, vig: 0 };
      if (t === 11) return { kind: 'win', profit: 15 * u - u, vig: 0 };
      return L;
    }
    case 'world': {
      const u = a / 5;
      if (t === 2 || t === 12) return { kind: 'win', profit: 30 * u - 4 * u, vig: 0 };
      if (t === 3 || t === 11) return { kind: 'win', profit: 15 * u - 4 * u, vig: 0 };
      if (t === 7) return { kind: 'push' };
      return L;
    }
    case 'hop': {
      // One exact pair on the next roll. A pair (3-3) is one of 36 rolls and pays 30 to 1;
      // two different dice (2-4) can land either way round, two of 36 rolls, paying 15 to 1.
      if (!i.hop) throw new Error('oracle: hop needs a pair');
      const [h1, h2] = i.hop;
      const hit = (i.d1 === h1 && i.d2 === h2) || (i.d1 === h2 && i.d2 === h1);
      if (!hit) return L;
      return h1 === h2 ? winAt(30, 1) : winAt(15, 1);
    }
  }
  throw new Error(`oracle: unknown bet ${i.type}`);
}
