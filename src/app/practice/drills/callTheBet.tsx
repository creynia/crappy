// Drill: "Call the bet". A legal layout and a roll: the learner calls every chip stack Wins, Loses,
// Pushes, Travels, Off or Stays, dealer-style. The answer key is the engine's own resolution of the
// roll (createGame + applyAction events), never a hand-written table.
import { useEffect, useState } from 'preact/hooks';
import {
  centerLayout,
  landscapeLayout,
  portraitLayout,
  Table,
  type StackAnnotation,
} from '../../../sim';
import {
  applyAction,
  BET_TYPES,
  createGame,
  formatMoney,
  isWorking,
  POINT_NUMBERS,
} from '../../../sim/engine';
import type {
  Bet,
  BetInit,
  Cents,
  Dice,
  Die,
  GameEvent,
  GameState,
  PointNumber,
} from '../../../sim/engine';
import { regionIdForBet } from '../../../sim/ui/layouts';
import type { RegionId, TableLayout } from '../../../sim/ui/layouts/types';
import type { DrillRng } from '../rng';
import { defineDrill, type DrillInputProps, type DrillItem } from '../types';

export type Call = 'win' | 'lose' | 'push' | 'travel' | 'off' | 'stays';

export const CALL_LABEL: Record<Call, string> = {
  win: 'Wins',
  lose: 'Loses',
  push: 'Pushes',
  travel: 'Travels',
  off: 'Off',
  stays: 'Stays',
};

/** The calls offered at each level (line bets never travel and are never off). */
export function callsFor(level: number): Call[] {
  return level <= 1
    ? ['win', 'lose', 'push', 'stays']
    : ['win', 'lose', 'push', 'travel', 'off', 'stays'];
}

export interface CallTheBetItem extends DrillItem {
  level: number;
  point: PointNumber | null;
  dice: Dice;
  /** the layout before the roll (bets as the engine created them) */
  bets: readonly Bet[];
  /** the right call per bet id */
  truth: Readonly<Record<string, Call>>;
  /** one line per bet saying why, keyed by bet id */
  why: Readonly<Record<string, string>>;
  /** cash paid on each winning bet (profit, plus the bet when it comes down), for the animation */
  payouts: Readonly<Record<string, Cents>>;
}

export type CallAnswer = Readonly<Record<string, Call>>;

/** "Come on 6", "Come Odds on 6", "Pass Line". */
export function betName(b: Bet): string {
  const label = BET_TYPES[b.type].label;
  const travels = b.type === 'come' || b.type === 'dont-come' || b.type.endsWith('come-odds');
  return travels && b.point !== null ? `${label} on ${b.point}` : label;
}

/** The engine's verdict on every bet for this roll, with a reason and the cash paid. */
export function resolveCalls(
  state: GameState,
  dice: Dice,
): { truth: Record<string, Call>; why: Record<string, string>; payouts: Record<string, Cents> } {
  const r = applyAction(state, { type: 'roll', dice });
  if (!r.ok) throw new Error(`callTheBet: roll rejected: ${r.error.message}`);
  const byId = new Map<string, GameEvent>();
  for (const e of r.events) if ('betId' in e) byId.set(e.betId, e);
  const truth: Record<string, Call> = {};
  const why: Record<string, string> = {};
  const payouts: Record<string, Cents> = {};
  const total = dice[0] + dice[1];
  for (const b of state.bets) {
    const name = betName(b);
    const e = byId.get(b.id);
    const working = isWorking(b, state);
    if (e?.type === 'bet-won') {
      truth[b.id] = 'win';
      payouts[b.id] = e.profit - e.vig + (e.staysUp ? 0 : e.amount);
      why[b.id] =
        `${name} wins ${formatMoney(e.profit - e.vig)}${e.staysUp ? ' and is left up' : ''}.`;
    } else if (e?.type === 'bet-lost') {
      truth[b.id] = 'lose';
      why[b.id] = `${name} loses.`;
    } else if (e?.type === 'bet-pushed') {
      truth[b.id] = 'push';
      const barred = (b.type === 'dont-pass' || b.type === 'dont-come') && total === 12;
      why[b.id] = barred
        ? `${name} is barred on 12: a push, no win and no loss.`
        : `${name} pushes: no win and no loss.`;
    } else if (e?.type === 'bet-travelled') {
      truth[b.id] = 'travel';
      why[b.id] = `${name} travels to the ${e.point}.`;
    } else if (e?.type === 'bet-returned' || !working) {
      truth[b.id] = 'off';
      why[b.id] =
        e?.type === 'bet-returned'
          ? `${name} is off on the come-out, so it comes back to you.`
          : `${name} is off on the come-out: no action.`;
    } else {
      truth[b.id] = 'stays';
      const line = b.type === 'pass-line' || b.type === 'dont-pass';
      why[b.id] =
        line && state.phase === 'come-out'
          ? `${name} stays: the ${total} becomes the point.`
          : `${name} stays: no decision on ${article(total)} ${total}.`;
    }
  }
  return { truth, why, payouts };
}

