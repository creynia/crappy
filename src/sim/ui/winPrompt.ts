import { BET_TYPES } from '../engine/bets';
import { applyAction } from '../engine/game';
import type { Action, Bet, Cents, GameEvent, GameState } from '../engine/types';
import { validateAction } from '../engine/validate';
import { tableExpectedLossPerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';

/** A bet that just won and stays up: the one the prompt asks about. */
export interface WinPromptTarget {
  betId: string;
  roll: number;
}

/**
 * The place or buy bet (if any) that won on this roll and is still up. Only these ask: line, come and
 * odds bets are contract bets, and a one-roll bet is gone after it wins.
 */
export function winPromptTarget(
  post: GameState,
  events: readonly GameEvent[],
): WinPromptTarget | null {
  for (const e of events) {
    if (e.type !== 'bet-won' || !e.staysUp) continue;
    const cat = BET_TYPES[e.betType].category;
    if (cat !== 'place' && cat !== 'buy') continue;
    if (post.bets.some((b) => b.id === e.betId)) return { betId: e.betId, roll: post.rollCount };
  }
  return null;
}

export type WinChoiceId = 'press' | 'same' | 'regress' | 'take-down';
export interface WinChoice {
  id: WinChoiceId;
  label: string;
  /** a one-word label for tight spaces (landscape) */
  short: string;
  /** what it does, in words ("+$12 to $24") */
  detail: string;
  /** the action it dispatches; null for "same bet" */
  action: Action | null;
  /** change in expected loss per roll for the whole layout, cents (positive = costs more) */
  deltaPerRoll: number;
}

const loss = (g: GameState): number => toNumber(tableExpectedLossPerRoll(g));

function delta(game: GameState, action: Action | null): number | null {
  if (!action) return 0;
  const r = applyAction(game, action);
  return r.ok ? loss(r.state) - loss(game) : null;
}

const dollars = (c: Cents): string => `$${(c / 100).toLocaleString('en-US')}`;

/**
 * The choices for a winning place/buy bet: press (double it), same bet, regress (halve it) and take it
 * down, each with its change in expected loss per roll. A choice the table rules would reject (over the
 * limit, short of cash, not a legal unit) is left out. "Same bet" is always offered.
 */
export function winChoices(game: GameState, bet: Bet): WinChoice[] {
  const out: WinChoice[] = [];
  const set = (amount: Cents): Action => ({ type: 'set-amount', betId: bet.id, amount });
  const press = set(bet.amount * 2);
  if (validateAction(game, press).ok) {
    const d = delta(game, press);
    if (d !== null)
      out.push({
        id: 'press',
        label: 'Press',
        short: 'Press',
        detail: `+${dollars(bet.amount)} to ${dollars(bet.amount * 2)}`,
        action: press,
        deltaPerRoll: d,
      });
  }
  out.push({
    id: 'same',
    label: 'Same bet',
    short: 'Same',
    detail: `keep ${dollars(bet.amount)}`,
    action: null,
    deltaPerRoll: 0,
  });
  const half = set(bet.amount / 2);
  if (Number.isInteger(bet.amount / 2) && validateAction(game, half).ok) {
    const d = delta(game, half);
    if (d !== null)
      out.push({
        id: 'regress',
        label: 'Regress',
        short: 'Regress',
        detail: `to ${dollars(bet.amount / 2)}`,
        action: half,
        deltaPerRoll: d,
      });
  }
  const down: Action = { type: 'remove-bet', betId: bet.id };
  if (validateAction(game, down).ok) {
    const d = delta(game, down);
    if (d !== null)
      out.push({
        id: 'take-down',
        label: 'Take down',
        short: 'Down',
        detail: `collect ${dollars(bet.amount)}`,
        action: down,
        deltaPerRoll: d,
      });
  }
  return out;
}

/** "+$0.06/roll", "-$0.06/roll" or "no change" */
export function fmtDelta(cents: number): string {
  const r = Math.round(cents);
  if (r === 0) return 'no change';
  return `${r > 0 ? '+' : '-'}$${(Math.abs(r) / 100).toFixed(2)}/roll`;
}

const KEY = 'crappy:sim:winPrompt:v1';
/** "Always same bet" is remembered across visits: true = keep asking. Storage may be missing, so guard. */
export function loadAskAfterWin(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}
export function saveAskAfterWin(ask: boolean): void {
  try {
    if (ask) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    /* ignore */
  }
}
