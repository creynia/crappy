// A practice round: 10 scored items, missed items re-asked later in the round, and items
// from the drill's spaced-review list mixed in first. Pure and deterministic given the seed.
import type { PracticeItemRef } from '../storage';
import { createDrillRng, deriveSeed } from './rng';
import type { AnyDrill, CheckResult, DrillItem } from './types';

/** Scored items per round. */
export const ROUND_SIZE = 10;
/** A missed item comes back after this many other items. */
export const REVIEW_GAP = 3;
/** How often one item may be re-asked within a round. */
export const MAX_REPEATS = 2;
/** At most this many saved review items open a round (the rest are new). */
export const REVIEW_PER_ROUND = 3;

export interface RoundEntry {
  ref: PracticeItemRef;
  item: DrillItem;
  /** false for an in-round re-ask of a missed item (does not change the score) */
  scored: boolean;
  /** came from the saved spaced-review list */
  fromReview: boolean;
  repeats: number;
}

export interface AnsweredEntry {
  entry: RoundEntry;
  answer: unknown;
  result: CheckResult;
}

export interface Round {
  drillId: string;
  level: number;
  seed: number;
  /** queue[0] is the current item */
  queue: readonly RoundEntry[];
  answered: readonly AnsweredEntry[];
  /** the last answer, shown until `nextItem` */
  feedback: AnsweredEntry | null;
  /** first-try correct answers among scored items */
  score: number;
  /** scored items answered so far */
  scoredCount: number;
  /** total scored items in this round */
  total: number;
  streak: number;
  bestStreak: number;
}

/** What to persist after an answer (see Store.recordPracticeAnswer). */
export interface AnswerEffects {
  addReview?: PracticeItemRef;
  clearReview?: PracticeItemRef;
}

export function clampLevel(drill: AnyDrill, level: number): number {
  const max = Math.max(1, drill.levels.length);
  return Number.isFinite(level) ? Math.min(max, Math.max(1, Math.floor(level))) : 1;
}

/** Regenerates an item from its reference (deterministic). */
export function itemFor(drill: AnyDrill, ref: PracticeItemRef): DrillItem {
  return drill.generate(createDrillRng(ref.seed), clampLevel(drill, ref.level));
}

export function createRound(
  drill: AnyDrill,
  opts: { seed: number; level: number; review?: readonly PracticeItemRef[]; size?: number },
): Round {
  const level = clampLevel(drill, opts.level);
  const size = opts.size ?? ROUND_SIZE;
  const seen = new Set<string>();
  const queue: RoundEntry[] = [];
  for (const ref of (opts.review ?? []).slice(0, Math.min(REVIEW_PER_ROUND, size))) {
    const r = { seed: ref.seed, level: clampLevel(drill, ref.level) };
    const item = itemFor(drill, r);
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    queue.push({ ref: r, item, scored: true, fromReview: true, repeats: 0 });
  }
  let n = 0;
  while (queue.length < size) {
    // Draw until the key is new to this round (a few tries; small drills may run out of keys).
    let ref: PracticeItemRef = { seed: deriveSeed(opts.seed, n++), level };
    let item = itemFor(drill, ref);
    for (let tries = 0; seen.has(item.key) && tries < 25; tries++) {
      ref = { seed: deriveSeed(opts.seed, n++), level };
      item = itemFor(drill, ref);
    }
    seen.add(item.key);
    queue.push({ ref, item, scored: true, fromReview: false, repeats: 0 });
  }
  return {
    drillId: drill.id,
    level,
    seed: opts.seed,
    queue,
    answered: [],
    feedback: null,
    score: 0,
    scoredCount: 0,
    total: size,
    streak: 0,
    bestStreak: 0,
  };
}

export function currentEntry(round: Round): RoundEntry | null {
  return round.feedback ? null : (round.queue[0] ?? null);
}

/** Checks the answer to the current item. Returns the next round state and what to persist. */
export function answerRound(
  drill: AnyDrill,
  round: Round,
  answer: unknown,
): { round: Round; result: CheckResult; effects: AnswerEffects } {
  const entry = currentEntry(round);
  if (!entry) throw new Error('answerRound: no current item');
  const result = drill.check(entry.item, answer);
  const rest = round.queue.slice(1);
  if (!result.ok && entry.repeats < MAX_REPEATS) {
    const again: RoundEntry = { ...entry, scored: false, repeats: entry.repeats + 1 };
    rest.splice(Math.min(REVIEW_GAP, rest.length), 0, again);
  }
  const effects: AnswerEffects = {};
  if (entry.scored && !result.ok) effects.addReview = entry.ref;
  if (entry.scored && result.ok && entry.fromReview) effects.clearReview = entry.ref;
  const streak = result.ok ? round.streak + 1 : 0;
  const answered: AnsweredEntry = { entry, answer, result };
  return {
    result,
    effects,
    round: {
      ...round,
      queue: rest,
      answered: [...round.answered, answered],
      feedback: answered,
      score: round.score + (entry.scored && result.ok ? 1 : 0),
      scoredCount: round.scoredCount + (entry.scored ? 1 : 0),
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
    },
  };
}

/** Dismisses the feedback and moves to the next item. */
export function nextItem(round: Round): Round {
  return round.feedback ? { ...round, feedback: null } : round;
}

/** True once every item (including re-asks) is answered and the last feedback dismissed. */
export function isRoundDone(round: Round): boolean {
  return round.queue.length === 0 && round.feedback === null;
}

/** Items missed at least once this round (first tries of scored items), for the summary. */
export function missedEntries(round: Round): AnsweredEntry[] {
  return round.answered.filter((a) => a.entry.scored && !a.result.ok);
}
