import { applyAction, createGame } from '../engine';
import type { Dice, GameEvent, GameState } from '../engine';
import { tableExpectedLossPerRoll, toNumber } from '../math';
import type { SessionConfig, SessionLogEntry } from './types';

const lossFn = (s: GameState): number => toNumber(tableExpectedLossPerRoll(s));

/** The table a recorded session started from. */
export function replayStart(cfg: Pick<SessionConfig, 'rules' | 'bankroll' | 'seed'>): GameState {
  return createGame({ rules: cfg.rules, bankroll: cfg.bankroll, seed: cfg.seed });
}

/**
 * Play one recorded roll: place the logged bets, then roll the logged dice. `pre` is the table with the
 * bets down (what an animation starts from), `post` the table after the roll. The dice are forced so the
 * replay can never drift from the run, whatever the random generator does.
 */
export function replayRoll(
  state: GameState,
  entry: SessionLogEntry,
): { pre: GameState; post: GameState; events: GameEvent[] } {
  let pre = state;
  for (const a of entry.actions) {
    const r = applyAction(pre, a);
    if (!r.ok) throw new Error(`replay: ${a.type} rejected: ${r.error.message}`);
    pre = r.state;
  }
  const dice: Dice = [entry.dice[0], entry.dice[1]] as unknown as Dice;
  const r = applyAction(
    { ...pre, forcedDice: [dice] },
    { type: 'roll' },
    { expectedLossFn: lossFn },
  );
  if (!r.ok) throw new Error(`replay: roll rejected: ${r.error.message}`);
  return { pre, post: r.state, events: r.events };
}

/** The table after the first `count` recorded rolls, without animation (used to scrub). */
export function replayTo(
  cfg: Pick<SessionConfig, 'rules' | 'bankroll' | 'seed'>,
  log: readonly SessionLogEntry[],
  count: number,
): GameState {
  let s = replayStart(cfg);
  for (let i = 0; i < Math.min(count, log.length); i++) s = replayRoll(s, log[i]!).post;
  return s;
}
