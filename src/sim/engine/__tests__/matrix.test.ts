import { describe, expect, it } from 'vitest';
import { BET_TYPE_IDS, BET_TYPES, resolveRules } from '../index';
import type { Bet, BetTypeId, PointNumber, TableRules } from '../index';
import { oracle, type OracleOut, type OracleRules } from './oracle';

const POINTS: PointNumber[] = [4, 5, 6, 8, 9, 10];

interface Situation {
  phase: 'come-out' | 'point';
  point: PointNumber | null;
  betPoint: PointNumber | null;
  progress?: number[];
}

/** Progress states worth checking for a bonus bet: empty, partial, one short of complete. */
function progressSets(type: BetTypeId): number[][] {
  const targets =
    type === 'fire'
      ? [4, 5, 6, 8, 9, 10]
      : type === 'small'
        ? [2, 3, 4, 5, 6]
        : type === 'tall'
          ? [8, 9, 10, 11, 12]
          : [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
  const out: number[][] = [[]];
  for (let k = 1; k < targets.length; k++) out.push(targets.slice(0, k));
  for (let k = 1; k < targets.length; k++) out.push(targets.slice(targets.length - k));
  return out;
}

function situations(type: BetTypeId): Situation[] {
  const out: Situation[] = [];
  const cat = BET_TYPES[type].category;
  const states: Array<[Situation['phase'], PointNumber | null]> = [
    ['come-out', null],
    ...POINTS.map((p): [Situation['phase'], PointNumber | null] => ['point', p]),
  ];
  if (type === 'come' || type === 'dont-come') {
    for (const [phase, point] of states) {
      out.push({ phase, point, betPoint: null });
      for (const n of POINTS) out.push({ phase, point, betPoint: n });
    }
  } else if (type === 'pass-odds' || type === 'dont-pass-odds') {
    for (const p of POINTS) out.push({ phase: 'point', point: p, betPoint: p });
  } else if (cat === 'odds') {
    for (const [phase, point] of states)
      for (const n of POINTS) out.push({ phase, point, betPoint: n });
  } else if (cat === 'bonus') {
    for (const [phase, point] of states)
      for (const progress of progressSets(type))
        out.push({ phase, point, betPoint: null, progress });
  } else {
    for (const [phase, point] of states) out.push({ phase, point, betPoint: null });
  }
  return out;
}

const VARIANTS: Array<[string, Partial<TableRules>]> = [
  ['default', {}],
  ['payoutUnit 100', { payoutUnit: 100 }],
  ['field-3x-12', { fieldPays: { 2: 2, 12: 3 } }],
  ['exact-cents vig', { vig: { rate: 0.05, timing: 'on-win', rounding: 'exact-cents' } }],
  ['upfront vig', { vig: { rate: 0.05, timing: 'upfront', rounding: 'floor-dollar-min-1' } }],
];

function normalize(r: OracleOut): OracleOut {
  return r;
}

describe('resolution matrix vs independent oracle', () => {
  for (const [vname, partial] of VARIANTS) {
    const rules = resolveRules(partial);
    const orules: OracleRules = {
      payoutUnit: rules.payoutUnit,
      vigTiming: rules.vig.timing,
      vigRounding: rules.vig.rounding,
      field2: rules.fieldPays[2],
      field12: rules.fieldPays[12],
    };
    describe(vname, () => {
      for (const type of BET_TYPE_IDS) {
        const def = BET_TYPES[type];
        const amounts = [6000, 700 * def.unitMultiple];
        it(`${type}: all situations x 36 dice x working on/off`, () => {
          const bad: string[] = [];
          let checked = 0;
          for (const s of situations(type)) {
            for (const amount of amounts) {
              for (const working of [true, false]) {
                for (const paid of rules.vig.timing === 'upfront' ? [true, false] : [false]) {
                  for (let d1 = 1; d1 <= 6; d1++) {
                    for (let d2 = 1; d2 <= 6; d2++) {
                      const bet = {
                        type,
                        amount,
                        point: s.betPoint,
                        vigPaid: paid ? 100 : 0,
                        ...(s.progress ? { progress: s.progress } : {}),
                      } as Bet;
                      const got = normalize(
                        def.resolve(
                          bet,
                          {
                            dice: [d1 as 1, d2 as 1],
                            total: d1 + d2,
                            hard: d1 === d2,
                            phase: s.phase,
                            point: s.point,
                          },
                          rules,
                          working,
                        ),
                      );
                      const want = oracle({
                        type,
                        amount,
                        betPoint: s.betPoint,
                        phase: s.phase,
                        point: s.point,
                        d1,
                        d2,
                        working,
                        upfrontPaid: paid,
                        rules: orules,
                        ...(s.progress ? { progress: s.progress } : {}),
                      });
                      checked++;
                      if (JSON.stringify(got) !== JSON.stringify(want)) {
                        bad.push(
                          `${JSON.stringify(s)} a=${amount} w=${working} ${d1}-${d2}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`,
                        );
                      }
                    }
                  }
                }
              }
            }
          }
          expect(bad.slice(0, 5)).toEqual([]);
          expect(checked).toBeGreaterThan(0);
        });
      }
    });
  }
});
