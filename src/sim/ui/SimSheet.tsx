import { isToggleable } from '../engine/bets';
import { isWorking } from '../engine/game';
import type { Action, Cents, GameState } from '../engine/types';
import { BetSheet } from './BetSheet';
import { regionIdForBet } from './layouts';
import { defaultAmount } from './simHelpers';
import { betLabel } from './text';
import type { DoActionResult } from './useGameCore';
import type { SheetModel, SheetState } from './useSheetModel';

export interface SimSheetProps {
  sheet: SheetState;
  model: SheetModel;
  landscape: boolean;
  whyOpen: boolean;
  chip: Cents;
  confirmSucker: boolean;
  /** the displayed game (for the working toggle) */
  game: GameState;
  /** the live game (for a type change's default amount) */
  getLiveGame: () => GameState;
  setSheet: (s: SheetState) => void;
  openSheet: (s: SheetState) => void;
  doAction: (a: Action) => DoActionResult;
  onConfirm: () => void;
  onClose: () => void;
}

/** Wires the open sheet's model and handlers into BetSheet. */
export function SimSheet(p: SimSheetProps) {
  const { sheet, model: m, chip } = p;
  return (
    <BetSheet
      title={betLabel(m.type)}
      mode={m.bet ? 'manage' : 'new'}
      placement={p.landscape ? 'panel' : 'sheet'}
      preview={m.preview}
      {...(m.removePreview ? { removePreview: m.removePreview } : {})}
      {...(m.contract
        ? {
            contract: {
              ...m.contract,
              ...(m.addOdds
                ? {
                    onAddOdds: () => {
                      const a = m.addOdds!;
                      p.openSheet({ regionId: a.regionId, type: a.type, amount: a.amount });
                    },
                  }
                : {}),
            },
          }
        : {})}
      facts={m.showEV ? m.facts : null}
      showEV={m.showEV}
      forceWhyOpen={p.whyOpen}
      typeOptions={m.options}
      selectedType={m.type}
      amount={sheet.amount}
      step={chip}
      quickActions={m.quick}
      confirmSucker={p.confirmSucker}
      {...(m.bet && isToggleable(m.bet.type)
        ? { working: { value: isWorking(m.bet, p.game), canToggle: true } }
        : {})}
      onTypeChange={(t) => {
        const g = p.getLiveGame();
        p.openSheet({
          regionId: sheet.regionId,
          type: t,
          amount: defaultAmount(t, sheet.regionId, g, chip),
        });
      }}
      onAmountChange={(a) => p.setSheet({ ...sheet, amount: a })}
      onUseAlternative={(a) => {
        if (a.type !== 'place-bet') return;
        const rid = regionIdForBet(a.betType, null) ?? sheet.regionId;
        p.openSheet({ regionId: rid, type: a.betType, amount: a.amount });
      }}
      onToggleWorking={(on) => {
        if (m.bet)
          p.doAction({
            type: 'set-working',
            betId: m.bet.id,
            working: on ? 'on' : 'off',
          });
      }}
      {...(m.bet
        ? {
            onRemove: () => {
              const r = p.doAction({ type: 'remove-bet', betId: m.bet!.id });
              if (r.ok) p.onClose();
            },
          }
        : {})}
      onConfirm={p.onConfirm}
      onCancel={p.onClose}
    />
  );
}
