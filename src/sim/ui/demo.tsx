// Dev-only gallery with mocked props. Open /src/sim/ui/demo.html in `npm run dev`.
// Query: ?view=portrait|landscape|center  &sheet=free|good|fair|poor|avoid|invalid  &why=1  &dark=1
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { BetSheet, type SheetPreview } from './BetSheet';
import { CenterPanel } from './CenterPanel';
import { ChipRack } from './ChipRack';
import { RollButton } from './RollButton';
import { StatusBar } from './StatusBar';
import { Table } from './Table';
import { Toasts } from './Toasts';
import { buildAnimationQueue, playTimeline, type Player } from './animation';
import { landscapeLayout, portraitLayout } from './layouts';
import type { RegionId } from './layouts/types';
import { buildEvFacts, describeRoll } from './text';
import type { Bet, Dice, GameEvent, RollRecord } from '../engine/types';
import type { UiTier } from './text';
type EdgeTier = UiTier;

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? (innerWidth > innerHeight ? 'landscape' : 'portrait');
if (q.get('dark')) document.documentElement.dataset.theme = 'dark';

const bet = (id: string, type: Bet['type'], amount: number, point: Bet['point'] = null): Bet => ({
  id,
  type,
  amount,
  point,
  parentId: null,
  working: 'auto',
  placedOnRoll: 1,
  vigPaid: 0,
});
const BETS: Bet[] = [
  bet('b1', 'pass-line', 1000),
  bet('b2', 'pass-odds', 3000),
  bet('b3', 'come', 500, 8),
  bet('b4', 'come-odds', 1500, 8),
  bet('b5', 'place-6', 1200),
  bet('b6', 'place-9', 500),
  bet('b7', 'dont-come', 500, 4),
  bet('b8', 'field', 500),
  bet('b9', 'big-8', 2500),
  bet('b10', 'lay-10', 4000),
  bet('b11', 'buy-5', 2000),
  bet('b12', 'hard-6', 100),
  bet('b13', 'any-7', 500),
  bet('b14', 'horn', 400),
  bet('b15', 'dont-pass', 20000),
  bet('b16', 'yo-11', 100),
];
const rec = (
  n: number,
  a: 1 | 2 | 3 | 4 | 5 | 6,
  b: 1 | 2 | 3 | 4 | 5 | 6,
  pb: 'come-out' | 'point',
  pt: 6 | null,
): RollRecord => ({
  n,
  dice: [a, b],
  total: a + b,
  hard: a === b,
  phaseBefore: pb,
  pointBefore: pt,
  forced: false,
  net: 0,
});
const HISTORY: RollRecord[] = [
  rec(1, 3, 4, 'come-out', null),
  rec(2, 2, 4, 'come-out', null),
  rec(3, 5, 1, 'point', 6),
  rec(4, 6, 6, 'point', 6),
  rec(5, 3, 3, 'point', 6),
  rec(6, 1, 1, 'come-out', null),
  rec(7, 5, 6, 'come-out', null),
  rec(8, 4, 4, 'come-out', null),
  rec(9, 4, 3, 'point', 6),
];

const frac = (n: number, d = 1) => ({ n: BigInt(n), d: BigInt(d) });
function mockPreview(tier: EdgeTier | 'invalid'): SheetPreview {
  const edgeN = { free: 0, good: 141, fair: 400, poor: 667, avoid: 1111, invalid: 141 }[tier];
  const headline = {
    free: 'Expected value: $0.00 (no house edge, the best bet in the casino)',
    good: 'Expected value: -$0.14 (house edge 1.41%)',
    fair: 'Expected value: -$0.20 (house edge 4.00%)',
    poor: 'Expected value: -$0.33 (house edge 6.67%)',
    avoid: 'Expected value: -$0.11 (house edge 11.11%)',
    invalid: 'Expected value: -$0.14 (house edge 1.41%)',
  }[tier];
  return {
    action: { type: 'place-bet', betType: tier === 'avoid' ? 'hard-4' : 'pass-line', amount: 1000 },
    validation:
      tier === 'invalid'
        ? {
            ok: false,
            code: 'wrong-phase',
            message: "Come bets can't be placed on the come-out roll.",
          }
        : {
            ok: true,
            warnings:
              tier === 'fair'
                ? [
                    {
                      code: 'short-pay',
                      message: '$5 on the 6 pays $5.83 here; most casinos pay $5. Bet in $6 units.',
                    },
                  ]
                : [],
          },
    evCents: frac(-14),
    edge: {
      perResolved: frac(edgeN, 10000),
      perResolvedExPush: frac(edgeN, 10000),
      expectedRolls: frac(8),
      perRoll: frac(edgeN, 80000),
    },
    tier: tier === 'invalid' ? 'good' : tier,
    perRollCents: frac(-4),
    perHourCents: frac(tier === 'avoid' ? 1389 : 176),
    rollsPerHour: 100,
    headline,
    detail: "About -$0.04 per roll while it's working",
    alternative:
      tier === 'avoid' || tier === 'poor'
        ? {
            action: { type: 'place-bet', betType: 'buy-4', amount: 2000 },
            label: 'Buy the 4',
            edge: {
              perResolved: frac(167, 10000),
              perResolvedExPush: frac(167, 10000),
              expectedRolls: frac(8),
              perRoll: frac(2, 10000),
            },
            savingsCents: frac(100),
            message: 'Buy the 4 instead: same bet, 1.67% instead of 6.67%.',
          }
        : null,
    explanation: {
      rows: [
        {
          label: '7 before the point',
          ways: 6,
          outOf: 11,
          probability: frac(6, 11),
          net: frac(-1000),
        },
        { label: 'Point first', ways: 5, outOf: 11, probability: frac(5, 11), net: frac(1000) },
      ],
      evFormula: '5/11 × $10.00 − 6/11 × $10.00 = -$0.91',
      note: tier === 'free' ? 'Odds pay true odds, so the house has no edge.' : undefined,
    },
  };
}

