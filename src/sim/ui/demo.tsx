// Dev-only gallery with mocked props. Open /src/sim/ui/demo.html in `npm run dev`.
// Query: ?view=portrait|landscape|center  &sheet=free|good|fair|poor|avoid|invalid  &why=1  &dark=1
import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { BetSheet } from './BetSheet';
import { CenterPanel } from './CenterPanel';
import { ChipRack } from './ChipRack';
import { RollButton } from './RollButton';
import { StatusBar } from './StatusBar';
import { Table } from './Table';
import { Toasts } from './Toasts';
import { buildAnimationQueue, durationFor, playTimeline, type Player } from './animation';
import { landscapeLayout, portraitLayout } from './layouts';
import type { RegionId } from './layouts/types';
import { buildEvFacts, describeRoll } from './text';
import { createGame, legalBetTypes } from '../engine';
import { previewAction } from '../math';
import type {
  Action,
  Bet,
  BetTypeId,
  Dice,
  GameEvent,
  GameState,
  RollRecord,
} from '../engine/types';

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

// ---- real engine state + real previews (no literals) ----
const baseGame = () =>
  createGame({
    point: 6,
    bankroll: 43000,
    seed: 7,
    bets: [
      { ref: 'p', type: 'pass-line', amount: 1000 },
      { type: 'pass-odds', amount: 3000, parentRef: 'p' },
    ],
  });
const GAME = baseGame();
const COME_OUT = createGame({ bankroll: 43000, seed: 7 });

interface Scenario {
  title: string;
  state: GameState;
  action: Action;
  types: BetTypeId[];
  labels: Partial<Record<BetTypeId, string>>;
}
const SCENARIOS: Record<string, Scenario> = {
  free: {
    title: 'Pass line odds',
    state: createGame({
      point: 6,
      bankroll: 43000,
      seed: 7,
      bets: [{ type: 'pass-line', amount: 1000 }],
    }),
    action: { type: 'place-bet', betType: 'pass-odds', amount: 3000 },
    types: ['pass-line', 'pass-odds'],
    labels: { 'pass-line': 'Pass line', 'pass-odds': 'Odds' },
  },
  good: {
    title: 'Place 6',
    state: GAME,
    action: { type: 'place-bet', betType: 'place-6', amount: 1200 },
    types: ['place-6', 'buy-6', 'lay-6'],
    labels: { 'place-6': 'Place', 'buy-6': 'Buy', 'lay-6': 'Lay' },
  },
  fair: {
    title: 'Place 5',
    state: GAME,
    action: { type: 'place-bet', betType: 'place-5', amount: 1000 },
    types: ['place-5', 'buy-5', 'lay-5'],
    labels: { 'place-5': 'Place', 'buy-5': 'Buy', 'lay-5': 'Lay' },
  },
  poor: {
    title: 'Field',
    state: GAME,
    action: { type: 'place-bet', betType: 'field', amount: 500 },
    types: ['field'],
    labels: { field: 'Field' },
  },
  avoid: {
    title: 'Hard 4',
    state: GAME,
    action: { type: 'place-bet', betType: 'hard-4', amount: 500 },
    types: ['hard-4'],
    labels: { 'hard-4': 'Hard 4' },
  },
  invalid: {
    title: 'Come',
    state: COME_OUT,
    action: { type: 'place-bet', betType: 'come', amount: 1000 },
    types: ['come'],
    labels: { come: 'Come' },
  },
};

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
  const player = useRef<Player | null>(null);
  const sc = sheet ? SCENARIOS[sheet] : undefined;
  const [pending, setPending] = useState<{ type: BetTypeId; amount: number } | null>(null);

  const doRoll = () => {
    const d = DICE[roll % DICE.length]!;
    setRoll(roll + 1);
    setRolling(d);
    const tl = buildAnimationQueue(
      [{ type: 'dice-rolled', roll: rec(10, d[0], d[1], 'point', 6) }],
      'normal',
    );
    player.current?.cancel();
    player.current = playTimeline(tl, { onDone: () => setRolling(null) });
  };

  const land = view === 'landscape';
  const showCenter = view === 'center';
  const common = {
    bets: BETS,
    point: 6 as const,
    offBetIds: new Set(['b5']),
    disabledRegions: new Set<RegionId>(q.get('dim') ? ['field'] : []),
    highlightedBets: q.get('hl') ? (['pass-line'] as const) : [],
    onRegionTap: (id: RegionId) => {
      const key =
        id === 'field'
          ? 'poor'
          : id.startsWith('hard') || id === 'any-7'
            ? 'avoid'
            : id === 'pass'
              ? 'free'
              : id === 'box-5' || id === 'box-9'
                ? 'fair'
                : id === 'come'
                  ? 'invalid'
                  : 'good';
      setSheet(key);
      const s = SCENARIOS[key]!;
      const a = s.action as Extract<Action, { type: 'place-bet' }>;
      setPending({ type: a.betType, amount: a.amount });
    },
    rollingDice: rolling ? { dice: rolling, durationMs: durationFor('dice', 'normal') } : null,
  };
  const cur = sc
    ? (pending ?? {
        type: (sc.action as Extract<Action, { type: 'place-bet' }>).betType,
        amount: (sc.action as Extract<Action, { type: 'place-bet' }>).amount,
      })
    : null;
  const action: Action | null = cur
    ? { type: 'place-bet', betType: cur.type, amount: cur.amount }
    : null;
  const preview = sc && action ? previewAction(sc.state, action) : null;
  const facts = preview && sc ? buildEvFacts(preview, sc.state) : null;
  const legal = sc ? new Set(legalBetTypes(sc.state)) : new Set<BetTypeId>();

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
      {sc && cur && preview ? (
        <BetSheet
          title={sc.title}
          placement={land ? 'panel' : 'sheet'}
          preview={preview}
          facts={facts}
          forceWhyOpen={!!q.get('why')}
          typeOptions={sc.types.map((id) => ({
            id,
            label: sc.labels[id] ?? id,
            enabled: legal.has(id) || id === cur.type,
          }))}
          selectedType={cur.type}
          amount={cur.amount}
          step={chip}
          quickActions={[
            { id: 'min', label: 'Min', amount: 500 },
            { id: 'double', label: '×2', amount: cur.amount * 2 },
          ]}
          onTypeChange={(t) => setPending({ ...cur, type: t })}
          onAmountChange={(n) => setPending({ ...cur, amount: n })}
          onUseAlternative={(act) => {
            if (act.type === 'place-bet') setPending({ type: act.betType, amount: act.amount });
          }}
          onConfirm={() => setSheet(null)}
          onCancel={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
