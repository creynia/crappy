import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BetSheet, type BetSheetProps, type SheetPreview } from './BetSheet';
import { CenterPanel } from './CenterPanel';
import { ChipRack } from './ChipRack';
import { ChipStack, chipBreakdown } from './ChipStack';
import { DiceGrid } from './DiceGrid';
import { HistoryStrip, rollOutcome } from './HistoryStrip';
import { Puck } from './Puck';
import { RollButton } from './RollButton';
import { StatusBar } from './StatusBar';
import { Table } from './Table';
import { Toasts } from './Toasts';
import { portraitLayout } from './layouts';
import { buildEvFacts } from './text';
import { OddsHint } from './OddsHint';
import { createGame } from '../engine';
import { previewAction } from '../math';
import type { BetTypeId } from '../engine/types';
import type { Bet, RollRecord } from '../engine/types';
import type { EdgeTier } from '../math/types';

afterEach(cleanup);

const fr = (n: number, d = 1) => ({ n: BigInt(n), d: BigInt(d) });
const bet = (id: string, type: Bet['type'], amount: number, point: Bet['point'] = null): Bet => ({
  id,
  type,
  amount,
  point,
  parentId: null,
  working: 'auto',
  placedOnRoll: 0,
  vigPaid: 0,
});

function preview(tier: EdgeTier, over: Partial<SheetPreview> = {}): SheetPreview {
  return {
    action: { type: 'place-bet', betType: 'pass-line', amount: 1000 },
    validation: { ok: true, warnings: [] },
    evCents: fr(-14),
    edge: {
      perResolved: fr(141, 10000),
      perResolvedExPush: fr(141, 10000),
      expectedRolls: fr(8),
      perRoll: fr(1, 600),
    },
    tier,
    perRollCents: fr(-4),
    perHourCents: fr(176),
    rollsPerHour: 100,
    headline: 'Expected value: -$0.14 (house edge 1.41%)',
    detail: 'detail text',
    alternative: null,
    explanation: {
      rows: [{ label: '7 first', ways: 6, outOf: 11, probability: fr(6, 11), net: fr(-1000) }],
      evFormula: 'formula here',
    },
    ...over,
  };
}