/** "an 8", "an 11", "a 6". */
const article = (n: number): string => (n === 8 || n === 11 ? 'an' : 'a');

const PLACE_AMOUNT = (n: PointNumber): Cents => (n === 6 || n === 8 ? 1200 : 1000);

/** A random layout for the level. May be illegal (createGame then throws); the caller retries. */
function randomLayout(
  rng: DrillRng,
  level: number,
): { point: PointNumber | null; inits: BetInit[] } {
  const point: PointNumber | null = rng.chance(0.5) ? rng.pick(POINT_NUMBERS) : null;
  const inits: BetInit[] = [];
  const line = rng.pick(['pass', 'dp', 'both'] as const);
  if (line !== 'dp') inits.push({ ref: 'pass', type: 'pass-line', amount: 1000 });
  if (line !== 'pass') inits.push({ ref: 'dp', type: 'dont-pass', amount: 1000 });
  if (level >= 2) {
    if (point !== null && line !== 'dp' && rng.chance(0.7))
      inits.push({ type: 'pass-odds', amount: 2000, parentRef: 'pass' });
    const others = rng.shuffle(POINT_NUMBERS.filter((n) => n !== point));
    const comes = others.slice(0, rng.int(0, 2));
    comes.forEach((n, i) => {
      inits.push({ ref: `c${i}`, type: 'come', amount: 1000, point: n });
      if (rng.chance(0.6)) inits.push({ type: 'come-odds', amount: 2000, parentRef: `c${i}` });
    });
    // a new Come in the box: it travels, or wins/loses on its own come-out roll
    if (point !== null && rng.chance(0.5)) inits.push({ type: 'come', amount: 1000 });
    if (rng.chance(0.3)) {
      const n = others[others.length - 1]!;
      inits.push({ type: 'dont-come', amount: 1000, point: n });
    }
  }
  if (level >= 3) {
    for (const n of rng.shuffle(POINT_NUMBERS).slice(0, rng.int(1, 2)))
      inits.push({ type: `place-${n}` as BetInit['type'], amount: PLACE_AMOUNT(n) });
    if (rng.chance(0.5)) inits.push({ type: 'field', amount: 500 });
    if (rng.chance(0.4))
      inits.push({
        type: rng.pick(['hard-4', 'hard-6', 'hard-8', 'hard-10'] as const),
        amount: 500,
      });
    if (rng.chance(0.4))
      inits.push({ type: rng.pick(['any-7', 'yo-11', 'any-craps'] as const), amount: 500 });
    if (rng.chance(0.3)) inits.push({ type: rng.pick(['big-6', 'big-8'] as const), amount: 1000 });
  }
  return { point, inits };
}

function combos(total: number): Dice[] {
  const out: Dice[] = [];
  for (let a = 1; a <= 6; a++) {
    const b = total - a;
    if (b >= 1 && b <= 6) out.push([a as Die, b as Die]);
  }
  return out;
}

