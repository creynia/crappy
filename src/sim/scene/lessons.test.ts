import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { applyAction, maxOddsAmount, suggestAmount } from '../engine';
import type { Action, GameState } from '../engine';
import {
  conditionNeedsRoll,
  gateAction,
  initScene,
  observe,
  validateScene,
  type ActionMatcher,
  type Condition,
  type SceneConfig,
  type SceneRuntime,
} from './index';

const dir = join(__dirname, '..', '..', '..', 'content', 'lessons');
interface Found {
  file: string;
  scene: SceneConfig;
}
const found: Found[] = [];
for (const file of readdirSync(dir).sort()) {
  const src = readFileSync(join(dir, file), 'utf8');
  for (const m of src.matchAll(/```scene\n([\s\S]*?)\n```/g))
    found.push({ file, scene: parse(m[1] as string) as SceneConfig });
}

describe('lesson scenes validate (strict)', () => {
  it('finds scenes', () => expect(found.length).toBeGreaterThan(30));
  for (const { file, scene } of found) {
    it(`${file} ${scene.id}`, () => {
      const r = validateScene(scene);
      expect(r.ok ? [] : r.errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Scripted-path solver
// ---------------------------------------------------------------------------

class Run {
  game: GameState;
  rt: SceneRuntime;
  completed: string[] = [];
  done = false;
  constructor(public scene: SceneConfig) {
    const i = initScene(scene);
    this.game = i.game;
    this.rt = i.runtime;
  }
  feed(input: Parameters<typeof observe>[3]) {
    const r = observe(this.scene, this.rt, this.game, input);
    this.rt = r.runtime;
    this.game = r.game;
    if (r.completedStep) this.completed.push(r.completedStep);
    if (r.sceneCompleted) this.done = true;
  }
  act(action: Action, why: string) {
    const gate = gateAction(this.scene, this.rt, this.game, action);
    if (!gate.ok)
      throw new Error(`${why}: gate rejected ${JSON.stringify(action)}: ${gate.message}`);
    const res = applyAction(this.game, action);
    if (!res.ok)
      throw new Error(`${why}: engine rejected ${JSON.stringify(action)}: ${res.error.message}`);
    this.game = res.state;
    this.feed({ kind: 'action', action, events: res.events });
  }
}

function placeFor(run: Run, m: ActionMatcher, why: string) {
  const betType = Array.isArray(m.betType) ? m.betType[0]! : m.betType;
  if (m.type === 'roll') return run.act({ type: 'roll' }, why);
  if (m.type !== 'place-bet' || !betType)
    throw new Error(`${why}: cannot script ${JSON.stringify(m)}`);
  let parentId: string | undefined;
  if (betType === 'come-odds' || betType === 'dont-come-odds') {
    const flat = betType === 'come-odds' ? 'come' : 'dont-come';
    const withOdds = new Set(run.game.bets.filter((b) => b.parentId).map((b) => b.parentId));
    parentId = run.game.bets.find((b) => b.type === flat && b.point && !withOdds.has(b.id))?.id;
  }
  let amount = m.amount ?? m.minAmount ?? 0;
  if (m.oddsMax) {
    const parent =
      parentId ??
      run.game.bets.find((b) => b.type === (betType === 'pass-odds' ? 'pass-line' : 'dont-pass'))
        ?.id;
    if (!parent) throw new Error(`${why}: no parent for ${betType}`);
    amount = maxOddsAmount(run.game, parent);
  }
  if (!amount) amount = suggestAmount(betType, run.game.rules.tableMin, run.game);
  const action: Action = { type: 'place-bet', betType, amount, ...(parentId ? { parentId } : {}) };
  run.act(action, why);
}

function satisfy(run: Run, c: Condition, why: string): void {
  if ('all' in c) return c.all.forEach((x) => satisfy(run, x, why));
  if ('any' in c) return satisfy(run, c.any[0]!, why);
  if ('action' in c) {
    for (let i = 0; i < (c.count ?? 1); i++) placeFor(run, c.action, why);
    return;
  }
  if ('previewed' in c) return run.feed({ kind: 'previewed', betType: c.previewed });
  if ('acknowledged' in c) return run.feed({ kind: 'acknowledged' });
  if ('autoRollCompleted' in c)
    return run.feed({ kind: 'auto-roll-completed', rolls: c.autoRollCompleted.minRolls ?? 1 });
  if ('betOnTable' in c) {
    if (run.game.bets.some((b) => b.type === c.betOnTable.type)) return;
    return placeFor(
      run,
      { type: 'place-bet', betType: c.betOnTable.type, minAmount: c.betOnTable.minAmount },
      why,
    );
  }
  // roll-driven conditions: roll until the step advances (bounded)
  const idx = run.rt.stepIndex;
  for (let i = 0; i < 400 && run.rt.stepIndex === idx && !run.rt.done; i++)
    run.act({ type: 'roll' }, why);
}

function solve(scene: SceneConfig): Run {
  const run = new Run(scene);
  for (let guard = 0; guard < 200 && !run.done; guard++) {
    const idx = run.rt.stepIndex;
    const step = scene.steps![idx]!;
    const why = `${scene.id} step "${step.id}"`;
    if (run.rt.satisfied) {
      run.feed({ kind: 'acknowledged' });
      continue;
    }
    if (step.expect && !conditionNeedsRoll(step.completeWhen)) {
      for (const m of step.expect) placeFor(run, m, why);
      if (run.rt.stepIndex === idx && !run.rt.done && !run.rt.satisfied)
        satisfy(run, step.completeWhen, why);
    } else satisfy(run, step.completeWhen, why);
    if (run.rt.stepIndex === idx && !run.rt.done && !run.rt.satisfied)
      throw new Error(`${why}: did not complete by scripted path`);
  }
  return run;
}

describe('lesson scenes are completable by their scripted path', () => {
  for (const { file, scene } of found.filter((f) => f.scene.steps?.length)) {
    it(`${file} ${scene.id}`, () => {
      const run = solve(scene);
      expect(run.done).toBe(true);
      expect(run.completed).toHaveLength(scene.steps!.length);
    });
  }
});
