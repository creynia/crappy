import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BET_TYPES, isToggleable } from '../engine/bets';
import { applyAction, equity, isWorking } from '../engine/game';
import { resolveRules } from '../engine/rules';
import { validateAction } from '../engine/validate';
import type {
  Action,
  ApplyResult,
  Bet,
  BetTypeId,
  Cents,
  Dice as DicePair,
  GameEvent,
  GameState,
  RulePresetId,
  Validation,
} from '../engine/types';
import { tableExpectedLossPerRoll, expectedLossByTypePerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';
import { previewAction } from '../math/preview';
import type { ActionPreview } from '../math/types';
import {
  allowedActionsFor,
  betTypeAllowed,
  currentStep,
  gateAction,
  highlightedFor,
  initScene,
  observe,
  rollLock,
} from '../scene';
import type { SceneConfig, SceneInput, SceneRuntime } from '../scene/types';
import type { ManyResult, SessionResult, StrategySpec } from '../strategy/types';
import { AutoRollPanel } from './AutoRollPanel';
import { BetSheet, type QuickAction, type TypeOption } from './BetSheet';
import { CenterPanel } from './CenterPanel';
import { ChipRack } from './ChipRack';
import { RollButton } from './RollButton';
import { SessionPanel } from './SessionPanel';
import { StatusBar } from './StatusBar';
import { StepPanel } from './StepPanel';
import { Table } from './Table';
import { Toasts, type ToastItem } from './Toasts';
import { buildAnimationQueue, playTimeline, toastDurationMs, type Player } from './animation';
import { centerLayout, landscapeLayout, portraitLayout, regionIdForBet } from './layouts';
import type { RegionDef, RegionId } from './layouts/types';
import { loadSandbox, saveSandbox, clearSandbox } from './persist';
import { resolveSettings, type ResolvedSimSettings } from './settings';
import {
  defaultAmount,
  defaultBetForRegion,
  minAmountFor,
  oddsRoom,
  parentFor,
  placeAction,
} from './simHelpers';
import { betLabel, buildEvFacts, describeRoll, fmtMoney, rollTone } from './text';
import type { SimulatorEvent, SimulatorHandle, SimulatorProps } from './types';
import './sim.css';
import './simulator.css';

const SANDBOX_SCENE: SceneConfig = {
  id: 'sandbox',
  version: 1,
  bankroll: 50_000,
  allowedBets: 'all',
  ui: { showSettings: true, showBankroll: true, showHistory: true },
};
const DEFAULT_CHIPS: Cents[] = [100, 500, 2500, 10_000, 50_000];
const ALL_REGIONS: RegionDef[] = [...portraitLayout.regions, ...centerLayout.regions];
const PRESETS: RulePresetId[] = ['standard-vegas', 'field-3x-12', 'odds-10x', 'odds-100x'];

export interface SimulatorInternalProps extends SimulatorProps {
  /** used by mountSimulator to get an imperative handle */
  onHandle?: (h: Omit<SimulatorHandle, 'unmount'>) => void;
}

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! & 0x7fffffff;
  } catch {
    return Math.floor(Math.random() * 0x7fffffff);
  }
}

/** Sandbox URL params (supported in production): seed, dice, rules, speed. Read from ?search and #/path?query. */
function readUrlParams(): URLSearchParams {
  const p = new URLSearchParams();
  try {
    new URLSearchParams(location.search).forEach((v, k) => p.set(k, v));
    const h = location.hash;
    const q = h.indexOf('?');
    if (q >= 0) new URLSearchParams(h.slice(q + 1)).forEach((v, k) => p.set(k, v));
  } catch {
    /* no location */
  }
  return p;
}

function parseDice(s: string | null): DicePair[] {
  if (!s) return [];
  const out: DicePair[] = [];
  for (const part of s.split(',')) {
    const m = /^([1-6])-([1-6])$/.exec(part.trim());
    if (m) out.push([Number(m[1]), Number(m[2])] as unknown as DicePair);
  }
  return out;
}

interface Core {
  game: GameState;
  rt: SceneRuntime;
}

function isPreset(s: string): s is RulePresetId {
  return (PRESETS as string[]).includes(s);
}