function generate(rng: DrillRng, level: number): CallTheBetItem {
  let state: GameState | null = null;
  let point: PointNumber | null = null;
  for (let i = 0; i < 20 && !state; i++) {
    const l = randomLayout(rng, level);
    try {
      state = createGame({
        seed: 1,
        bankroll: 1_000_000,
        phase: l.point === null ? 'come-out' : 'point',
        point: l.point,
        bets: l.inits,
      });
      point = l.point;
    } catch {
      state = null;
    }
  }
  if (!state) {
    state = createGame({ seed: 1, bets: [{ type: 'pass-line', amount: 1000 }] });
    point = null;
  }
  // Half the time roll a total that matters to this layout: 7, the point, a bet's number, craps.
  const numbers = state.bets.map((b) => b.point ?? BET_TYPES[b.type].number);
  const deciding = [7, 2, 3, 11, 12, ...(point ? [point] : []), ...numbers].filter(
    (n): n is number => n !== null,
  );
  const dice: Dice = rng.chance(0.5) ? rng.pick(combos(rng.pick(deciding))) : rng.dice();
  const { truth, why, payouts } = resolveCalls(state, dice);
  const layoutKey = state.bets.map((b) => `${b.type}${b.point ?? ''}`).join(',');
  return {
    key: `${point ?? 'off'}|${layoutKey}|${[...dice].sort().join('')}`,
    prompt:
      point === null
        ? 'Come-out roll. Tap each stack and call it.'
        : `The point is ${point}. Tap each stack and call it.`,
    visuals: [
      { kind: 'puck', point },
      { kind: 'dice', dice },
    ],
    answer: { kind: 'custom' },
    level,
    point,
    dice,
    bets: state.bets,
    truth,
    why,
    payouts,
  };
}

/** True for bets drawn on the center (proposition) layout rather than the main felt. */
function onCenter(b: Bet): boolean {
  const rid = regionIdForBet(b.type, b.point);
  return !!rid && centerLayout.regions.some((r) => r.id === rid);
}

/** Just the regions that hold bets (e.g. two center boxes, not the whole proposition panel). */
export function cropLayout(layout: TableLayout, ids: ReadonlySet<RegionId>): TableLayout {
  const keep = layout.regions.filter((r) => ids.has(r.id));
  if (!keep.length) return layout;
  const pad = 10;
  const x0 = Math.max(0, Math.min(...keep.map((r) => r.rect.x)) - pad);
  const y0 = Math.max(0, Math.min(...keep.map((r) => r.rect.y)) - pad);
  const x1 = Math.min(layout.viewBox.w, Math.max(...keep.map((r) => r.rect.x + r.rect.w)) + pad);
  const y1 = Math.min(layout.viewBox.h, Math.max(...keep.map((r) => r.rect.y + r.rect.h)) + pad);
  const at = (p: { x: number; y: number }) => ({ x: p.x - x0, y: p.y - y0 });
  return {
    ...layout,
    viewBox: { w: x1 - x0, h: y1 - y0 },
    regions: keep.map((r) => ({
      ...r,
      rect: { ...r.rect, x: r.rect.x - x0, y: r.rect.y - y0 },
      chipSpots: Object.fromEntries(Object.entries(r.chipSpots).map(([k, p]) => [k, at(p)])),
    })),
  };
}

/** Wide landscape screens: the felt in its landscape layout, the call buttons beside it. */
function useWide(): boolean {
  const q = '(orientation: landscape) and (min-width: 700px)';
  const get = () => typeof matchMedia === 'function' && matchMedia(q).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
}

