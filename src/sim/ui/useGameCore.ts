import { useRef, useState } from 'preact/hooks';
import { BET_TYPES } from '../engine/bets';
import { applyAction, equity } from '../engine/game';
import type {
  Action,
  ApplyResult,
  BetTypeId,
  Cents,
  GameEvent,
  GameState,
  Validation,
} from '../engine/types';
import { tableExpectedLossPerRoll, expectedLossByTypePerRoll } from '../math/ev';
import { toNumber } from '../math/fraction';
import { gateAction, observe } from '../scene';
import type { SceneConfig, SceneInput } from '../scene/types';
import type { SimulatorEvent } from './types';
import type { Core } from './useUrlBoot';

export type DoActionResult = ApplyResult | { ok: false; error: Extract<Validation, { ok: false }> };

interface GameCoreOptions {
  boot: { core: Core; startEquity: Cents };
  sceneRef: { current: SceneConfig };
  emit: (e: SimulatorEvent) => void;
  /** a gate or engine rejection: show the hint and a toast */
  onRejected: (message: string) => void;
  /** a confirmed roll: animate from pre to post */
  onRolled: (pre: GameState, post: GameState, events: GameEvent[]) => void;
}

/** Game state + scene runtime, scene observation (feed) and the gated action dispatcher. */
export function useGameCore({ boot, sceneRef, emit, onRejected, onRolled }: GameCoreOptions) {
  const [core, setCoreState] = useState<Core>(boot.core);
  const coreRef = useRef(core);
  const setCore = (c: Core) => {
    coreRef.current = c;
    setCoreState(c);
  };
  const startEquity = useRef(boot.startEquity);
  const lastOneRoll = useRef<{ type: BetTypeId; amount: Cents }[]>([]);

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

  /** Gate + engine + scene observation. */
  const doAction = (action: Action): DoActionResult => {
    const { game: g, rt: r } = coreRef.current;
    const sc = sceneRef.current;
    const gate = gateAction(sc, r, g, action);
    if (!gate.ok) {
      emit({ type: 'action-rejected', action, error: gate });
      onRejected(gate.message);
      return { ok: false, error: gate };
    }
    const res = applyAction(g, action, {
      expectedLossFn: (s) => toNumber(tableExpectedLossPerRoll(s)),
      expectedLossByTypeFn: expectedLossByTypePerRoll,
    });
    if (!res.ok) {
      emit({ type: 'action-rejected', action, error: res.error });
      onRejected(res.error.message);
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
      onRolled(g, res.state, res.events);
    }
    return res;
  };

  /** Feeds a non-action scene input against the current game and commits it. */
  const feedInput = (input: SceneInput) => setCore(feed(input, coreRef.current.game));

  return { core, coreRef, setCore, startEquity, lastOneRoll, feed, feedInput, doAction };
}
