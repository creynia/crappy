/**
 * Practice drill API.
 *
 * A drill is a small, pure, deterministic question generator plus an answer checker:
 *
 * ```ts
 * export const myDrill = defineDrill<MyItem, string>({
 *   id: 'my-drill',
 *   title: 'My drill',
 *   summary: 'One line for the hub card',
 *   levels: ['Easy', 'Harder', 'Hardest'],
 *   generate(rng, level) {
 *     const dice = rng.dice();
 *     return {
 *       key: `${dice[0]}${dice[1]}`,
 *       prompt: 'What is the total?',
 *       visuals: [{ kind: 'dice', dice }],
 *       answer: { kind: 'number' },
 *       total: dice[0] + dice[1],
 *     };
 *   },
 *   check(item, answer) {
 *     const ok = answer === item.total;
 *     return { ok, expected: String(item.total), explain: `${item.dice[0]} + ${item.dice[1]} = ${item.total}.` };
 *   },
 * });
 * ```
 *
 * Then add it to `DRILLS` in `src/app/practice/drills/index.ts`. That is all: the hub lists it,
 * `#/practice/<id>` runs 10-item rounds, and progress (best score, streak, spaced review) is
 * stored per drill id.
 *
 * Rules for drills:
 * - `generate` must use only the `rng` it is given (no `Math.random`, no `Date`): the same seed and
 *   level must produce the same item. Items missed on the first try are stored as `{seed, level}`
 *   and regenerated later for spaced review.
 * - Compute answers from the simulator (`src/sim`: engine `createGame`/`applyAction`, math
 *   `WAYS`/`pointWinProb`/`betEdge` …), never hard-coded tables.
 * - `key` identifies the question; the round runner avoids repeating a key within one round.
 * - Rendering is data-driven (`prompt`, `visuals`, `answer`). A drill needing a bespoke input
 *   (keypad, tappable table) uses `answer: { kind: 'custom' }` and supplies `Input`.
 */
import type { ComponentType } from 'preact';
import type { Cents, Dice, PointNumber } from '../../sim/engine';
import type { DrillRng } from './rng';

/** 1-based difficulty level; a drill declares how many it has via `levels`. */
export type DrillLevel = number;

/** Pictures shown above the prompt; rendered with the simulator's own dice/chips. */
export type Visual =
  | { kind: 'dice'; dice: Dice; caption?: string }
  /** a chip stack, e.g. the bet in question */
  | { kind: 'chips'; amount: Cents; caption?: string }
  /** the point puck: a number = ON at that point, null = OFF (come-out) */
  | { kind: 'puck'; point: PointNumber | null };

export interface Choice {
  /** the answer value passed to `check` */
  id: string;
  label: string;
  /** optional dice picture inside the choice button */
  dice?: Dice;
}

/** How the learner answers. */
export type AnswerSpec =
  /** tap one of the choices; the answer is the choice `id` (string) */
  | { kind: 'choice'; choices: readonly Choice[] }
  /**
   * type a number; the answer is the parsed number (dollars when `money`).
   * `decimals` limits input precision (default 0, or 2 when `money`).
   */
  | { kind: 'number'; money?: boolean; decimals?: number; label?: string }
  /** the drill's own `Input` component produces the answer */
  | { kind: 'custom' };

/** Answer values produced by the built-in inputs. */
export type BuiltinAnswer = string | number;

export interface DrillItem {
  /** identity of the question (no repeats within a round) */
  key: string;
  prompt: string;
  visuals?: readonly Visual[];
  answer: AnswerSpec;
}

export interface CheckResult {
  ok: boolean;
  /** why: shown after every answer, right or wrong */
  explain: string;
  /** the correct answer in words, e.g. "Wins" or "$14" */
  expected: string;
  /** the correct answer value (for choices: its id), so the input can mark it after a miss */
  correct?: BuiltinAnswer;
  /** optional ordered detail shown under `explain` as a numbered list (e.g. options ranked) */
  explainList?: readonly string[];
}

/** Props for a drill's custom answer input. Call `onAnswer` once; `disabled` after answering. */
export interface DrillInputProps<I extends DrillItem = DrillItem, A = unknown> {
  item: I;
  disabled: boolean;
  onAnswer: (answer: A) => void;
}

export interface Drill<I extends DrillItem = DrillItem, A = BuiltinAnswer> {
  /** stable id: route `#/practice/<id>` and the progress key; never rename */
  id: string;
  title: string;
  /** one line for the hub card */
  summary: string;
  /** level names, easiest first; levels are 1..levels.length */
  levels: readonly string[];
  /** deterministic: the same rng seed and level give the same item */
  generate(rng: DrillRng, level: DrillLevel): I;
  check(item: I, answer: A): CheckResult;
  /** required when items use `answer: { kind: 'custom' }` */
  Input?: ComponentType<DrillInputProps<I, A>>;
}

/** A drill with its item/answer types erased, as stored in the registry. */
export type AnyDrill = Drill<DrillItem, unknown>;

/** Type-checks a drill against its own item/answer types and erases them for the registry. */
export function defineDrill<I extends DrillItem, A = BuiltinAnswer>(d: Drill<I, A>): AnyDrill {
  return d as unknown as AnyDrill;
}