function buildCore(
  scene: SceneConfig,
  settings: ResolvedSimSettings,
  mode: 'sandbox' | 'embedded',
  persistKey: string | undefined,
  url: URLSearchParams,
): { core: Core; startEquity: Cents; chip?: Cents } {
  const sandbox = mode === 'sandbox';
  const hasUrl = sandbox && (url.has('seed') || url.has('dice') || url.has('rules'));
  const urlRules = url.get('rules');
  const rules: SceneConfig['rules'] =
    scene.rules ??
    (urlRules && isPreset(urlRules) ? urlRules : sandbox ? settings.rulesPreset : undefined);
  const withRules: SceneConfig = rules !== undefined ? { ...scene, rules } : scene;
  if (sandbox && persistKey && !hasUrl && !scene.steps?.length) {
    const saved = loadSandbox(persistKey);
    if (
      saved &&
      saved.startBankroll === (scene.bankroll ?? 50_000) &&
      saved.presetId === String(typeof rules === 'string' ? rules : 'custom')
    ) {
      return {
        core: {
          game: saved.game,
          rt: { stepIndex: 0, stepStartRoll: 0, counters: {}, done: true },
        },
        startEquity: saved.startBankroll,
        ...(saved.chip ? { chip: saved.chip } : {}),
      };
    }
  }
  const seedParam = url.get('seed');
  const seed = sandbox && seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : undefined;
  const dice = sandbox ? parseDice(url.get('dice')) : [];
  const sc: SceneConfig = {
    ...withRules,
    ...(dice.length ? { forcedDice: [...(scene.forcedDice ?? []), ...dice] } : {}),
  };
  const init = initScene(sc, { seed: seed ?? (scene.steps?.length ? 1 : randomSeed()) });
  return { core: { game: init.game, rt: init.runtime }, startEquity: equity(init.game) };
}

interface SheetState {
  regionId: RegionId;
  type: BetTypeId;
  amount: Cents;
  /** manage mode: the existing bet */
  betId?: string;
}

const isCenterBet = (b: Bet) => {
  const c = BET_TYPES[b.type].category;
  return c === 'prop' || c === 'hardway' || c === 'bonus';
};

function matchLandscape(scene: SceneConfig): boolean {
  const o = scene.ui?.orientation;
  if (o === 'landscape') return true;
  if (o === 'portrait') return false;
  try {
    return typeof matchMedia === 'function' && matchMedia('(orientation: landscape)').matches;
  } catch {
    return false;
  }
}

