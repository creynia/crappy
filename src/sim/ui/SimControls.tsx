import { useId } from 'preact/hooks';
import type { Cents, GameState } from '../engine/types';
import { tableExpectedLossPerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';
import type { SceneConfig } from '../scene/types';
import { ChipRack } from './ChipRack';
import { RollButton } from './RollButton';
import { fmtMoney } from './text';

/** Open state of the panels the tab row toggles. */
export interface Panels {
  auto: boolean;
  session: boolean;
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
}

/** Chip rack, roll button, roll lock note and the tab row (Center, Auto-roll, Session, Menu). */
export function SimControls(p: SimControlsProps) {
  const { ui, game } = p;
  const expectedCost = toNumber(tableExpectedLossPerRoll(game));
  const costText =
    game.bets.length === 0
      ? undefined
      : `Expected cost: ${expectedCost > 0 && expectedCost < 1 ? '<1¢' : fmtMoney(Math.round(expectedCost), { exact: true })}`;
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
          {...(costText ? { costText } : {})}
        />
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
