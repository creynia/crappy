import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BET_TYPES } from '../engine/bets';
import { equity, isWorking } from '../engine/game';
import type { Bet, Cents, RulePresetId } from '../engine/types';
import { betTypeAllowed, currentStep, highlightedFor, initScene, rollLock } from '../scene';
import type { SceneConfig } from '../scene/types';
import { CenterPanel } from './CenterPanel';
import { SessionPanel } from './SessionPanel';
import { AUTOROLL_BANKROLL_KEY } from './bankroll';
import { SimAutoRoll } from './SimAutoRoll';
import { SimControls, type Panels } from './SimControls';
import { SimMenu } from './SimMenu';
import { SimSheet } from './SimSheet';
import { SimStep } from './SimStep';
import { askFeedback } from './StepPanel';
import { SANDBOX_SCENE, initialChip, randomSeed } from './simCore';
import { StatusBar } from './StatusBar';
import { Table } from './Table';
import { Toasts, type ToastItem } from './Toasts';
import { toastDurationMs } from './animation';
import { landscapeLayout, portraitLayout } from './layouts';
import type { RegionId } from './layouts/types';
import { clearSandbox } from './persist';
import { fmtMoney } from './text';
import type { SimulatorEvent, SimulatorHandle, SimulatorProps } from './types';
import { useAnimationPlayer } from './useAnimationPlayer';
import { useGameCore } from './useGameCore';
import { useGuidedSteps } from './useGuidedSteps';
import { useLandscape } from './useLandscape';
import { ALL_REGIONS, useSheetModel } from './useSheetModel';
import { useSandboxPersist } from './useSandboxPersist';
import { useUrlBoot } from './useUrlBoot';
import './sim.css';
import './simulator.css';

const DEFAULT_CHIPS: Cents[] = [100, 500, 2500, 10_000, 50_000];

export interface SimulatorInternalProps extends SimulatorProps {
  /** used by mountSimulator to get an imperative handle */
  onHandle?: (h: Omit<SimulatorHandle, 'unmount'>) => void;
}

const isCenterBet = (b: Bet) => {
  const c = BET_TYPES[b.type].category;
  return c === 'prop' || c === 'hardway' || c === 'bonus';
};

