import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BET_TYPES } from '../engine/bets';
import { equity, isWorking } from '../engine/game';
import type { Bet, Cents, RulePresetId, TableRules } from '../engine/types';
import {
  betTypeAllowed,
  calloutsFor,
  currentStep,
  highlightedFor,
  initScene,
  rollLock,
} from '../scene';
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
import { WinPrompt } from './WinPrompt';
import {
  saveAskAfterWin,
  winAnnouncement,
  winChoices,
  winPromptTarget,
  type WinChoice,
  type WinPromptTarget,
} from './winPrompt';
import { toastDurationMs } from './animation';
import { landscapeLayout, portraitLayout } from './layouts';
import type { RegionId } from './layouts/types';
import { clearSandbox } from './persist';
import { appendLog, autoRollEntry, summarizeRoll, type RollLogEntry } from './rollLog';
import { betLabel, fmtMoney } from './text';
import type { SimulatorEvent, SimulatorHandle, SimulatorProps } from './types';
import { useAnimationPlayer } from './useAnimationPlayer';
import { useDemoPlayback } from './useDemoPlayback';
import { useGameCore } from './useGameCore';
import { useGuidedSteps } from './useGuidedSteps';
import { useLandscape } from './useLandscape';
import { ALL_REGIONS, useSheetModel } from './useSheetModel';
import { useSandboxPersist } from './useSandboxPersist';
import { useUrlBoot } from './useUrlBoot';
import { useWatchReplay } from './useWatchReplay';
import { WatchControls } from './WatchControls';
import type { Speed } from './animation';
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
  // the place/buy bet that just won (cleared on the next roll, a choice, or a reset)
  const [winTarget, setWinTarget] = useState<WinPromptTarget | null>(null);
  const landscape = useLandscape(scene);

  const pushToast = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = `t${++toastN.current}`;
    setToasts((t) => [...t.slice(-1), { id, text, tone }]);
  }, []);
  const lastRollText = useRef('');
  const announce = useCallback((text: string) => {
    lastRollText.current = text;
    setLive((l) => ({ text, n: l.n + 1 }));
  }, []);

  const watchSpeed = useRef<Speed | null>(null);
  const demoActive = useRef<() => boolean>(() => false);
  const anim = useAnimationPlayer(
    () => watchSpeed.current ?? settingsRef.current.speed,
    pushToast,
    // a replay would flood the live region (one message per roll): it announces only its end
    (text) => {
      if (watchSpeed.current === null) announce(text);
    },
    (pre, post, events) => {
      // a replayed run is not the player's own history: keep it out of the roll log
      if (watchSpeed.current !== null) return;
      if (demoActive.current()) return; // a demo's scripted rolls are not the learner's rolls
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
    onRolled: (pre, post, events) => {
      anim.run(pre, post, events);
      setWinTarget(winPromptTarget(post, events));
    },
  });

  const watcher = useWatchReplay({
    coreRef,
    setCore,
    startEquity,
    anim,
    speedRef: watchSpeed,
    announce,
    baseSpeed: () => settingsRef.current.speed,
  });
  const watching = watcher.watch !== null;
  // leaving a replay removes the controls that had focus: hand it to Roll
  const wasWatching = useRef(false);
  useEffect(() => {
    if (wasWatching.current && !watching)
      rootRef.current?.querySelector<HTMLElement>('.sim-roll:not(:disabled)')?.focus();
    wasWatching.current = watching;
  }, [watching]);

  const { game: liveGame, rt } = core;
  const game = anim.shown ?? liveGame;
  const step = currentStep(scene, rt);
  const demo = useDemoPlayback({
    step,
    stepIndex: rt.stepIndex,
    done: rt.done,
    coreRef,
    setCore,
    doAction,
    getSpeed: () => settingsRef.current.speed,
    announce,
    clearAnimation: anim.clear,
    skipAnimation: anim.skip,
    animBusy: anim.busy,
  });
  demoActive.current = demo.isActive;

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
    sandbox && !guided && !watching ? props.persistKey : undefined,
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
  const lock = watching ? 'Watching a replay: exit to play.' : rollLock(scene, rt, liveGame);

  const roll = () => {
    if (anim.busy || sheet || lock || demo.playing) return;
    setWinTarget(null);
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
    demo.reset();
    startEquity.current = equity(init.game);
    setToasts([]);
    setWinTarget(null);
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

  // ---------- win prompt ----------
  useEffect(() => {
    if (sandbox) saveAskAfterWin(settings.winPrompt);
  }, [settings.winPrompt, sandbox]);
  const winBet = winTarget ? liveGame.bets.find((b) => b.id === winTarget.betId) : undefined;
  const winOptions = useMemo(
    () => (winBet && settings.winPrompt ? winChoices(liveGame, winBet) : []),
    [liveGame, winBet, settings.winPrompt],
  );
  const chooseWin = (c: WinChoice) => {
    setWinTarget(null);
    if (c.action) doAction(c.action);
  };
  const winShown = !!winBet && settings.winPrompt && !anim.busy && !sheet && winOptions.length > 0;
  // the prompt joins the roll's announcement, so a screen-reader user hears the choices too
  useEffect(() => {
    if (winShown && winBet)
      setLive((l) => ({
        text: `${lastRollText.current} ${winAnnouncement(betLabel(winBet.type), winOptions)}`.trim(),
        n: l.n + 1,
      }));
  }, [winShown, winBet?.id]);
  const winPromptEl =
    winShown && winBet ? (
      <WinPrompt
        bet={winBet}
        choices={winOptions}
        onChoose={chooseWin}
        onAlwaysSame={() => {
          setSettings({ ...settings, winPrompt: false });
          setWinTarget(null);
        }}
        onDismiss={() => setWinTarget(null)}
      />
    ) : null;

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
    callouts: calloutsFor(scene, step),
    fieldPays: game.rules.fieldPays,
    lostBets: anim.lost,
    wonBets: anim.won,
    travellingBets: anim.travelling,
    chipMs: anim.chipMs,
    chipPhase: anim.chipPhase,
    rollingDice: anim.rolling,
    selectedRegion: sheet?.regionId ?? null,
    onRegionTap: (...a: Parameters<typeof sh.onRegionTap>) => {
      if (!demo.playing) sh.onRegionTap(...a);
    },
    onStackTap: (...a: Parameters<typeof sh.onStackTap>) => {
      if (!demo.playing) sh.onStackTap(...a);
    },
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
      rollDisabled={anim.busy || !!sheet || !!lock || demo.playing}
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
      onReplay={
        step?.play && demo.canReplay && !demo.playing
          ? () => {
              demo.replay();
              // the Replay button unmounts while the demo plays: keep keyboard focus in the step panel
              rootRef.current
                ?.querySelector<HTMLElement>('.sim-step')
                ?.focus({ preventScroll: true });
            }
          : undefined
      }
      captions={step?.play ? demo.captions : undefined}
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
      hidden={winShown}
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

  const watchEl = watcher.watch ? (
    <WatchControls
      watch={watcher.watch}
      busy={anim.busy}
      onToggle={watcher.toggle}
      onStep={watcher.step}
      onScrub={watcher.scrub}
      onSpeed={watcher.setSpeed}
      onExit={watcher.exit}
    />
  ) : null;

  return (
    <div
      ref={rootRef}
      class={`sim-root${landscape ? ' sim-land' : ''}${ui.compact ? ' sim-compact' : ''}${ui.showBankroll === false ? ' sim-hide-money' : ''}${ui.showHistory === false ? ' sim-hide-history' : ''}`}
      data-testid="simulator"
      data-mode={mode}
      onClickCapture={(e) => {
        if (demo.playing) {
          e.preventDefault();
          e.stopPropagation();
          demo.skip();
        } else if (anim.playing() && !(e.target as Element | null)?.closest?.('.sim-watch')) {
          e.preventDefault();
          e.stopPropagation();
          anim.skip();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && watching) {
          e.preventDefault();
          watcher.exit();
        } else if ((e.key === 'Escape' || e.key === ' ') && demo.playing) {
          e.preventDefault();
          demo.skip();
        } else if ((e.key === 'Escape' || e.key === ' ') && anim.playing()) {
          e.preventDefault();
          anim.skip();
        }
      }}
    >
      {landscape ? null : stepEl}
      {landscape ? null : watchEl}

      <div class="sim-main">
        <div class="sim-felt" {...(watching ? { inert: true } : {})}>
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
            {landscape ? null : winPromptEl}
          </div>
        </div>
        {landscape ? (
          <div class="sim-rail">
            {watchEl}
            {stepEl}
            <div class="sim-status-wrap">
              {status(true)}
              {toastsEl}
              {landscape ? winPromptEl : null}
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
                onWatch={(cfg) => {
                  sh.setSheet(null);
                  setAutoOpen(false);
                  watcher.start(cfg);
                }}
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
