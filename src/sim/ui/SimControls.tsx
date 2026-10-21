import { useId, useState } from 'preact/hooks';
import type { Cents, GameState } from '../engine/types';
import { tableExpectedLossPerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';
import type { SceneConfig } from '../scene/types';
import { ChipRack } from './ChipRack';
import { RollButton } from './RollButton';
import { COST_UNIT_LABEL, edgeOnAction, nextCostUnit, rollCostText, type CostUnit } from './text';

/** Open state of the panels the tab row toggles. */
export interface Panels {
  auto: boolean;
  session: boolean;
  log: boolean;
  menu: boolean;
}

export interface SimControlsProps {
  ui: NonNullable<SceneConfig['ui']>;
  chips: Cents[];
  chip: Cents;
  /** the live game: bankroll for the chip rack, bets for the expected-cost line */
  game: GameState;
  onSelectChip: (c: Cents) => void;
  onRoll: () => void;
  rollDisabled: boolean;
  busy: boolean;
  lock: string | null | undefined;
  view: 'table' | 'center';
  setView: (v: 'table' | 'center') => void;
  autoAvailable: boolean;
  showMenu: boolean;
  /** which side panels are open */
  panels: Panels;
  onToggle: (name: keyof Panels) => void;
  /** for the per-hour cost unit; default 100 */
  rollsPerHour?: number;
}

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

/** Chip rack, roll button, roll lock note and the tab row (Center, Auto-roll, Session, Menu). */
export function SimControls(p: SimControlsProps) {
  const { ui, game } = p;
  const expectedCost = toNumber(tableExpectedLossPerRoll(game));
  const [costUnit, setCostUnit] = useState<CostUnit>(readCostUnit);
  const edge = edgeOnAction(game);
  const costText =
    game.bets.length === 0
      ? undefined
      : rollCostText(costUnit, expectedCost, p.rollsPerHour ?? 100, edge);
  const next = nextCostUnit(costUnit);
  const lockId = useId();
  return (
    <div class="sim-controls">
      {ui.showChipRack !== false ? (
        <ChipRack
          denominations={p.chips}
          selected={p.chip}
          bankroll={game.bankroll}
          onSelect={p.onSelectChip}
          orientation="row"
        />
      ) : null}
      {ui.showRoll !== false ? (
        <RollButton
          onRoll={p.onRoll}
          disabled={p.rollDisabled}
          {...(p.lock ? { describedBy: lockId } : {})}
          rolling={p.busy}
        />
      ) : null}
      {ui.showRoll !== false ? (
        <div class="sim-cost-slot">
          {costText ? (
            <button
              type="button"
              class="sim-cost-cycle"
              aria-label={`${costText}. Tap to show ${COST_UNIT_LABEL[next]}.`}
              onClick={() => {
                setCostUnit(next);
                writeCostUnit(next);
              }}
            >
              {costText}
            </button>
          ) : null}
        </div>
      ) : null}
      {p.lock && ui.showRoll !== false ? (
        <p class="sim-lock" id={lockId}>
          {p.lock}
        </p>
      ) : null}
      <div class="sim-ctl-row">
        <button
          type="button"
          class="sim-tab"
          aria-pressed={p.view === 'center'}
          onClick={() => p.setView(p.view === 'center' ? 'table' : 'center')}
        >
          {p.view === 'center' ? 'Table' : 'Center'}
        </button>
        {p.autoAvailable ? (
          <button
            type="button"
            class="sim-tab"
            aria-expanded={p.panels.auto}
            onClick={() => p.onToggle('auto')}
          >
            Auto-roll
          </button>
        ) : null}
        <button
          type="button"
          class="sim-tab"
          aria-expanded={p.panels.session}
          onClick={() => p.onToggle('session')}
        >
          Session
        </button>
        <button
          type="button"
          class="sim-tab"
          aria-expanded={p.panels.log}
          onClick={() => p.onToggle('log')}
        >
          Log
        </button>
        {p.showMenu ? (
          <button
            type="button"
            class="sim-tab"
            aria-expanded={p.panels.menu}
            onClick={() => p.onToggle('menu')}
          >
            Menu
          </button>
        ) : null}
      </div>
    </div>
  );
}