export function Simulator(props: SimulatorInternalProps) {
  const [scene, setScene] = useState<SceneConfig>(props.scene ?? SANDBOX_SCENE);
  const mode = props.mode ?? (props.scene ? 'embedded' : 'sandbox');
  const sandbox = mode === 'sandbox';
  const ui = scene.ui ?? {};
  const { settings, setSettings, boot } = useUrlBoot(props, scene, mode);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onEventRef = useRef(props.onEvent);
  onEventRef.current = props.onEvent;
  const emit = (e: SimulatorEvent) => onEventRef.current?.(e);

  const chips = ui.chips && ui.chips.length ? ui.chips : DEFAULT_CHIPS;
  const [chip, setChip] = useState<Cents>(initialChip(chips, ui.defaultChip, boot.chip));
  const [view, setView] = useState<'table' | 'center'>(ui.view ?? 'table');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // The one live announcer: { text, n } so a repeated message is re-announced (the key changes).
  const [live, setLive] = useState({ text: '', n: 0 });
  const toastN = useRef(0);
  const guided = !!scene.steps?.length;
  const [panels, setPanels] = useState<Panels>({ auto: false, session: false, menu: false });
  const togglePanel = (name: keyof Panels) => setPanels((p) => ({ ...p, [name]: !p[name] }));
  const setAutoOpen = (v: boolean) => setPanels((p) => ({ ...p, auto: v }));
  const [hintVisible, setHintVisible] = useState(false);
  const landscape = useLandscape(scene);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = `t${++toastN.current}`;
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
  }, []);
  const announce = useCallback((text: string) => setLive((l) => ({ text, n: l.n + 1 })), []);

  const anim = useAnimationPlayer(() => settingsRef.current.speed, pushToast, announce);
  const { core, coreRef, setCore, startEquity, lastOneRoll, feedInput, doAction } = useGameCore({
    boot,
    sceneRef,
    emit,
    onRejected: (message) => {
      setHintVisible(true);
      pushToast(message, 'info');
      announce(message);
    },
    onRolled: anim.run,
  });

  const { game: liveGame, rt } = core;
  const game = anim.shown ?? liveGame;
  const step = currentStep(scene, rt);

  // ---------- events + effects ----------
  useEffect(() => {
    emit({ type: 'ready', state: coreRef.current.game });
    return () => anim.cancel();
  }, []);
  const startedRef = useGuidedSteps(scene, rt, step, emit, setHintVisible, setAutoOpen);
  useSandboxPersist(
    sandbox && !guided ? props.persistKey : undefined,
    scene,
    settings,
    liveGame,
    chip,
  );

  // ---------- sheet ----------
  const sh = useSheetModel({
    coreRef,
    sceneRef,
    settingsRef,
    setCore,
    emit,
    pushToast,
    announce,
    doAction,
    game,
    scene,
    rt,
    rollsPerHour: settings.rollsPerHour,
    chip,
  });
  const { sheet } = sh;

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

  const roll = () => {
    if (anim.busy || sheet || lock) return;
    doAction({ type: 'roll' });
  };

  // ---------- menu actions ----------
  const resetGame = (opts?: { rules?: RulePresetId }) => {
    anim.clear();
    sh.setSheet(null);
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

  // ---------- render ----------
  const autoAvailable = scene.autoRoll ? scene.autoRoll.enabled : sandbox;
  const rulesSelectValue = typeof scene.rules === 'string' ? scene.rules : settings.rulesPreset;

  const tableProps = {
    bets: game.bets,
    point: game.point,
    offBetIds: offIds,
    disabledRegions,
    highlightedBets: highlighted,
    fieldPays: game.rules.fieldPays,
    lostBets: anim.lost,
    wonBets: anim.won,
    travellingBets: anim.travelling,
    chipMs: anim.chipMs,
    chipPhase: anim.chipPhase,
    rollingDice: anim.rolling,
    selectedRegion: sheet?.regionId ?? null,
    onRegionTap: sh.onRegionTap,
    onStackTap: sh.onStackTap,
  };
  const session = equity(game) - startEquity.current;

  const controls = (
    <SimControls
      ui={ui}
      chips={chips}
      chip={chip}
      game={liveGame}
      onSelectChip={setChip}
      onRoll={roll}
      rollDisabled={anim.busy || !!sheet || !!lock}
      busy={anim.busy}
      lock={lock}
      view={view}
      setView={setView}
      autoAvailable={autoAvailable}
      showMenu={!!ui.showSettings || sandbox}
      panels={panels}
      onToggle={togglePanel}
    />
  );

  const stepEl = (
    <SimStep
      scene={scene}
      step={step}
      rt={rt}
      hintVisible={hintVisible}
      onNext={() => feedInput({ kind: 'acknowledged' })}
      onAnswer={(choice) => {
        const ask = step?.ask;
        if (!step || !ask) return;
        const correct = choice === ask.answer;
        emit({ type: 'step-answered', stepId: step.id, index: rt.stepIndex, choice, correct });
        announce(askFeedback(ask, choice));
        feedInput({ kind: 'answered', correct });
      }}
      onRestart={() => resetGame()}
    />
  );

  // Toasts overlay the status block (above the felt in portrait, the rail's status in landscape):
  // text nothing taps, never a betting region or the lesson step card.
  const toastsEl = (
    <Toasts
      toasts={toasts}
      onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      autoDismissMs={toastDurationMs(settings.speed)}
    />
  );
  const status = (compact: boolean) => (
    <StatusBar
      {...(compact ? { compact } : {})}
      bankroll={game.bankroll}
      onTable={onTable}
      session={session}
      point={game.point}
      history={game.history}
    />
  );

  return (
    <div
      class={`sim-root${landscape ? ' sim-land' : ''}${ui.compact ? ' sim-compact' : ''}${ui.showBankroll === false ? ' sim-hide-money' : ''}${ui.showHistory === false ? ' sim-hide-history' : ''}`}
      data-testid="simulator"
      data-mode={mode}
      onClickCapture={(e) => {
        if (anim.playing()) {
          e.preventDefault();
          e.stopPropagation();
          anim.skip();
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Escape' || e.key === ' ') && anim.playing()) {
          e.preventDefault();
          anim.skip();
        }
      }}
    >
      {landscape ? null : stepEl}

      <div class="sim-main">
        <div class="sim-felt">
          {!landscape ? status(false) : null}
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
            {landscape ? null : toastsEl}
          </div>
        </div>
        {landscape ? (
          <div class="sim-rail">
            {stepEl}
            <div class="sim-status-wrap">
              {status(true)}
              {toastsEl}
            </div>
            {controls}
          </div>
        ) : (
          controls
        )}
      </div>

      <div class="sim-sr" role="status" aria-live="polite" data-testid="roll-announcer">
        <span key={live.n}>{live.text}</span>
      </div>

      {panels.menu ? (
        <SimMenu
          canRebet={canRebet}
          busy={anim.busy}
          onRebet={rebet}
          onReset={resetGame}
          rulesValue={rulesSelectValue}
          settings={settings}
          setSettings={setSettings}
        />
      ) : null}

      {panels.session ? (
        <SessionPanel stats={liveGame.stats} rollCount={liveGame.rollCount} />
      ) : null}

      {autoAvailable && panels.auto ? (
        <SimAutoRoll
          scene={scene}
          game={liveGame}
          rulesValue={rulesSelectValue}
          rollsPerHour={settings.rollsPerHour}
          emit={emit}
          feedInput={feedInput}
          persistKey={sandbox ? AUTOROLL_BANKROLL_KEY : undefined}
        />
      ) : null}

      {sheet && sh.sheetModel ? (
        <SimSheet
          sheet={sheet}
          model={sh.sheetModel}
          landscape={landscape}
          whyOpen={scene.whyOpen === true}
          chip={chip}
          confirmSucker={settings.confirmSuckerBets}
          game={game}
          getLiveGame={() => coreRef.current.game}
          setSheet={sh.setSheet}
          openSheet={sh.openSheet}
          doAction={doAction}
          onConfirm={sh.confirmSheet}
          onClose={sh.closeSheet}
        />
      ) : null}
    </div>
  );
}
