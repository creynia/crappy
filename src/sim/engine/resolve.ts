import { BET_TYPES } from './bets';
import { isWorking } from './working';
import type {
  Bet,
  BetTypeId,
  BetTypeStats,
  Cents,
  Dice,
  GameEvent,
  GameState,
  Phase,
  PointNumber,
  RollContext,
  RollRecord,
  SessionStats,
} from './types';

export const HISTORY_LIMIT = 200;

const emptyTypeStats = (): BetTypeStats => ({
  count: 0,
  wagered: 0,
  won: 0,
  lost: 0,
  vig: 0,
  net: 0,
  expectedLoss: 0,
});

export function resolveRoll(
  state: GameState,
  dice: Dice,
  forced: boolean,
): { state: GameState; events: GameEvent[] } {
  const total = dice[0] + dice[1];
  const hard = dice[0] === dice[1];
  const ctx: RollContext = { dice, total, hard, phase: state.phase, point: state.point };
  const { rules } = state;

  const events: GameEvent[] = [];
  const kept: Bet[] = [];
  let byType: Partial<Record<BetTypeId, BetTypeStats>> = state.stats.byType;
  let byTypeCopied = false;
  let bankroll = state.bankroll;
  let net: Cents = 0;
  let totalWagered = state.stats.totalWagered;
  let totalWon = state.stats.totalWon;
  let totalLost = state.stats.totalLost;
  let totalVig = state.stats.totalVig;

  const stat = (type: BetTypeId): BetTypeStats => {
    if (!byTypeCopied) {
      byType = { ...byType };
      byTypeCopied = true;
    }
    const cur = byType[type];
    const next = cur ? { ...cur } : emptyTypeStats();
    byType[type] = next;
    return next;
  };

  for (const bet of state.bets) {
    const def = BET_TYPES[bet.type];
    const res = def.resolve(bet, ctx, rules, isWorking(bet, state));
    switch (res.kind) {
      case 'none':
        kept.push(bet);
        break;
      case 'win': {
        const cash = res.profit - res.vig;
        const staysUp = def.afterWin === 'stays-up';
        if (staysUp) {
          kept.push(bet);
          bankroll += cash;
        } else {
          bankroll += bet.amount + cash;
        }
        net += cash;
        totalWagered += bet.amount;
        totalWon += cash;
        totalVig += res.vig;
        const st = stat(bet.type);
        st.count++;
        st.wagered += bet.amount;
        st.won += cash;
        st.vig += res.vig;
        st.net += cash;
        events.push({
          type: 'bet-won',
          betId: bet.id,
          betType: bet.type,
          amount: bet.amount,
          profit: res.profit,
          vig: res.vig,
          staysUp,
        });
        break;
      }
      case 'lose': {
        net -= bet.amount;
        totalWagered += bet.amount;
        totalLost += bet.amount;
        const st = stat(bet.type);
        st.count++;
        st.wagered += bet.amount;
        st.lost += bet.amount;
        st.net -= bet.amount;
        events.push({ type: 'bet-lost', betId: bet.id, betType: bet.type, amount: bet.amount });
        break;
      }
      case 'push': {
        totalWagered += bet.amount;
        const st = stat(bet.type);
        st.count++;
        st.wagered += bet.amount;
        if (bet.type === 'dont-pass' || bet.type === 'dont-come') {
          kept.push(bet);
        } else {
          bankroll += bet.amount;
        }
        events.push({ type: 'bet-pushed', betId: bet.id, betType: bet.type, amount: bet.amount });
        break;
      }
      case 'travel':
        kept.push({ ...bet, point: res.point });
        events.push({
          type: 'bet-travelled',
          betId: bet.id,
          betType: bet.type as 'come' | 'dont-come',
          point: res.point,
        });
        break;
      case 'return':
        bankroll += bet.amount;
        events.push({
          type: 'bet-returned',
          betId: bet.id,
          betType: bet.type,
          amount: bet.amount,
          reason: res.reason,
        });
        break;
    }
  }

  // Defensive: odds whose flat bet no longer exists are returned.
  let finalBets = kept;
  if (kept.some((b) => b.parentId !== null)) {
    const ids = new Set(kept.map((b) => b.id));
    finalBets = [];
    for (const b of kept) {
      if (b.parentId !== null && !ids.has(b.parentId)) {
        bankroll += b.amount;
        events.push({
          type: 'bet-returned',
          betId: b.id,
          betType: b.type,
          amount: b.amount,
          reason: 'parent-gone',
        });
      } else finalBets.push(b);
    }
  }

  // Phase transition
  let phase: Phase = state.phase;
  let point: PointNumber | null = state.point;
  if (state.phase === 'come-out') {
    if (total === 7 || total === 11) events.push({ type: 'natural', total });
    else if (total === 2 || total === 3 || total === 12) events.push({ type: 'craps', total });
    else {
      phase = 'point';
      point = total as PointNumber;
      events.push({ type: 'point-established', point });
    }
  } else if (total === state.point) {
    events.push({ type: 'point-made', point: state.point });
    phase = 'come-out';
    point = null;
  } else if (total === 7) {
    events.push({ type: 'seven-out', point: state.point as PointNumber });
    phase = 'come-out';
    point = null;
  }

  const n = state.rollCount + 1;
  const roll: RollRecord = {
    n,
    dice,
    total,
    hard,
    phaseBefore: state.phase,
    pointBefore: state.point,
    forced,
    net,
  };
  events.push({ type: 'dice-rolled', roll });

  const history =
    state.history.length >= HISTORY_LIMIT
      ? [...state.history.slice(state.history.length - HISTORY_LIMIT + 1), roll]
      : [...state.history, roll];

  const stats: SessionStats = {
    totalWagered,
    totalWon,
    totalLost,
    totalVig,
    expectedLoss: state.stats.expectedLoss,
    byType,
  };

  return {
    state: { ...state, phase, point, bankroll, bets: finalBets, rollCount: n, history, stats },
    events,
  };
}