const DICE: Dice[] = [
  [3, 3],
  [4, 2],
  [1, 6],
];

function App() {
  const [chip, setChip] = useState(500);
  const [sheet, setSheet] = useState<string | null>(q.get('sheet'));
  const [rolling, setRolling] = useState<Dice | null>(null);
  const [roll, setRoll] = useState(0);
  const [toasts, setToasts] = useState(
    q.get('toast')
      ? [
          {
            id: 't1',
            tone: 'win' as const,
            text: describeRoll([
              { type: 'dice-rolled', roll: { ...rec(10, 3, 3, 'point', 6), net: 7000 } },
              { type: 'point-made', point: 6 },
              {
                type: 'bet-won',
                betId: 'b1',
                betType: 'pass-line',
                amount: 1000,
                profit: 1000,
                vig: 0,
                staysUp: true,
              },
              {
                type: 'bet-won',
                betId: 'b2',
                betType: 'pass-odds',
                amount: 3000,
                profit: 3600,
                vig: 0,
                staysUp: false,
              },
            ] as GameEvent[]),
          },
        ]
      : [],
  );
  let player: Player | null = null;

  const doRoll = () => {
    const d = DICE[roll % DICE.length]!;
    setRoll(roll + 1);
    setRolling(d);
    const tl = buildAnimationQueue(
      [{ type: 'dice-rolled', roll: rec(10, d[0], d[1], 'point', 6) }],
      'normal',
    );
    player?.cancel();
    player = playTimeline(tl, { onDone: () => setRolling(null) });
  };

  const land = view === 'landscape';
  const showCenter = view === 'center';
  const common = {
    bets: BETS,
    point: 6 as const,
    offBetIds: new Set(['b5']),
    disabledRegions: new Set<RegionId>(q.get('dim') ? ['field'] : []),
    highlightedBets: q.get('hl') ? (['pass-line'] as const) : [],
    onRegionTap: (id: RegionId) =>
      setSheet(
        id === 'field' ? 'poor' : id.startsWith('hard') || id.endsWith('7') ? 'avoid' : 'good',
      ),
    rollingDice: rolling ? { dice: rolling, durationMs: 1000 } : null,
  };
  const tier = sheet ?? 'good';
  const facts = buildEvFacts(mockPreview(tier as EdgeTier), {
    amount: 1000,
    oneRoll: tier === 'avoid' || tier === 'poor',
    chance: '5 in 11 (45%)',
    pays: '7 to 6',
    combined: tier === 'good' ? { label: 'Pass + Odds', edge: 0.0037 } : null,
  });

  return (
    <div class={`demo${land ? ' demo-land' : ''}`}>
      <div class="demo-toasts">
        <Toasts toasts={toasts} onDismiss={(id) => setToasts(toasts.filter((t) => t.id !== id))} />
      </div>
      {!land ? (
        <StatusBar bankroll={43000} onTable={7000} session={2000} point={6} history={HISTORY} />
      ) : null}
      <div class="demo-main">
        {showCenter ? (
          <CenterPanel {...common} />
        ) : (
          <Table {...common} layout={land ? landscapeLayout : portraitLayout} />
        )}
      </div>
      {land ? (
        <div class="demo-rail">
          <StatusBar
            compact
            bankroll={43000}
            onTable={7000}
            session={2000}
            point={6}
            history={HISTORY}
          />
          <ChipRack
            denominations={[100, 500, 2500, 10000, 50000]}
            selected={chip}
            bankroll={43000}
            onSelect={setChip}
            orientation="row"
          />
          <RollButton onRoll={doRoll} costText="Expected cost: $0.42" />
        </div>
      ) : (
        <div class="demo-controls">
          <ChipRack
            denominations={[100, 500, 2500, 10000, 50000]}
            selected={chip}
            bankroll={43000}
            onSelect={setChip}
          />
          <RollButton onRoll={doRoll} costText="Expected cost: $0.42" />
        </div>
      )}
      {sheet ? (
        <BetSheet
          title={sheet === 'avoid' ? 'Hard 4' : 'Pass line'}
          placement={land ? 'panel' : 'sheet'}
          preview={mockPreview(sheet as EdgeTier | 'invalid')}
          facts={facts}
          forceWhyOpen={!!q.get('why')}
          typeOptions={[
            { id: 'pass-line', label: 'Pass line', enabled: true },
            { id: 'pass-odds', label: 'Odds', enabled: true },
          ]}
          selectedType="pass-line"
          amount={1000}
          step={chip}
          quickActions={[
            { id: 'min', label: 'Min', amount: 500 },
            { id: 'double', label: '×2', amount: 2000 },
          ]}
          onTypeChange={() => {}}
          onAmountChange={() => {}}
          onConfirm={() => setSheet(null)}
          onCancel={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
