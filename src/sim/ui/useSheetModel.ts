import { useMemo, useState } from 'preact/hooks';
import { BET_TYPES, betTypeAvailable } from '../engine/bets';
import type { Action, BetTypeId, Cents, GameState } from '../engine/types';
import { validateAction } from '../engine/validate';
import { previewAction } from '../math/preview';
import type { ActionPreview } from '../math/types';
import { allowedActionsFor, betTypeAllowed, currentStep, gateAction } from '../scene';
import type { SceneConfig, SceneRuntime } from '../scene/types';
import type { QuickAction, TypeOption } from './BetSheet';
import { centerLayout, craplessPortraitLayout, portraitLayout, regionIdForBet } from './layouts';
import type { RegionDef, RegionId } from './layouts/types';
import type { ResolvedSimSettings } from './settings';
import {
  defaultAmount,
  defaultBetForRegion,
  minAmountFor,
  oddsRoom,
  parentFor,
  placeAction,
} from './simHelpers';
import { betLabel, buildEvFacts, fmtMoney } from './text';
import type { SimulatorEvent } from './types';
import { emitObserve, type Core } from './simCore';
import type { DoActionResult } from './useGameCore';

export const ALL_REGIONS: RegionDef[] = [
  ...portraitLayout.regions,
  ...centerLayout.regions,
  // crapless-only number boxes (2, 3, 11, 12)
  ...craplessPortraitLayout.regions.filter(
    (r) => !portraitLayout.regions.some((p) => p.id === r.id),
  ),
];

export interface SheetState {
  regionId: RegionId;
  type: BetTypeId;
  amount: Cents;
  /** manage mode: the existing bet */
  betId?: string;
}

const regionFor = (id: RegionId): RegionDef | undefined => ALL_REGIONS.find((r) => r.id === id);

const ODDS_FOR: Partial<Record<BetTypeId, BetTypeId>> = {
  'pass-line': 'pass-odds',
  'dont-pass': 'dont-pass-odds',
  come: 'come-odds',
  'dont-come': 'dont-come-odds',
};

/** Everything the bet sheet shows for the open sheet: action, preview, options, quick amounts. */
export function buildSheetModel(
  sheet: SheetState,
  game: GameState,
  scene: SceneConfig,
  rt: SceneRuntime,
  rollsPerHour: number,
  chip: Cents,
) {
  const region = regionFor(sheet.regionId)!;
  const bet = sheet.betId ? game.bets.find((b) => b.id === sheet.betId) : undefined;
  if (sheet.betId && !bet) return null;
  const st = currentStep(scene, rt);
  const action: Action = bet
    ? sheet.amount === bet.amount
      ? { type: 'remove-bet', betId: bet.id }
      : { type: 'set-amount', betId: bet.id, amount: sheet.amount }
    : placeAction(sheet.type, sheet.amount, sheet.regionId, game);
  let preview: ActionPreview = previewAction(game, action, { rollsPerHour });
  const showEV = st?.showEV ?? scene.showEV ?? true;
  const needed: Action['type'] = bet
    ? action.type === 'remove-bet'
      ? 'remove-bet'
      : 'set-amount'
    : 'place-bet';
  if (bet && action.type === 'remove-bet') {
    preview = {
      ...preview,
      validation: {
        ok: false,
        code: 'bad-amount',
        message: 'Change the amount to update, or remove the bet.',
      },
    };
  }
  if (!allowedActionsFor(scene, st).includes(needed)) {
    preview = {
      ...preview,
      validation: {
        ok: false,
        code: 'not-allowed-by-scene',
        message:
          needed === 'place-bet'
            ? 'Just looking: betting is switched off in this step.'
            : 'Changing bets is switched off in this step.',
      },
    };
  } else if (preview.validation.ok && !bet) {
    const gate = gateAction(scene, rt, game, action);
    if (!gate.ok) preview = { ...preview, validation: gate };
  }
  if (scene.evDetail === 'basic') preview = { ...preview, alternative: null };
  // never suggest a bet the scene does not allow
  const altAction = preview.alternative?.action;
  if (altAction?.type === 'place-bet' && !betTypeAllowed(scene, rt, altAction.betType))
    preview = { ...preview, alternative: null };
  const type = bet ? bet.type : sheet.type;
  const parent = parentFor(type, sheet.regionId, game);
  const def = BET_TYPES[type];
  const facts = buildEvFacts(preview, game);
  const removePreview = bet
    ? previewAction(game, { type: 'remove-bet', betId: bet.id }, { rollsPerHour })
    : undefined;
  const options: TypeOption[] = bet
    ? [{ id: type, label: betLabel(type), enabled: true }]
    : region.betTypes
        .filter((t) => betTypeAvailable(t, game.rules))
        .map((t) => {
          const allowed = betTypeAllowed(scene, rt, t);
          const odds = BET_TYPES[t].category === 'odds';
          const hasParent = !odds || !!parentFor(t, sheet.regionId, game);
          return {
            id: t,
            label: betLabel(t),
            enabled: allowed && hasParent,
            ...(!allowed
              ? { reason: 'Not available in this lesson' }
              : !hasParent
                ? { reason: 'Needs a flat bet first' }
                : {}),
          };
        });
  const quick: QuickAction[] = [];
  if (!bet) {
    quick.push({ id: 'min', label: 'Min', amount: minAmountFor(type, game) });
    quick.push({ id: 'double', label: '×2', amount: sheet.amount * 2 });
    if (def.category === 'odds' && parent)
      quick.push({
        id: 'max-odds',
        label: 'Max odds',
        amount: defaultAmount(type, sheet.regionId, game, chip),
      });
    if (preview.validation.ok) {
      const fix = preview.validation.warnings.find((w) => w.suggestedAmount);
      if (fix?.suggestedAmount)
        quick.push({
          id: 'fix-units',
          label: `Fix to ${fmtMoney(fix.suggestedAmount)}`,
          amount: fix.suggestedAmount,
        });
    }
  }
  const removeVal = bet ? validateAction(game, { type: 'remove-bet', betId: bet.id }) : null;
  const contract =
    bet && removeVal && !removeVal.ok && removeVal.code === 'contract-bet'
      ? { reason: "You can't take this bet down once the point is set." }
      : bet && removeVal && !removeVal.ok && removeVal.code === 'not-removable'
        ? { reason: removeVal.message }
        : null;
  const oddsType = bet ? ODDS_FOR[bet.type] : undefined;
  const addOdds =
    contract && bet && oddsType && betTypeAllowed(scene, rt, oddsType) && oddsRoom(game, bet) > 0
      ? {
          regionId: sheet.regionId,
          type: oddsType,
          amount: Math.max(100, Math.min(oddsRoom(game, bet), game.bankroll)),
          parentId: bet.id,
        }
      : null;
  return {
    bet,
    action,
    preview,
    showEV,
    facts,
    options,
    quick,
    type,
    removePreview,
    contract,
    addOdds,
  };
}

