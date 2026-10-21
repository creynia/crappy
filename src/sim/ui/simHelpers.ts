import { BET_TYPES } from '../engine/bets';
import { maxOddsAmount, suggestAmount } from '../engine/validate';
import type { Action, Bet, BetTypeId, Cents, Dice, GameState, PointNumber } from '../engine/types';
import type { RegionDef, RegionId } from './layouts/types';

/** The number a box region stands for, or null. */
export function boxNumber(id: RegionId): PointNumber | null {
  const m = /^box-(\d+)$/.exec(id);
  return m ? (Number(m[1]) as PointNumber) : null;
}

const hasType = (g: GameState, t: BetTypeId) => g.bets.some((b) => b.type === t);

/** Bet type a tap on a region opens first (simulator.md 3.6 step 2). */
export function defaultBetForRegion(region: RegionDef, g: GameState): BetTypeId {
  if (region.id === 'pass')
    return g.point !== null && hasType(g, 'pass-line') ? 'pass-odds' : 'pass-line';
  if (region.id === 'dont-pass')
    return g.point !== null && hasType(g, 'dont-pass') ? 'dont-pass-odds' : 'dont-pass';
  const n = boxNumber(region.id);
  if (n !== null) {
    if (g.bets.some((b) => b.type === 'come' && b.point === n)) return 'come-odds';
    if (g.bets.some((b) => b.type === 'dont-come' && b.point === n)) return 'dont-come-odds';
    return `place-${n}` as BetTypeId;
  }
  return region.betTypes[0]!;
}

/** Parent flat bet an odds bet type would attach to from this region. */
export function parentFor(type: BetTypeId, region: RegionId, g: GameState): Bet | undefined {
  if (type === 'pass-odds') return g.bets.find((b) => b.type === 'pass-line');
  if (type === 'dont-pass-odds') return g.bets.find((b) => b.type === 'dont-pass');
  const n = boxNumber(region);
  if (type === 'come-odds') return g.bets.find((b) => b.type === 'come' && b.point === n);
  if (type === 'dont-come-odds') return g.bets.find((b) => b.type === 'dont-come' && b.point === n);
  return undefined;
}

export function minAmountFor(type: BetTypeId, g: GameState): Cents {
  const def = BET_TYPES[type];
  let min =
    def.category === 'odds'
      ? 100
      : def.category === 'prop' || def.category === 'hardway'
        ? g.rules.propMin
        : g.rules.tableMin;
  const unit = 100 * def.unitMultiple;
  min = Math.ceil(min / unit) * unit;
  return min;
}

/** Room left for odds on a parent (max total minus what is already up). */
export function oddsRoom(g: GameState, parent: Bet): Cents {
  const existing = g.bets.find((b) => b.parentId === parent.id)?.amount ?? 0;
  return Math.max(0, maxOddsAmount(g, parent.id) - existing);
}

/** Prefilled amount for a fresh sheet: max odds for odds bets, otherwise the chip rounded to a clean unit. */
export function defaultAmount(type: BetTypeId, region: RegionId, g: GameState, chip: Cents): Cents {
  const def = BET_TYPES[type];
  if (def.category === 'odds') {
    const parent = parentFor(type, region, g);
    if (!parent) return minAmountFor(type, g);
    const room = oddsRoom(g, parent);
    return Math.max(100, Math.min(room, g.bankroll) || room || 100);
  }
  const base = Math.max(chip, minAmountFor(type, g));
  return suggestAmount(type, base, g);
}

/** The pair a fresh hop sheet starts on: 2-4, the example lesson 13 uses. */
export const DEFAULT_HOP: Dice = [2, 4];

export function placeAction(
  type: BetTypeId,
  amount: Cents,
  region: RegionId,
  g: GameState,
  hop?: Dice,
): Extract<Action, { type: 'place-bet' }> {
  const parent = BET_TYPES[type].category === 'odds' ? parentFor(type, region, g) : undefined;
  return {
    type: 'place-bet',
    betType: type,
    amount,
    ...(parent && (type === 'come-odds' || type === 'dont-come-odds')
      ? { parentId: parent.id }
      : {}),
    ...(type === 'hop' ? { hop: hop ?? DEFAULT_HOP } : {}),
  };
}

/** SheetState fields for a bet type: a hop sheet carries its pair (default DEFAULT_HOP), others nothing. */
export function hopSheetFields(type: BetTypeId, hop: Dice | undefined): { hop?: Dice } {
  return type === 'hop' ? { hop: hop ?? DEFAULT_HOP } : {};
}