function sheetProps(over: Partial<BetSheetProps> = {}): BetSheetProps {
  return {
    title: 'Place 6',
    preview: preview('good'),
    typeOptions: [{ id: 'place-6', label: 'Place 6', enabled: true }],
    selectedType: 'place-6',
    amount: 1200,
    step: 500,
    onTypeChange: vi.fn(),
    onAmountChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

function sheet(over: Partial<BetSheetProps> = {}) {
  const props: BetSheetProps = {
    title: 'Pass line',
    preview: preview('good'),
    typeOptions: [
      { id: 'pass-line', label: 'Pass line', enabled: true },
      { id: 'pass-odds', label: 'Odds', enabled: false },
    ],
    selectedType: 'pass-line',
    amount: 1000,
    step: 500,
    onTypeChange: vi.fn(),
    onAmountChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
  render(<BetSheet {...props} />);
  return props;
}

describe('Table', () => {
  it('renders every region as a labelled button with data-region', () => {
    render(<Table layout={portraitLayout} bets={[bet('b1', 'place-6', 1200)]} point={6} />);
    const regions = document.querySelectorAll('[data-region]');
    expect(regions.length).toBe(portraitLayout.regions.length);
    for (const r of regions) {
      expect(r.getAttribute('role')).toBe('button');
      expect(r.getAttribute('aria-label')).toBeTruthy();
    }
    expect(screen.getByLabelText(/Place 6 \$12, working/)).toBeTruthy();
  });

  it('taps and keys emit onRegionTap', () => {
    const onRegionTap = vi.fn();
    render(<Table layout={portraitLayout} bets={[]} point={null} onRegionTap={onRegionTap} />);
    fireEvent.click(document.querySelector('[data-region="pass"]')!);
    expect(onRegionTap).toHaveBeenCalledWith('pass');
    fireEvent.keyDown(document.querySelector('[data-region="field"]')!, { key: 'Enter' });
    expect(onRegionTap).toHaveBeenCalledWith('field');
  });

  it('tapping a chip stack emits onStackTap without opening the region', () => {
    const onRegionTap = vi.fn();
    const onStackTap = vi.fn();
    render(
      <Table
        layout={portraitLayout}
        bets={[bet('b9', 'field', 500)]}
        point={null}
        onRegionTap={onRegionTap}
        onStackTap={onStackTap}
      />,
    );
    fireEvent.click(document.querySelector('[data-stack="b9"]')!);
    expect(onStackTap).toHaveBeenCalledWith('b9', ['b9']);
    expect(onRegionTap).not.toHaveBeenCalled();
  });

  it('stacks are keyboard reachable', () => {
    const onStackTap = vi.fn();
    render(
      <Table
        layout={portraitLayout}
        bets={[bet('b9', 'field', 500)]}
        point={null}
        onStackTap={onStackTap}
      />,
    );
    const s = document.querySelector('[data-stack="b9"]')!;
    expect(s.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(s, { key: 'Enter' });
    expect(onStackTap).toHaveBeenCalled();
  });

  it('dims disabled regions and announces why', () => {
    render(
      <Table
        layout={portraitLayout}
        bets={[]}
        point={null}
        disabledRegions={new Set(['field'] as const)}
      />,
    );
    const g = document.querySelector('[data-region="field"]')!;
    expect(g.getAttribute('class')).toContain('is-disabled');
    expect(g.getAttribute('aria-label')).toContain('Not available in this lesson');
  });

  it('shows the puck ON on the point box and OFF otherwise', () => {
    const { rerender } = render(<Table layout={portraitLayout} bets={[]} point={8} />);
    expect(document.querySelector('[data-puck="on"]')).toBeTruthy();
    rerender(<Table layout={portraitLayout} bets={[]} point={null} />);
    expect(document.querySelector('[data-puck="off"]')).toBeTruthy();
  });

  it('marks a non-working bet OFF in the label', () => {
    render(
      <Table
        layout={portraitLayout}
        bets={[bet('b1', 'place-6', 1200)]}
        point={null}
        offBetIds={new Set(['b1'])}
      />,
    );
    expect(screen.getByLabelText(/Place 6 \$12, off/)).toBeTruthy();
  });

  it('CenterPanel renders the bonus rail with progress pips', () => {
    const { container } = render(
      <CenterPanel bets={[{ ...bet('b1', 'small', 100), progress: [2, 3] }]} />,
    );
    expect(container.querySelector('[data-region="fire"]')).not.toBeNull();
    const small = container.querySelector('[data-region="small"]')!;
    expect(small.querySelectorAll('.sim-pips .is-hit')).toHaveLength(2);
    expect(container.querySelector('[data-region="tall"] .sim-pips .is-hit')).toBeNull();
  });
  it('CenterPanel renders the proposition cells', () => {
    render(<CenterPanel bets={[bet('b1', 'hard-6', 500)]} />);
    expect(document.querySelector('[data-region="any-7"]')).toBeTruthy();
    expect(screen.getByLabelText(/Hard 6.*Hard 6 \$5, working/)).toBeTruthy();
  });
});

describe('chips', () => {
  it('breaks amounts into chips largest first', () => {
    expect(chipBreakdown(13000)).toEqual([10000, 2500, 500]);
    expect(chipBreakdown(100)).toEqual([100]);
  });
  it('ChipRack selects, and disables unaffordable chips', () => {
    const onSelect = vi.fn();
    render(
      <ChipRack
        denominations={[100, 500, 2500]}
        selected={500}
        bankroll={1000}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: '$1 chip' }));
    expect(onSelect).toHaveBeenCalledWith(100);
    expect(screen.getByRole<HTMLButtonElement>('radio', { name: /\$25 chip/ }).disabled).toBe(true);
    expect(screen.getByRole('radio', { name: '$5 chip' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
  it('Puck has an accessible label', () => {
    render(
      <svg>
        <Puck x={0} y={0} r={40} on />
      </svg>,
    );
    expect(screen.getByLabelText('Puck: ON')).toBeTruthy();
  });
});

describe('RollButton, StatusBar, history, toasts', () => {
  it('RollButton calls onRoll and shows the cost', () => {
    const onRoll = vi.fn();
    render(<RollButton onRoll={onRoll} costText="Expected cost: $0.42" />);
    expect(screen.getByText('Expected cost: $0.42')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onRoll).toHaveBeenCalledOnce();
  });
  it('RollButton is disabled when asked', () => {
    render(<RollButton onRoll={() => {}} disabled />);
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });

  const hist: RollRecord[] = [
    {
      n: 1,
      dice: [3, 4],
      total: 7,
      hard: false,
      phaseBefore: 'come-out',
      pointBefore: null,
      forced: false,
      net: 0,
    },
    {
      n: 2,
      dice: [3, 3],
      total: 6,
      hard: true,
      phaseBefore: 'point',
      pointBefore: 6,
      forced: false,
      net: 0,
    },
    {
      n: 3,
      dice: [4, 3],
      total: 7,
      hard: false,
      phaseBefore: 'point',
      pointBefore: 6,
      forced: false,
      net: 0,
    },
  ];
  it('classifies rolls', () => {
    expect(rollOutcome(hist[0]!)).toBe('natural');
    expect(rollOutcome(hist[1]!)).toBe('point-made');
    expect(rollOutcome(hist[2]!)).toBe('seven-out');
  });
  it('HistoryStrip is newest first with text totals', () => {
    render(<HistoryStrip history={hist} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.getAttribute('aria-label')).toBe('4 and 3, total 7, seven out');
    expect(items[2]!.getAttribute('aria-label')).toBe('3 and 4, total 7, natural');
  });
  it('StatusBar shows bankroll, session and point', () => {
    render(<StatusBar bankroll={43000} onTable={7000} session={2000} point={6} history={hist} />);
    expect(screen.getByText('$430')).toBeTruthy();
    expect(screen.getByText('+$20')).toBeTruthy();
    expect(screen.getByText('Point: 6')).toBeTruthy();
  });
  it('StatusBar says come-out with no point', () => {
    render(<StatusBar bankroll={1000} onTable={0} session={-500} point={null} history={[]} />);
    expect(screen.getByText('Come-out roll')).toBeTruthy();
    expect(screen.getByText('-$5')).toBeTruthy();
  });
  it('Toasts are a polite live region and dismiss', () => {
    const onDismiss = vi.fn();
    render(
      <Toasts
        toasts={[{ id: 't', text: 'Pass line wins $10', tone: 'win' }]}
        onDismiss={onDismiss}
      />,
    );
    const toasts = document.querySelector('.sim-toasts')!;
    expect(toasts.getAttribute('aria-hidden')).toBeNull();
    expect(toasts.getAttribute('aria-live')).toBeNull();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('t');
  });
  it('Toasts auto-dismiss', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toasts toasts={[{ id: 't', text: 'x' }]} onDismiss={onDismiss} autoDismissMs={2500} />);
    vi.advanceTimersByTime(2600);
    expect(onDismiss).toHaveBeenCalledWith('t');
    vi.useRealTimers();
  });
});

describe('BetSheet', () => {
  it('shows the tier badge text, headline and calls Confirm / Cancel', () => {
    const p = sheet();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Good bet')).toBeTruthy();
    expect(screen.getByText(/house edge 1.41%/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onCancel).toHaveBeenCalledOnce();
  });

  it('Escape cancels', () => {
    const p = sheet();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(p.onCancel).toHaveBeenCalled();
  });

  it.each([
    ['free', 'Free bet'],
    ['good', 'Good bet'],
    ['fair', 'Fair'],
    ['poor', 'Costly'],
    ['avoid', 'Sucker bet'],
  ])('tier %s shows the label %s', (tier, label) => {
    sheet({ preview: preview(tier as EdgeTier) });
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('avoid tier needs a second "Place anyway" tap', () => {
    const p = sheet({ preview: preview('avoid') });
    const btn = screen.getByRole('button', { name: 'Place anyway' });
    fireEvent.click(btn);
    expect(p.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Tap again to place anyway/ }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
  });

  it('poor tier confirms in one tap (suggestion does not block)', () => {
    const p = sheet({ preview: preview('poor') });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
  });

  it('confirmSucker=false makes avoid a single tap', () => {
    const p = sheet({ preview: preview('avoid'), confirmSucker: false });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
  });

  it('an illegal action shows its message and disables Confirm', () => {
    sheet({
      preview: preview('good', {
        validation: { ok: false, code: 'wrong-phase', message: 'No come bets on the come-out.' },
      }),
    });
    expect(screen.getByRole('alert').textContent).toContain('No come bets on the come-out.');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm' }).disabled).toBe(true);
  });

  it('segmented control reports type changes and disables illegal types', () => {
    const p = sheet({
      typeOptions: [
        { id: 'place-4', label: 'Place', enabled: true },
        { id: 'buy-4', label: 'Buy', enabled: true },
        { id: 'lay-4', label: 'Lay', enabled: false },
      ],
      selectedType: 'place-4',
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Buy' }));
    expect(p.onTypeChange).toHaveBeenCalledWith('buy-4');
    expect(screen.getByRole<HTMLButtonElement>('radio', { name: 'Lay' }).disabled).toBe(true);
  });

  it('stepper moves by one chip and quick buttons set the amount', () => {
    const p = sheet({ quickActions: [{ id: 'min', label: 'Min', amount: 500 }] });
    fireEvent.click(screen.getByLabelText('Increase amount'));
    expect(p.onAmountChange).toHaveBeenCalledWith(1500);
    fireEvent.click(screen.getByLabelText('Decrease amount'));
    expect(p.onAmountChange).toHaveBeenCalledWith(500);
    fireEvent.click(screen.getByRole('button', { name: 'Min' }));
    expect(p.onAmountChange).toHaveBeenLastCalledWith(500);
  });

  it('alternative card swaps the action via Use this', () => {
    const alt = {
      action: { type: 'place-bet' as const, betType: 'buy-4' as const, amount: 2000 },
      label: 'Buy the 4',
      edge: preview('good').edge!,
      savingsCents: fr(100),
      message: 'Buy the 4 instead: 1.67% instead of 6.67%.',
    };
    const p = sheet({ preview: preview('poor', { alternative: alt }), onUseAlternative: vi.fn() });
    expect(screen.getByText(/Buy the 4 instead/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    expect(p.onUseAlternative).toHaveBeenCalledWith(alt.action);
  });

  it('Why? expands the outcome rows and formula', () => {
    sheet();
    expect(screen.queryByText('formula here')).toBeNull();
    const why = screen.getByRole('button', { name: 'Why?' });
    expect(why.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(why);
    expect(screen.getByText('7 first')).toBeTruthy();
    expect(screen.getByText(/6 of 11 ways/)).toBeTruthy();
    expect(screen.getByText('formula here')).toBeTruthy();
  });

  it('showEV=false hides the EV block, alternative and Why?', () => {
    sheet({ showEV: false });
    expect(screen.queryByText('Good bet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull();
  });

  const game = createGame({
    point: 6,
    bankroll: 100000,
    bets: [
      { ref: 'p', type: 'pass-line', amount: 1000 },
      { type: 'pass-odds', amount: 3000, parentRef: 'p' },
    ],
  });
  const real = (betType: BetTypeId, amount: number) => {
    const p = previewAction(game, { type: 'place-bet', betType, amount });
    return { preview: p, facts: buildEvFacts(p, game) };
  };
  const lines = (k: string) => document.querySelector(`[data-line="${k}"]`)!;

  it('shows the section 6.1 lines, bold per-hour and note for one-roll bets', () => {
    sheet({ ...real('field', 500), confirmSucker: false });
    expect(lines('edge').textContent).toContain('House edge');
    expect(lines('loss').textContent).toContain('Expected loss on this $5 bet');
    expect(lines('hour').querySelector('strong')).toBeTruthy();
    expect(lines('hour').textContent).toContain('One-roll bet: its edge is paid on every roll');
    expect(lines('chance').textContent).toContain('pays');
    expect(document.querySelector('[data-line="combined"]')).toBeNull();
  });

  it('hard 4 is not marked one-roll and pays 7 to 1', () => {
    sheet({ ...real('hard-4', 500), confirmSucker: false });
    expect(lines('hour').querySelector('strong')).toBeNull();
    expect(lines('chance').textContent).toContain('pays 7 to 1');
  });

  it('shows the combined edge on odds, and "free bet"', () => {
    sheet(real('pass-odds', 3000));
    expect(lines('combined').textContent).toContain('Pass + Odds together:');
    expect(lines('loss').textContent).toContain('$0.00: a free bet');
  });

  it('sucker confirmation still applies when showEV is false', () => {
    const p = sheet({ ...real('hard-4', 500), showEV: false });
    fireEvent.click(screen.getByRole('button', { name: 'Place anyway' }));
    expect(p.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Tap again/ }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
  });

  it('removing a bet that gives up EV needs a second tap', () => {
    const rm = previewAction(game, { type: 'remove-bet', betId: 'b1' });
    const onRemove = vi.fn();
    sheet({ mode: 'manage', onRemove, removePreview: { ...rm, tier: 'avoid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove anyway' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to remove' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('working copy follows the toggle: OFF explains the cost of ON, ON shows the saving', () => {
    const offCopy = 'Off on the come-out by table convention. Turning it ON costs about $0.06.';
    const onCopy = 'Working on the come-out. Turning it OFF saves about $0.06.';
    const { rerender } = render(
      <BetSheet
        {...sheetProps()}
        mode="manage"
        working={{ value: false, canToggle: true, copy: offCopy }}
      />,
    );
    expect(screen.getByText(offCopy)).toBeTruthy();
    rerender(
      <BetSheet
        {...sheetProps()}
        mode="manage"
        working={{ value: true, canToggle: true, copy: onCopy }}
      />,
    );
    expect(screen.queryByText(offCopy)).toBeNull();
    expect(screen.getByText(onCopy)).toBeTruthy();
  });

  it('ChipStack marks an off bet with the text OFF, not colour alone', () => {
    render(
      <svg>
        <ChipStack x={0} y={0} amount={1200} off />
      </svg>,
    );
    expect(screen.getByText('OFF')).toBeTruthy();
  });

  it('manage mode offers Remove and a working toggle', () => {
    const onRemove = vi.fn();
    const onToggleWorking = vi.fn();
    sheet({ mode: 'manage', onRemove, working: { value: true, canToggle: true }, onToggleWorking });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleWorking).toHaveBeenCalledWith(false);
  });
});

describe('DiceGrid', () => {
  it('renders a labelled table, legend and caption', () => {
    const g = Array.from({ length: 36 }, (_, i) =>
      i < 4 ? 'win' : i < 10 ? 'lose' : 'none',
    ) as import('../math/outcomes').RollEffect[];
    render(<DiceGrid grid={g} note="extra" />);
    expect(screen.getByRole('table').getAttribute('aria-label')).toContain('36 dice');
    expect(screen.getAllByRole('cell').filter((c) => c.hasAttribute('data-effect'))).toHaveLength(
      36,
    );
    expect(
      screen.getByText('Wins on 4 of 36, loses on 6 of 36, 26 rolls change nothing'),
    ).toBeTruthy();
    expect(screen.getByText('Win (4)')).toBeTruthy();
    expect(screen.getByText('extra')).toBeTruthy();
    expect(screen.getAllByLabelText(/1 and 1, total 2: wins/)).toHaveLength(1);
  });
});

describe('OddsHint', () => {
  it("lays against a Don't pass and names the room; both buttons call back", () => {
    render(
      <OddsHint
        room={{ betId: 'b', type: 'dont-pass', label: "Don't pass", point: 6, room: 6000 }}
        onDismiss={() => {}}
        onHideForever={() => {}}
      />,
    );
    expect(document.querySelector('[data-testid="odds-hint"]')!.textContent).toContain(
      "Lay up to $60 against your Don't pass on 6",
    );
    cleanup();
  });
  it('states the room and the 0% edge, and both buttons call back', () => {
    const onDismiss = vi.fn();
    const onHideForever = vi.fn();
    render(
      <OddsHint
        room={{ betId: 'b', type: 'pass-line', label: 'Pass line', point: 6, room: 3000 }}
        onDismiss={onDismiss}
        onHideForever={onHideForever}
      />,
    );
    const text = document.querySelector('[data-testid="odds-hint"]')!.textContent;
    expect(text).toContain('Add up to $30 odds behind your Pass line on 6');
    expect(text).toContain('no house edge');
    expect(document.querySelector('[role=status]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    fireEvent.click(screen.getByRole('button', { name: "Don't show again" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onHideForever).toHaveBeenCalledTimes(1);
  });
});