export type SheetModel = NonNullable<ReturnType<typeof buildSheetModel>>;

interface SheetDeps {
  coreRef: { current: Core };
  sceneRef: { current: SceneConfig };
  settingsRef: { current: ResolvedSimSettings };
  setCore: (c: Core) => void;
  emit: (e: SimulatorEvent) => void;
  pushToast: (text: string, tone?: 'info') => void;
  doAction: (a: Action) => DoActionResult;
  /** the displayed game (animation-aware) and live scene state, for the model */
  game: GameState;
  scene: SceneConfig;
  rt: SceneRuntime;
  rollsPerHour: number;
  chip: Cents;
}

/** Bet sheet state, the taps that open it, and its memoized model. */
export function useSheetModel(d: SheetDeps) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const { coreRef, sceneRef, settingsRef, emit, chip } = d;

  const firePreviewed = (s: SheetState) => {
    const { game: g, rt: r } = coreRef.current;
    const action: Action = s.betId
      ? { type: 'remove-bet', betId: s.betId }
      : placeAction(s.type, s.amount, s.regionId, g);
    const p = previewAction(g, action, { rollsPerHour: settingsRef.current.rollsPerHour });
    emit({ type: 'previewed', preview: p });
    const sc = sceneRef.current;
    if (!sc.steps?.length) return;
    const res = emitObserve(sc, r, g, { kind: 'previewed', betType: s.type }, emit);
    d.setCore({ game: res.game, rt: res.runtime });
  };
  const openSheet = (s: SheetState) => {
    setSheet(s);
    firePreviewed(s);
  };

  const onRegionTap = (id: RegionId) => {
    const region = regionFor(id);
    if (!region) return;
    const { game: g, rt: r } = coreRef.current;
    const allowedTypes = region.betTypes.filter(
      (t) => betTypeAvailable(t, g.rules) && betTypeAllowed(sceneRef.current, r, t),
    );
    if (!allowedTypes.length) {
      d.pushToast('That bet is not available in this lesson.', 'info');
      return;
    }
    let type = defaultBetForRegion(region, g);
    if (!allowedTypes.includes(type)) type = allowedTypes[0]!;
    const amount = defaultAmount(type, id, g, chip);
    const needsParent = BET_TYPES[type].category === 'odds' && !parentFor(type, id, g);
    if (settingsRef.current.skipPreview && !needsParent) {
      d.doAction(placeAction(type, amount, id, g));
      return;
    }
    openSheet({ regionId: id, type, amount });
  };

  const onStackTap = (betId: string) => {
    const b = coreRef.current.game.bets.find((x) => x.id === betId);
    if (!b) return;
    const rid = regionIdForBet(b.type, b.point);
    if (!rid) return;
    openSheet({ regionId: rid, type: b.type, amount: b.amount, betId });
  };

  const { game, scene, rt, rollsPerHour } = d;
  const sheetModel = useMemo(
    () => (sheet ? buildSheetModel(sheet, game, scene, rt, rollsPerHour, chip) : null),
    [sheet, game, scene, rt, rollsPerHour, chip],
  );

  const closeSheet = () => setSheet(null);
  const confirmSheet = () => {
    if (!sheet || !sheetModel) return;
    const res = d.doAction(sheetModel.action);
    if (res.ok) closeSheet();
  };

  return {
    sheet,
    setSheet,
    sheetModel,
    openSheet,
    onRegionTap,
    onStackTap,
    closeSheet,
    confirmSheet,
  };
}
