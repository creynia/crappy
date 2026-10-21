import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BET_TYPES } from '../engine/bets';
import { equity, isWorking } from '../engine/game';
import type { Bet, Cents, RulePresetId, TableRules } from '../engine/types';
import { betTypeAllowed, currentStep, highlightedFor, initScene, rollLock } from '../scene';
import type { SceneConfig } from '../scene/types';
import { CenterPanel } from './CenterPanel';
import { RollLog, type RollLogFocus } from './RollLog';
import { exposureOf } from '../strategy/metrics';
import { SessionPanel } from './SessionPanel';
import { AUTOROLL_BANKROLL_KEY } from './bankroll';
import { SimAutoRoll } from './SimAutoRoll';
import { SimControls, type Panels } from './SimControls';
import { SimMenu } from './SimMenu';
import { PanelSheet, type PanelId, type PanelTab } from './PanelSheet';
import {
  buildShareUrl,
  describeSkipped,
  FRESH_RNG,
  presetOf,
  rngDraws,
  toSceneYaml,
  type RngPosition,
} from './shareLink';
import { SimSheet } from './SimSheet';
import { SimStep } from './SimStep';
import { resolverFor } from './stepTokens';
import { askFeedback } from './StepPanel';
import { SANDBOX_SCENE, initialChip, randomSeed } from './simCore';
import { StatusBar } from './StatusBar';
import { Table } from './Table';
import { Toasts, type ToastItem } from './Toasts';
import { toastDurationMs } from './animation';
import { landscapeLayout, portraitLayout } from './layouts';
import type { RegionId } from './layouts/types';
import { clearSandbox } from './persist';
import { appendLog, autoRollEntry, summarizeRoll, type RollLogEntry } from './rollLog';
import { fmtMoney } from './text';
import type { SimulatorEvent, SimulatorHandle, SimulatorProps } from './types';
import { useAnimationPlayer } from './useAnimationPlayer';
import { useGameCore } from './useGameCore';
import { useGuidedSteps } from './useGuidedSteps';
import { useLandscape } from './useLandscape';
import { ALL_REGIONS, useSheetModel } from './useSheetModel';
import { useSandboxPersist } from './useSandboxPersist';
import { useUrlBoot } from './useUrlBoot';
import { usePanelReveal } from './usePanelReveal';
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
  const initialScene = props.scene ?? SANDBOX_SCENE;
  const mode = props.mode ?? (props.scene ? 'embedded' : 'sandbox');
  const sandbox = mode === 'sandbox';
  const { settings, setSettings, boot } = useUrlBoot(props, initialScene, mode);
  // I033: a restored custom-rules sandbox keeps its rules for resets and the Rules menu
  const [scene, setScene] = useState<SceneConfig>(() =>
    boot.customRules ? { ...initialScene, rules: boot.customRules } : initialScene,
  );
  const ui = scene.ui ?? {};
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
  const [panels, setPanels] = useState<Panels>({
    auto: false,
    session: false,
    log: false,
    menu: false,
  });
  const [log, setLog] = useState<RollLogEntry[]>(() => boot.log ?? []);
  const [logFocus, setLogFocus] = useState<RollLogFocus | null>(null);
  // Where this table stands in its dice sequence: the link's skip (if any) plus rolls since;
  // reset with the table and saved with the sandbox so sharing survives Reset and a reload.
  const [rngPos, setRngPos] = useState<RngPosition>(boot.rng ?? FRESH_RNG);
  const focusNonce = useRef(0);
  const autoSeq = useRef(boot.log?.length ?? 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestReveal = usePanelReveal(panels, rootRef);
  // The sandbox shows its panels in one sheet, one at a time; embedded scenes keep them inline.
  const sheetPanels = sandbox;
  const CLOSED: Panels = { auto: false, session: false, log: false, menu: false };
  const togglePanel = (name: keyof Panels) => {
    requestReveal(name);
    setPanels((p) => (sheetPanels ? { ...CLOSED, [name]: !p[name] } : { ...p, [name]: !p[name] }));
  };
  // Switching with the sheet's own tab strip keeps focus on the tab (arrow keys keep working), so
  // no reveal: the sheet is already in view.
  const selectPanel = (name: PanelId) => setPanels({ ...CLOSED, [name]: true });
  const closePanels = () => setPanels(CLOSED);
  const setAutoOpen = (v: boolean) => setPanels((p) => ({ ...p, auto: v }));
  const [hintVisible, setHintVisible] = useState(false);
  const landscape = useLandscape(scene);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = `t${++toastN.current}`;
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
  }, []);
  const announce = useCallback((text: string) => setLive((l) => ({ text, n: l.n + 1 })), []);

  const anim = useAnimationPlayer(
    () => settingsRef.current.speed,
    pushToast,
    announce,
    (pre, post, events) => {
      const entry = summarizeRoll(pre, post, events);
      if (entry) setLog((l) => appendLog(l, entry));
    },
  );
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
    // parts of a shared link the table could not use
    if (boot.skipped?.length) {
      const text = describeSkipped(boot.skipped);
      pushToast(text, 'info');
      announce(text);
    }
    return () => anim.cancel();
  }, []);
  const startedRef = useGuidedSteps(scene, rt, step, emit, setHintVisible, setAutoOpen);
  useSandboxPersist(
    sandbox && !guided ? props.persistKey : undefined,
    scene,
    settings,
    liveGame,
    chip,
    log,
    rngDraws(liveGame, rngPos),
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
  const resetGame = (opts?: { rules?: RulePresetId | Partial<TableRules> }) => {
    anim.clear();
    sh.setSheet(null);
    const sc: SceneConfig = { ...scene, ...(opts?.rules ? { rules: opts.rules } : {}) };
    if (opts?.rules) setScene(sc);
    const init = initScene(sc, { seed: guided ? 1 : randomSeed() });
    startedRef.current = -1;
    startEquity.current = equity(init.game);
    setToasts([]);
    setLog([]);
    setLogFocus(null);
    setRngPos(FRESH_RNG); // a fresh seed: nothing drawn from it yet
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
  // Share links (I071): the live table as a URL (Web Share, else the clipboard) or a scene block.
  const shareBase = () => {
    try {
      return `${location.origin}${location.pathname}`;
    } catch {
      return '';
    }
  };
  const copyText = async (text: string, what: string) => {
    let msg: string;
    try {
      await navigator.clipboard.writeText(text);
      msg = `${what} copied to the clipboard.`;
    } catch {
      msg = `Could not copy the ${what.toLowerCase()}.`;
    }
    pushToast(msg, 'info');
    announce(msg);
  };
  const shareTable = async () => {
    if (presetOf(coreRef.current.game.rules) === null) {
      const msg =
        "Custom table rules aren't included in shared links yet; the link uses Standard Vegas.";
      pushToast(msg, 'info');
      announce(msg);
    }
    const url = buildShareUrl(shareBase(), coreRef.current.game, rngPos);
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Craps table', url });
        return;
      } catch (e) {
        // the person closed the share sheet: nothing to do
        if (e instanceof Error && e.name === 'AbortError') return;
        /* unsupported: fall back to the clipboard */
      }
    }
    await copyText(url, 'Link');
  };
  const copyScene = () =>
    copyText(toSceneYaml(coreRef.current.game, 'shared-table', rngPos), 'Scene YAML');

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
  // I033: a rules object (the custom editor, or a restored custom sandbox) shows as "Custom"
  const menuRulesValue = typeof scene.rules === 'object' ? 'custom' : rulesSelectValue;

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
      resolve={resolverFor(game)}
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
      onOpenHistory={(n) => {
        setPanels((p) => (sheetPanels ? { ...CLOSED, log: true } : { ...p, log: true }));
        setLogFocus(n === undefined ? null : { n, nonce: ++focusNonce.current });
      }}
    />
  );

  return (
    <div
      ref={rootRef}
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

      {(() => {
        const panelEls = (
          <>
            {panels.menu ? (
              <SimMenu
                canRebet={canRebet}
                busy={anim.busy}
                onRebet={rebet}
                onReset={resetGame}
                rulesValue={menuRulesValue}
                currentRules={liveGame.rules}
                settings={settings}
                setSettings={setSettings}
                {...(sandbox
                  ? { onShare: () => void shareTable(), onCopyScene: () => void copyScene() }
                  : {})}
              />
            ) : null}

            {panels.session ? (
              <SessionPanel
                stats={liveGame.stats}
                rollCount={liveGame.rollCount}
                exposure={exposureOf(liveGame.bets)}
                bankroll={equity(liveGame)}
              />
            ) : null}

            {panels.log ? <RollLog entries={log} focus={logFocus} /> : null}

            {autoAvailable && panels.auto ? (
              <SimAutoRoll
                scene={scene}
                game={liveGame}
                rulesValue={rulesSelectValue}
                rollsPerHour={settings.rollsPerHour}
                emit={emit}
                feedInput={feedInput}
                onResult={(result) =>
                  setLog((l) =>
                    appendLog(l, autoRollEntry(result, coreRef.current.game, ++autoSeq.current)),
                  )
                }
                persistKey={sandbox ? AUTOROLL_BANKROLL_KEY : undefined}
              />
            ) : null}
          </>
        );
        const active = (['auto', 'session', 'log', 'menu'] as const).find((k) => panels[k]);
        if (!sheetPanels) return panelEls;
        if (!active) return null;
        const tabs: PanelTab[] = [
          ...(autoAvailable ? [{ id: 'auto' as const, label: 'Auto-roll' }] : []),
          { id: 'session' as const, label: 'Session' },
          { id: 'log' as const, label: 'Log' },
          ...(ui.showSettings || sandbox ? [{ id: 'menu' as const, label: 'Menu' }] : []),
        ];
        return (
          <PanelSheet
            active={active}
            tabs={tabs}
            onSelect={selectPanel}
            onClose={closePanels}
            landscape={landscape}
            roll={{ onRoll: roll, disabled: anim.busy || !!sheet || !!lock, busy: anim.busy }}
          >
            {panelEls}
          </PanelSheet>
        );
      })()}

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
