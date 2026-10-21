import { useMemo } from 'preact/hooks';
import { equity } from '../engine/game';
import { resolveRules } from '../engine/rules';
import type { GameState, RulePresetId } from '../engine/types';
import type { SceneConfig, SceneInput } from '../scene/types';
import type { ManyResult, SessionResult, StrategySpec } from '../strategy/types';
import { decodeCustom } from '../strategy/custom';
import { AutoRollPanel } from './AutoRollPanel';
import { readUrlParams } from './useUrlBoot';
import { StreakLab } from './StreakLab';
import type { SimulatorEvent } from './types';

export interface SimAutoRollProps {
  scene: SceneConfig;
  game: GameState;
  rulesValue: RulePresetId;
  rollsPerHour: number;
  emit: (e: SimulatorEvent) => void;
  feedInput: (input: SceneInput) => void;
  /** a finished run, for the roll log */
  onResult?: (result: SessionResult | ManyResult) => void;
  /** sandbox only: remember the starting-bankroll pick for this viewer */
  persistKey?: string;
}

/** The auto-roll section: config from the scene, the live layout, and step feedback on completion. */
export function SimAutoRoll({
  scene,
  game,
  rulesValue,
  rollsPerHour,
  emit,
  feedInput,
  onResult,
  persistKey,
}: SimAutoRollProps) {
  const ar = scene.autoRoll;
  const config = useMemo(() => {
    if (!ar) {
      // I013: a shared "My system" link (#/play?system=...) opens the builder with that system
      const custom = decodeCustom(readUrlParams().get('system'));
      return custom
        ? { defaultStrategy: { id: 'custom' as const, unit: 1000, custom } }
        : undefined;
    }
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
    if (ar.table) cfg.table = true;
    if (ar.chart) cfg.chart = ar.chart;
    if (ar.sweep) cfg.sweep = ar.sweep;
    if (ar.stopWin !== undefined) cfg.stopWin = ar.stopWin;
    if (ar.stopLoss !== undefined) cfg.stopLoss = ar.stopLoss;
    if (ar.bankroll !== undefined) cfg.bankroll = ar.bankroll;
    return cfg;
  }, [ar]);
  const layoutBets = useMemo(
    () =>
      game.bets
        .filter((b) => !b.parentId)
        .map((b) => ({ type: b.type, amount: b.amount, point: b.point })),
    [game.bets],
  );
  const onCompleted = (
    result: SessionResult | ManyResult,
    all?: (SessionResult | ManyResult)[],
    specs?: StrategySpec[],
  ) => {
    emit({ type: 'auto-roll-completed', result });
    onResult?.(result);
    const played = (r: SessionResult | ManyResult) =>
      'rollsPlayed' in r ? r.rollsPlayed : Math.max(0, r.p50.length - 1);
    // a compare scene needs every compared strategy in the run; report the shortest run
    const needed = scene.autoRoll?.compare?.length ?? 1;
    const results = all && all.length ? all : [result];
    const rolls = results.length >= needed ? Math.min(...results.map(played)) : 0;
    const om = specs?.[0]?.oddsMultiple;
    feedInput({
      kind: 'auto-roll-completed',
      rolls,
      oddsMultiple: om === undefined ? 'default' : om,
    });
  };
  if (ar?.lab === 'streaks')
    return (
      <section class="sim-auto" aria-label="Auto-roll">
        <StreakLab
          onCompleted={(rolls) =>
            feedInput({ kind: 'auto-roll-completed', rolls, oddsMultiple: 'default' })
          }
        />
      </section>
    );
  return (
    <section class="sim-auto" aria-label="Auto-roll">
      <AutoRollPanel
        rules={typeof scene.rules === 'object' ? resolveRules(scene.rules) : rulesValue}
        bankroll={Math.max(0, equity(game))}
        {...(persistKey ? { persistKey } : {})}
        {...(config ? { config } : {})}
        layout={layoutBets}
        rollsPerHour={rollsPerHour}
        onCompleted={onCompleted}
        onSweepCompleted={(rolls) =>
          feedInput({ kind: 'auto-roll-completed', rolls, oddsMultiple: 'default' })
        }
      />
    </section>
  );
}