function CallTheBetInput({
  item,
  disabled,
  onAnswer,
}: DrillInputProps<CallTheBetItem, CallAnswer>) {
  const wide = useWide();
  const first = item.bets[0]?.id ?? '';
  const [st, setSt] = useState<{ key: string; calls: Record<string, Call>; sel: string }>({
    key: item.key,
    calls: {},
    sel: first,
  });
  const cur = st.key === item.key ? st : { key: item.key, calls: {}, sel: first };
  const { calls, sel } = cur;
  const done = item.bets.every((b) => calls[b.id]);
  const call = (c: Call) => {
    const next = { ...calls, [sel]: c };
    const open = item.bets.find((b) => !next[b.id]);
    setSt({ key: item.key, calls: next, sel: open?.id ?? sel });
  };
  const annotate = new Map<string, StackAnnotation>();
  for (const b of item.bets) {
    const given = calls[b.id];
    const right = item.truth[b.id]!;
    const name = betName(b);
    const givenText = given ? CALL_LABEL[given] : '?';
    annotate.set(
      b.id,
      disabled
        ? given === right
          ? { name, text: CALL_LABEL[right], tone: 'right', spoken: `${CALL_LABEL[right]}, right` }
          : {
              name,
              text: givenText,
              tone: 'wrong',
              spoken: `${given ? CALL_LABEL[given] : 'not called'}, wrong, ${CALL_LABEL[right]}`,
            }
        : {
            name,
            text: givenText,
            tone: b.id === sel ? 'selected' : 'pending',
            spoken: given ? `called ${CALL_LABEL[given]}` : 'not called yet',
          },
    );
  }
  const lost = disabled ? item.bets.filter((b) => item.truth[b.id] === 'lose') : [];
  const won = disabled
    ? item.bets
        .filter((b) => item.truth[b.id] === 'win')
        .map((bet) => ({ bet, payout: item.payouts[bet.id] ?? 0 }))
    : [];
  const table = (bets: Bet[], layout: TableLayout) =>
    bets.length ? (
      <Table
        layout={layout}
        bets={bets}
        point={item.point}
        annotate={annotate}
        lostBets={lost.filter((b) => bets.includes(b))}
        wonBets={won.filter((w) => bets.includes(w.bet))}
        onStackTap={(id) => !disabled && setSt({ key: item.key, calls, sel: id })}
        class="pr-call-table"
      />
    ) : null;
  const selBet = item.bets.find((b) => b.id === sel);
  const center = item.bets.filter(onCenter);
  return (
    <div class={`pr-call${wide ? ' is-wide' : ''}`}>
      <div class="pr-call-tables">
        {table(
          item.bets.filter((b) => !onCenter(b)),
          wide ? landscapeLayout : portraitLayout,
        )}
        {table(
          center,
          cropLayout(
            centerLayout,
            new Set(center.map((b) => regionIdForBet(b.type, b.point)!).filter(Boolean)),
          ),
        )}
      </div>
      <div class="pr-call-side">
        {disabled ? (
          <ul class="pr-call-why">
            {item.bets.map((b) => (
              <li key={b.id} class={calls[b.id] === item.truth[b.id] ? 'right' : 'wrong'}>
                {calls[b.id] === item.truth[b.id] ? '✓ Right: ' : '✗ Wrong: '}
                {item.why[b.id]}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p class="pr-call-sel" aria-live="polite">
              {selBet ? `Call: ${betName(selBet)} (${formatMoney(selBet.amount)})` : ''}
            </p>
            <div class="pr-choices" role="group" aria-label="Calls">
              {callsFor(item.level).map((c) => (
                <button
                  type="button"
                  key={c}
                  class={`pr-choice${calls[sel] === c ? ' is-picked' : ''}`}
                  aria-pressed={calls[sel] === c}
                  onClick={() => call(c)}
                >
                  {CALL_LABEL[c]}
                </button>
              ))}
            </div>
            <button
              type="button"
              class="btn pr-call-check"
              disabled={!done}
              onClick={() => onAnswer(calls)}
            >
              {done
                ? 'Check my calls'
                : `Call every stack (${Object.keys(calls).length}/${item.bets.length})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const callTheBet = defineDrill<CallTheBetItem, CallAnswer>({
  id: 'call-the-bet',
  title: 'Call the bet',
  summary: 'A whole layout and a roll: call every stack, like a dealer.',
  levels: ['Line bets', 'Add come and odds', 'Add place, hardways and props'],
  generate,
  check(item, answer) {
    const wrong = item.bets.filter((b) => answer[b.id] !== item.truth[b.id]);
    const total = item.dice[0] + item.dice[1];
    return {
      ok: wrong.length === 0,
      expected: item.bets.map((b) => `${betName(b)}: ${CALL_LABEL[item.truth[b.id]!]}`).join('; '),
      // the per-stack reasons are listed under the table; this is the one-line verdict
      explain: `Rolled ${total}: ${item.bets.length - wrong.length} of ${item.bets.length} calls right.`,
    };
  },
  Input: CallTheBetInput,
});