export function Simulator(props: SimulatorInternalProps) {
  const [scene, setScene] = useState<SceneConfig>(props.scene ?? SANDBOX_SCENE);
  const mode = props.mode ?? (props.scene ? 'embedded' : 'sandbox');
  const sandbox = mode === 'sandbox';
  const ui = scene.ui ?? {};
  const [settings, setSettings] = useState<ResolvedSimSettings>(() => {
    const base = resolveSettings(props.initialSettings, ui.speed);
    const sp = sandbox ? readUrlParams().get('speed') : null;
    return sp === 'normal' || sp === 'fast' || sp === 'instant' ? { ...base, speed: sp } : base;
  });
  const [boot] = useState(() =>
    buildCore(
      scene,
      settings,
      mode,
      props.persistKey,
      sandbox ? readUrlParams() : new URLSearchParams(),
    ),
  );
  const [core, setCoreState] = useState<Core>(boot.core);
  const coreRef = useRef(core);
  const setCore = (c: Core) => {
    coreRef.current = c;
    setCoreState(c);
  };
  const startEquity = useRef(boot.startEquity);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onEventRef = useRef(props.onEvent);
  onEventRef.current = props.onEvent;
  const emit = (e: SimulatorEvent) => onEventRef.current?.(e);

  const chips = ui.chips && ui.chips.length ? ui.chips : DEFAULT_CHIPS;
  const [chip, setChip] = useState<Cents>(
    boot.chip && chips.includes(boot.chip)
      ? boot.chip
      : ui.defaultChip && chips.includes(ui.defaultChip)
        ? ui.defaultChip
        : chips.includes(500)
          ? 500
          : chips[0]!,
  );
  const [view, setView] = useState<'table' | 'center'>(ui.view ?? 'table');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastN = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const guided = !!scene.steps?.length;
  const [autoOpen, setAutoOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [landscape, setLandscape] = useState(() => matchLandscape(scene));

  // animation state
  const [shown, setShown] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState<{ dice: DicePair; durationMs: number } | null>(null);
  const [lost, setLost] = useState<Bet[]>([]);
  const [won, setWon] = useState<{ bet: Bet; payout: Cents }[]>([]);
  const [busy, setBusy] = useState(false);
  const player = useRef<Player | null>(null);
  const lastOneRoll = useRef<{ type: BetTypeId; amount: Cents }[]>([]);

  useEffect(() => {
    const pinned = ui.orientation && ui.orientation !== 'auto';
    setLandscape(matchLandscape(scene));
    if (pinned || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(orientation: landscape)');
    const on = () => setLandscape(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [ui.orientation]);

  const { game: liveGame, rt } = core;
  const game = shown ?? liveGame;
  const step = currentStep(scene, rt);

  // ---------- events + effects ----------
  const startedRef = useRef(-1);
  useEffect(() => {
    emit({ type: 'ready', state: coreRef.current.game });
    return () => player.current?.cancel();
  }, []);
  useEffect(() => {
    if (!guided || rt.done) return;
    if (startedRef.current === rt.stepIndex) return;
    startedRef.current = rt.stepIndex;
    const st = scene.steps![rt.stepIndex]!;
    setHintVisible(false);
    emit({ type: 'step-started', stepId: st.id, index: rt.stepIndex });
    if (JSON.stringify(st.completeWhen).includes('autoRollCompleted')) setAutoOpen(true);
  }, [rt.stepIndex, rt.done, guided]);
  // idle hint after 20s
  useEffect(() => {
    if (!guided || rt.done || !step?.hint) return;
    const h = setTimeout(() => setHintVisible(true), 20_000);
    return () => clearTimeout(h);
  }, [rt.stepIndex, rt.counters, guided, rt.done, step?.hint]);
  // persist sandbox
  useEffect(() => {
    if (!sandbox || !props.persistKey || guided) return;
    const rules = scene.rules ?? settings.rulesPreset;
    saveSandbox(props.persistKey, {
      v: 1,
      game: liveGame,
      startBankroll: scene.bankroll ?? 50_000,
      presetId: String(typeof rules === 'string' ? rules : 'custom'),
      chip,
    });
  }, [
    liveGame,
    chip,
    sandbox,
    props.persistKey,
    guided,
    scene.bankroll,
    scene.rules,
    settings.rulesPreset,
  ]);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = `t${++toastN.current}`;
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
  }, []);

  // ---------- core dispatch ----------
  const feed = (input: SceneInput, g: GameState): Core => {
    const sc = sceneRef.current;
    if (!sc.steps?.length) return { game: g, rt: coreRef.current.rt };
    const r = observe(sc, coreRef.current.rt, g, input);
    // a step `setup` that changes bankroll or bets must not show up as session profit or loss
    if (r.game !== g) startEquity.current += equity(r.game) - equity(g);
    if (r.completedStep) {
      const idx = sc.steps.findIndex((s) => s.id === r.completedStep);
      emit({ type: 'step-completed', stepId: r.completedStep, index: idx });
    }
    if (r.sceneCompleted) emit({ type: 'scene-completed', sceneId: sc.id, state: r.game });
    return { game: r.game, rt: r.runtime };
  };

  const runAnimation = (pre: GameState, post: GameState, events: GameEvent[]) => {
    const roll = events.find(
      (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
    );
    const text = describeRoll(events);
    const tone = rollTone(events);
    const speed = settingsRef.current.speed;
    player.current?.cancel();
    const tl = buildAnimationQueue(events, speed);
    const finish = () => {
      setShown(null);
      setRolling(null);
      setLost([]);
      setWon([]);
      setBusy(false);
      player.current = null;
      pushToast(text, tone);
    };
    if (!tl.steps.length || !roll) {
      finish();
      return;
    }
    setBusy(true);
    setShown(pre);
    player.current = playTimeline(tl, {
      onStart: (s) => {
        if (s.kind === 'dice') setRolling({ dice: roll.roll.dice, durationMs: s.duration });
        if (s.kind === 'lose') {
          const ids = new Set(s.events.map((e) => (e.type === 'bet-lost' ? e.betId : '')));
          setShown(post);
          setLost(pre.bets.filter((b) => ids.has(b.id)));
        }
        if (s.kind === 'win') {
          setShown(post);
          const w: { bet: Bet; payout: Cents }[] = [];
          for (const e of s.events)
            if (e.type === 'bet-won') {
              const bet = pre.bets.find((b) => b.id === e.betId);
              if (bet) w.push({ bet, payout: e.profit - e.vig + (e.staysUp ? 0 : e.amount) });
            }
          setWon(w);
        }
      },
      onEnd: (s) => {
        if (s.kind === 'dice') {
          setRolling(null);
          setShown(post);
        }
        if (s.kind === 'lose') setLost([]);
        if (s.kind === 'win') setWon([]);
      },
      onDone: finish,
    });
  };

  /** Gate + engine + scene observation. */
  const doAction = (
    action: Action,
  ): ApplyResult | { ok: false; error: Extract<Validation, { ok: false }> } => {
    const { game: g, rt: r } = coreRef.current;
    const sc = sceneRef.current;
    const gate = gateAction(sc, r, g, action);
    if (!gate.ok) {
      emit({ type: 'action-rejected', action, error: gate });
      setHintVisible(true);
      pushToast(gate.message, 'info');
      return { ok: false, error: gate };
    }
    const res = applyAction(g, action, {
      expectedLossFn: (s) => toNumber(tableExpectedLossPerRoll(s)),
      expectedLossByTypeFn: expectedLossByTypePerRoll,
    });
    if (!res.ok) {
      emit({ type: 'action-rejected', action, error: res.error });
      setHintVisible(true);
      pushToast(res.error.message, 'info');
      return res;
    }
    if (action.type === 'roll') {
      lastOneRoll.current = g.bets
        .filter((b) => BET_TYPES[b.type].oneRoll)
        .map((b) => ({ type: b.type, amount: b.amount }));
    }
    emit({ type: 'action-confirmed', action, events: res.events, state: res.state });
    setCore(feed({ kind: 'action', action, events: res.events }, res.state));
    if (action.type === 'roll') {
      const rec = res.events.find(
        (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
      );
      if (rec)
        emit({
          type: 'rolled',
          roll: rec.roll,
          events: res.events,
          state: res.state,
        });
      runAnimation(g, res.state, res.events);
    }
    return res;
  };

  const skipAnimation = () => {
    player.current?.skip();
  };

  // ---------- sheet ----------
  const regionFor = (id: RegionId): RegionDef | undefined => ALL_REGIONS.find((r) => r.id === id);

  const firePreviewed = (s: SheetState) => {
    const { game: g, rt: r } = coreRef.current;
    const action: Action = s.betId
      ? { type: 'remove-bet', betId: s.betId }
      : placeAction(s.type, s.amount, s.regionId, g);
    const p = previewAction(g, action, { rollsPerHour: settingsRef.current.rollsPerHour });
    emit({ type: 'previewed', preview: p });
    const sc = sceneRef.current;
    if (!sc.steps?.length) return;
    const res = observe(sc, r, g, { kind: 'previewed', betType: s.type });
    if (res.completedStep) {
      const idx = sc.steps.findIndex((x) => x.id === res.completedStep);
      emit({ type: 'step-completed', stepId: res.completedStep, index: idx });
    }
    if (res.sceneCompleted) emit({ type: 'scene-completed', sceneId: sc.id, state: res.game });
    setCore({ game: res.game, rt: res.runtime });
  };
  const openSheet = (s: SheetState) => {
    setSheet(s);
    firePreviewed(s);
  };

  const onRegionTap = (id: RegionId) => {
    const region = regionFor(id);
    if (!region) return;
    const { game: g, rt: r } = coreRef.current;
    const allowedTypes = region.betTypes.filter((t) => betTypeAllowed(sceneRef.current, r, t));
    if (!allowedTypes.length) {
      pushToast('That bet is not available in this lesson.', 'info');
      return;
    }
    let type = defaultBetForRegion(region, g);
    if (!allowedTypes.includes(type)) type = allowedTypes[0]!;
    const amount = defaultAmount(type, id, g, chip);
    const needsParent = BET_TYPES[type].category === 'odds' && !parentFor(type, id, g);
    if (settingsRef.current.skipPreview && !needsParent) {
      doAction(placeAction(type, amount, id, g));
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

  const sheetModel = useMemo(() => {
    if (!sheet) return null;
    const region = regionFor(sheet.regionId)!;
    const bet = sheet.betId ? game.bets.find((b) => b.id === sheet.betId) : undefined;
    if (sheet.betId && !bet) return null;
    const st = currentStep(scene, rt);
    const action: Action = bet
      ? sheet.amount === bet.amount
        ? { type: 'remove-bet', betId: bet.id }
        : { type: 'set-amount', betId: bet.id, amount: sheet.amount }
      : placeAction(sheet.type, sheet.amount, sheet.regionId, game);
    let preview: ActionPreview = previewAction(game, action, {
      rollsPerHour: settings.rollsPerHour,
    });
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
    const type = bet ? bet.type : sheet.type;
    const parent = parentFor(type, sheet.regionId, game);
    const def = BET_TYPES[type];
    const facts = buildEvFacts(preview, game);
    const removePreview = bet
      ? previewAction(
          game,
          { type: 'remove-bet', betId: bet.id },
          { rollsPerHour: settings.rollsPerHour },
        )
      : undefined;
    const options: TypeOption[] = bet
      ? [{ id: type, label: betLabel(type), enabled: true }]
      : region.betTypes.map((t) => {
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
    const oddsFor: Partial<Record<BetTypeId, BetTypeId>> = {
      'pass-line': 'pass-odds',
      'dont-pass': 'dont-pass-odds',
      come: 'come-odds',
      'dont-come': 'dont-come-odds',
    };
    const oddsType = bet ? oddsFor[bet.type] : undefined;
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
  }, [sheet, game, scene, rt, settings.rollsPerHour, chip]);

  const closeSheet = () => setSheet(null);
  const confirmSheet = () => {
    if (!sheet || !sheetModel) return;
    const res = doAction(sheetModel.action);
    if (res.ok) closeSheet();
  };

  // ---------- derived UI data ----------
  const onTable = game.bets.reduce((t, b) => t + b.amount, 0);
  const offIds = useMemo(
    () => new Set(game.bets.filter((b) => !isWorking(b, game)).map((b) => b.id)),
    [game],
  );
  const disabledRegions = useMemo(() => {
    const set = new Set<RegionId>();
    for (const r of ALL_REGIONS)
      if (!r.betTypes.some((t) => betTypeAllowed(scene, rt, t))) set.add(r.id);
    return set;
  }, [scene, rt]);
  const highlighted = highlightedFor(scene, step);
  const centerTotal = game.bets.filter(isCenterBet).reduce((t, b) => t + b.amount, 0);
  const lock = rollLock(scene, rt, liveGame);
  const expectedCost = toNumber(tableExpectedLossPerRoll(liveGame));
  const costText =
    liveGame.bets.length === 0
      ? undefined
      : `Expected cost: ${expectedCost > 0 && expectedCost < 1 ? '<1¢' : fmtMoney(Math.round(expectedCost), { exact: true })}`;

  const roll = () => {
    if (busy || sheet || lock) return;
    doAction({ type: 'roll' });
  };

  // ---------- menu actions ----------
  const resetGame = (opts?: { rules?: RulePresetId }) => {
    player.current?.cancel();
    setShown(null);
    setBusy(false);
    setRolling(null);
    setLost([]);
    setWon([]);
    setSheet(null);
    const sc: SceneConfig = { ...scene, ...(opts?.rules ? { rules: opts.rules } : {}) };
    if (opts?.rules) setScene(sc);
    const init = initScene(sc, { seed: guided ? 1 : randomSeed() });
    startedRef.current = -1;
    startEquity.current = equity(init.game);
    setToasts([]);
    setCore({ game: init.game, rt: init.runtime });
    if (sandbox && props.persistKey) clearSandbox(props.persistKey);
  };
  const rebet = () => {
    for (const r of lastOneRoll.current) {
      if (coreRef.current.game.bets.some((b) => b.type === r.type)) continue;
      doAction({ type: 'place-bet', betType: r.type, amount: r.amount });
    }
  };
  const canRebet = lastOneRoll.current.some((r) => !liveGame.bets.some((b) => b.type === r.type));

  // ---------- imperative handle ----------
  useEffect(() => {
    props.onHandle?.({
      getState: () => coreRef.current.game,
      dispatch: (a) => {
        const r = doAction(a);
        return r.ok ? r : { ok: false, state: coreRef.current.game, error: r.error };
      },
      reset: (s) => {
        if (s) setScene(s);
        resetGame();
      },
    });
  }, []);

  // ---------- auto roll ----------
  const ar = scene.autoRoll;
  const autoAvailable = ar ? ar.enabled : sandbox;
  const autoConfig = useMemo(() => {
    if (!ar) return undefined;
    const cfg: NonNullable<Parameters<typeof AutoRollPanel>[0]['config']> = {};
    if (ar.compare?.length) {
      cfg.compare = ar.compare;
      cfg.compareMode = true;
    } else {
      if (ar.strategies) cfg.strategies = ar.strategies;
      if (ar.defaultStrategy) cfg.defaultStrategy = ar.defaultStrategy;
      if (ar.compareMode) cfg.compareMode = true;
    }
    if (ar.rollOptions) cfg.rollOptions = ar.rollOptions;
    if (ar.sessions) cfg.sessions = ar.sessions;
    return cfg;
  }, [ar]);
  const layoutBets = useMemo(
    () =>
      liveGame.bets
        .filter((b) => !b.parentId)
        .map((b) => ({ type: b.type, amount: b.amount, point: b.point })),
    [liveGame.bets],
  );
  const onAutoCompleted = (
    result: SessionResult | ManyResult,
    all?: (SessionResult | ManyResult)[],
    specs?: StrategySpec[],
  ) => {
    emit({ type: 'auto-roll-completed', result });
    const played = (r: SessionResult | ManyResult) =>
      'rollsPlayed' in r ? r.rollsPlayed : Math.max(0, r.p50.length - 1);
    // a compare scene needs every compared strategy in the run; report the shortest run
    const needed = scene.autoRoll?.compare?.length ?? 1;
    const results = all && all.length ? all : [result];
    const rolls = results.length >= needed ? Math.min(...results.map(played)) : 0;
    const om = specs?.[0]?.oddsMultiple;
    setCore(
      feed(
        { kind: 'auto-roll-completed', rolls, oddsMultiple: om === undefined ? 'default' : om },
        coreRef.current.game,
      ),
    );
  };

  // ---------- render ----------
  const rulesSelectValue = typeof scene.rules === 'string' ? scene.rules : settings.rulesPreset;
  const lastIdx = (scene.steps?.length ?? 1) - 1;
  const stepAck = step ? 'acknowledged' in step.completeWhen : false;
  const showNext = !!step && (rt.satisfied === true || stepAck);

  const tableProps = {
    bets: game.bets,
    point: game.point,
    offBetIds: offIds,
    disabledRegions,
    highlightedBets: highlighted,
    fieldPays: game.rules.fieldPays,
    lostBets: lost,
    wonBets: won,
    rollingDice: rolling,
    selectedRegion: sheet?.regionId ?? null,
    onRegionTap,
    onStackTap,
  };
  const session = equity(game) - startEquity.current;

  const controls = (
    <div class="sim-controls">
      {ui.showChipRack !== false ? (
        <ChipRack
          denominations={chips}
          selected={chip}
          bankroll={liveGame.bankroll}
          onSelect={setChip}
          orientation="row"
        />
      ) : null}
      {ui.showRoll !== false ? (
        <RollButton
          onRoll={roll}
          disabled={busy || !!sheet || !!lock}
          rolling={busy}
          {...(costText ? { costText } : {})}
        />
      ) : null}
      {lock && ui.showRoll !== false ? <p class="sim-lock">{lock}</p> : null}
      <div class="sim-ctl-row">
        <button
          type="button"
          class="sim-tab"
          aria-pressed={view === 'center'}
          onClick={() => setView(view === 'center' ? 'table' : 'center')}
        >
          {view === 'center' ? 'Table' : 'Center'}
        </button>
        {autoAvailable ? (
          <button
            type="button"
            class="sim-tab"
            aria-expanded={autoOpen}
            onClick={() => setAutoOpen(!autoOpen)}
          >
            Auto-roll
          </button>
        ) : null}
        <button
          type="button"
          class="sim-tab"
          aria-expanded={sessionOpen}
          onClick={() => setSessionOpen(!sessionOpen)}
        >
          Session
        </button>
        {ui.showSettings || sandbox ? (
          <button
            type="button"
            class="sim-tab"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>
        ) : null}
      </div>
    </div>
  );

  const stepEl = (
    <>
      {guided && step ? (
        <StepPanel
          step={step}
          index={rt.stepIndex}
          total={scene.steps!.length}
          hintVisible={hintVisible}
          showNext={showNext}
          nextLabel={rt.stepIndex === lastIdx ? 'Finish' : 'Next'}
          done={false}
          onNext={() => setCore(feed({ kind: 'acknowledged' }, coreRef.current.game))}
          onRestart={() => resetGame()}
        />
      ) : null}
      {guided && rt.done ? (
        <section class="sim-step sim-step-done" aria-label="Lesson step">
          <p class="sim-step-text" role="status">
            <strong>Done.</strong> Nice work. Keep playing here, or restart the practice.
          </p>
          <button type="button" class="sim-linkbtn" onClick={() => resetGame()}>
            Restart
          </button>
        </section>
      ) : null}
    </>
  );

  return (
    <div
      class={`sim-root${landscape ? ' sim-land' : ''}${ui.compact ? ' sim-compact' : ''}${ui.showBankroll === false ? ' sim-hide-money' : ''}${ui.showHistory === false ? ' sim-hide-history' : ''}`}
      data-testid="simulator"
      data-mode={mode}
      onClickCapture={(e) => {
        if (player.current && !player.current.done) {
          e.preventDefault();
          e.stopPropagation();
          skipAnimation();
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Escape' || e.key === ' ') && player.current && !player.current.done) {
          e.preventDefault();
          skipAnimation();
        }
      }}
    >
      {landscape ? null : stepEl}

      <div class="sim-main">
        <div class="sim-felt">
          {!landscape ? (
            <StatusBar
              bankroll={game.bankroll}
              onTable={onTable}
              session={session}
              point={game.point}
              history={game.history}
            />
          ) : null}
          <div class="sim-felt-body">
            {view === 'center' ? (
              <CenterPanel {...tableProps} />
            ) : (
              <Table {...tableProps} layout={landscape ? landscapeLayout : portraitLayout} />
            )}
            {view === 'table' && centerTotal > 0 ? (
              <button type="button" class="sim-center-ind" onClick={() => setView('center')}>
                Center bets: {fmtMoney(centerTotal)}
              </button>
            ) : null}
          </div>
        </div>
        {landscape ? (
          <div class="sim-rail">
            {stepEl}
            <StatusBar
              compact
              bankroll={game.bankroll}
              onTable={onTable}
              session={session}
              point={game.point}
              history={game.history}
            />
            {controls}
          </div>
        ) : (
          controls
        )}
      </div>

      <Toasts
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
        autoDismissMs={toastDurationMs(settings.speed)}
      />

      {menuOpen ? (
        <section class="sim-menu" aria-label="Table menu">
          <div class="sim-menu-row">
            <button type="button" onClick={rebet} disabled={!canRebet || busy}>
              Rebet
            </button>
            <button type="button" onClick={() => resetGame()}>
              Reset bankroll
            </button>
          </div>
          <label class="sim-menu-field">
            Rules
            <select
              value={rulesSelectValue}
              onChange={(e) => resetGame({ rules: e.currentTarget.value as RulePresetId })}
            >
              <option value="standard-vegas">Standard Vegas (3-4-5x)</option>
              <option value="field-3x-12">Field pays 3x on 12</option>
              <option value="odds-10x">10x odds</option>
              <option value="odds-100x">100x odds</option>
            </select>
          </label>
          <label class="sim-menu-field">
            Speed
            <select
              value={settings.speed}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  speed: e.currentTarget.value as ResolvedSimSettings['speed'],
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
              <option value="instant">Instant</option>
            </select>
          </label>
          <label class="sim-menu-check">
            <input
              type="checkbox"
              checked={settings.skipPreview}
              onChange={(e) => setSettings({ ...settings, skipPreview: e.currentTarget.checked })}
            />
            Skip EV preview (tap to bet)
          </label>
        </section>
      ) : null}

      {sessionOpen ? <SessionPanel stats={liveGame.stats} rollCount={liveGame.rollCount} /> : null}

      {autoAvailable && autoOpen ? (
        <section class="sim-auto" aria-label="Auto-roll">
          <AutoRollPanel
            rules={typeof scene.rules === 'object' ? resolveRules(scene.rules) : rulesSelectValue}
            bankroll={Math.max(0, equity(liveGame))}
            {...(autoConfig ? { config: autoConfig } : {})}
            layout={layoutBets}
            rollsPerHour={settings.rollsPerHour}
            onCompleted={onAutoCompleted}
          />
        </section>
      ) : null}

      {sheet && sheetModel ? (
        <BetSheet
          title={betLabel(sheetModel.type)}
          mode={sheetModel.bet ? 'manage' : 'new'}
          placement={landscape ? 'panel' : 'sheet'}
          preview={sheetModel.preview}
          {...(sheetModel.removePreview ? { removePreview: sheetModel.removePreview } : {})}
          {...(sheetModel.contract
            ? {
                contract: {
                  ...sheetModel.contract,
                  ...(sheetModel.addOdds
                    ? {
                        onAddOdds: () => {
                          const a = sheetModel.addOdds!;
                          const next: SheetState = {
                            regionId: a.regionId,
                            type: a.type,
                            amount: a.amount,
                          };
                          setSheet(next);
                          firePreviewed(next);
                        },
                      }
                    : {}),
                },
              }
            : {})}
          facts={sheetModel.showEV ? sheetModel.facts : null}
          showEV={sheetModel.showEV}
          forceWhyOpen={scene.whyOpen === true}
          typeOptions={sheetModel.options}
          selectedType={sheetModel.type}
          amount={sheet.amount}
          step={chip}
          quickActions={sheetModel.quick}
          confirmSucker={settings.confirmSuckerBets}
          {...(sheetModel.bet && isToggleable(sheetModel.bet.type)
            ? { working: { value: isWorking(sheetModel.bet, game), canToggle: true } }
            : {})}
          onTypeChange={(t) => {
            const g = coreRef.current.game;
            const next: SheetState = {
              regionId: sheet.regionId,
              type: t,
              amount: defaultAmount(t, sheet.regionId, g, chip),
            };
            setSheet(next);
            firePreviewed(next);
          }}
          onAmountChange={(a) => setSheet({ ...sheet, amount: a })}
          onUseAlternative={(a) => {
            if (a.type !== 'place-bet') return;
            const rid = regionIdForBet(a.betType, null) ?? sheet.regionId;
            const next: SheetState = { regionId: rid, type: a.betType, amount: a.amount };
            setSheet(next);
            firePreviewed(next);
          }}
          onToggleWorking={(on) => {
            if (sheetModel.bet)
              doAction({
                type: 'set-working',
                betId: sheetModel.bet.id,
                working: on ? 'on' : 'off',
              });
          }}
          {...(sheetModel.bet
            ? {
                onRemove: () => {
                  const r = doAction({ type: 'remove-bet', betId: sheetModel.bet!.id });
                  if (r.ok) closeSheet();
                },
              }
            : {})}
          onConfirm={confirmSheet}
          onCancel={closeSheet}
        />
      ) : null}
    </div>
  );
}
