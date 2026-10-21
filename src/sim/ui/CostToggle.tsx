import { useState } from 'preact/hooks';
import type { GameState } from '../engine/types';
import { tableExpectedLossPerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';
import {
  COST_UNIT_LABEL,
  costShort,
  edgeOnAction,
  nextCostUnit,
  rollCostText,
  type CostUnit,
} from './text';

/** The cost unit the learner last chose on this device (guarded: storage may be blocked). */
const COST_UNIT_KEY = 'crappy.sim.costUnit';
function readCostUnit(): CostUnit {
  try {
    const v = window.localStorage.getItem(COST_UNIT_KEY);
    return v === 'hour' || v === 'bet100' ? v : 'roll';
  } catch {
    return 'roll';
  }
}
function writeCostUnit(u: CostUnit): void {
  try {
    window.localStorage.setItem(COST_UNIT_KEY, u);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

/** Expected cost on the status line, e.g. "$4.19/hr"; tap cycles per roll, per hour, per $100 bet. */
export function CostToggle({
  game,
  rollsPerHour = 100,
}: {
  game: GameState;
  rollsPerHour?: number;
}) {
  const [unit, setUnit] = useState<CostUnit>(readCostUnit);
  // the row always takes its 44px, so Roll does not move when the first bet appears
  if (game.bets.length === 0) return <div class="sim-cost-row" aria-hidden="true" />;
  const perRoll = toNumber(tableExpectedLossPerRoll(game));
  const edge = edgeOnAction(game);
  const full = rollCostText(unit, perRoll, rollsPerHour, edge);
  const short = costShort(unit, perRoll, rollsPerHour, edge);
  if (!full || !short) return <div class="sim-cost-row" aria-hidden="true" />;
  const next = nextCostUnit(unit);
  return (
    <div class="sim-cost-row">
      <button
        type="button"
        class="sim-cost-toggle"
        aria-label={`${full}. Tap to show ${COST_UNIT_LABEL[next]}.`}
        onClick={() => {
          setUnit(next);
          writeCostUnit(next);
        }}
      >
        {short.value}
        {short.unit}
      </button>
    </div>
  );
}
