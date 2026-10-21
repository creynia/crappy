import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { Simulator } from '../index';
import type { SceneConfig, SimulatorEvent } from '../index';
import { askFeedback } from './StepPanel';
import { buildEvFacts } from './text';
import { createGame, previewAction } from '../index';

afterEach(() => {
  document.body.innerHTML = '';
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const instant = { speed: 'instant' as const };

describe('Simulator sandbox', () => {
  it('opens the EV sheet for the pass line and places a bet', () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    fireEvent.click(container.querySelector('[data-region="pass"]')!);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('house edge 1.41%');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(events.some((e) => e.type === 'action-confirmed')).toBe(true);
    expect(container.textContent).toContain('On table $5');
  });

  it('rolls and reports', async () => {
    const events: SimulatorEvent[] = [];
    render(<Simulator initialSettings={instant} onEvent={(e) => events.push(e)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() => expect(events.some((e) => e.type === 'rolled')).toBe(true));
  });

  it('shows the real preview number for a $10 hard 4 (not one-roll)', () => {
    const g = createGame({});
    const p = previewAction(g, { type: 'place-bet', betType: 'hard-4', amount: 1000 });
    expect(p.headline).toContain('-$1.11');
    const facts = buildEvFacts(p, g);
    expect(facts?.oneRoll).toBe(false);
    expect(facts?.expectedLossCents).toBeCloseTo(111.1, 0);
  });

  it('pass line chance reads 244 in 495', () => {
    const g = createGame({});
    const p = previewAction(g, { type: 'place-bet', betType: 'pass-line', amount: 500 });
    expect(buildEvFacts(p, g)?.chance).toContain('244 in 495');
  });
});

describe('Simulator guided scene', () => {
  const scene: SceneConfig = {
    id: 't',
    version: 1,
    bankroll: 20000,
    phase: 'come-out',
    forcedDice: [[4, 4]],
    allowedBets: ['pass-line'],
    showEV: false,
    steps: [
      {
        id: 'peek',
        text: 'Tap the **Pass Line**.',
        completeWhen: { previewed: 'pass-line' },
      },
      { id: 'look', text: 'Look.', completeWhen: { acknowledged: true } },
    ],
  };

  it('fires previewed even when showEV is false, then completes via Next', () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    expect(container.querySelector('.sim-step-text')?.textContent).toContain('Pass Line');
    fireEvent.click(container.querySelector('[data-region="pass"]')!);
    expect(events.some((e) => e.type === 'step-completed' && e.stepId === 'peek')).toBe(true);
    expect(screen.getByRole('dialog').textContent).not.toContain('house edge');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(events.some((e) => e.type === 'scene-completed')).toBe(true);
  });
});

describe('auto-roll compare scene', () => {
  const scene: SceneConfig = {
    id: 'cmp',
    version: 1,
    bankroll: 100000,
    allowedBets: [],
    autoRoll: {
      enabled: true,
      compareMode: true,
      compare: [
        { id: 'iron-cross', unit: 500 },
        { id: 'pass-max-odds', unit: 1000, oddsMultiple: 0 },
        { id: 'field-every-roll', unit: 500 },
      ],
      rollOptions: [10],
      sessions: [1],
    },
    steps: [
      { id: 'run', text: 'Run them.', completeWhen: { autoRollCompleted: { minRolls: 10 } } },
    ],
  };

  it('runs every compared strategy on one seed and completes only with all of them', async () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    await waitFor(() => expect(container.querySelector('.sim-autoroll')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Auto-roll 10/ }));
    await waitFor(() =>
      expect(container.querySelector('[data-testid="auto-roll-summary"]')).not.toBeNull(),
    );
    const heads = container.querySelectorAll('[data-testid="auto-roll-summary"] thead th');
    expect(heads).toHaveLength(4); // label + 3 strategies
    await waitFor(() => expect(events.some((e) => e.type === 'scene-completed')).toBe(true));
  });
});

describe('auto-roll sweep scene', () => {
  const scene: SceneConfig = {
    id: 'sw',
    version: 1,
    bankroll: 100000,
    allowedBets: [],
    autoRoll: {
      enabled: true,
      sweep: { strategy: 'pass-max-odds', oddsMultiples: [0, 2] },
    },
    steps: [{ id: 'run', text: 'Run it.', completeWhen: { autoRollCompleted: { minRolls: 100 } } }],
  };
  it('shows the sweep panel and completes the step when it finishes', async () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="sweep-panel"]')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('sweep-run'));
    await waitFor(() => expect(events.some((e) => e.type === 'scene-completed')).toBe(true), {
      timeout: 15_000,
    });
    expect(container.querySelectorAll('[data-testid="sweep-row"]')).toHaveLength(2);
  });
});

describe('Simulator roll announcements', () => {
  const scene: SceneConfig = {
    id: 'r',
    version: 1,
    bankroll: 50000,
    forcedDice: [
      [5, 6],
      [5, 6],
    ],
  };
  const live = (c: Element) =>
    c.querySelector('[data-testid="roll-announcer"]')!.textContent.trim();

  it('announces the roll in one sentence, again for an identical roll, from one live region', async () => {
    const { container } = render(
      <Simulator scene={scene} initialSettings={instant} onEvent={() => {}} />,
    );
    expect(container.querySelectorAll('[aria-live],[role=status],[role=alert]').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() =>
      expect(live(container)).toBe('Rolled 5 and 6, 11, yo. Bankroll $500. Point is off.'),
    );
    const first = container.querySelector('[data-testid="roll-announcer"] span');
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() =>
      expect(container.querySelector('[data-testid="roll-announcer"] span')).not.toBe(first),
    );
    expect(live(container)).toBe('Rolled 5 and 6, 11, yo. Bankroll $500. Point is off.');
    expect(container.querySelectorAll('[aria-live],[role=status],[role=alert]').length).toBe(1);
  });
});

describe('ask step announcer', () => {
  const scene: SceneConfig = {
    id: 'ask',
    version: 1,
    bankroll: 10000,
    allowedActions: ['roll'],
    forcedDice: [[3, 4]],
    steps: [
      {
        id: 'q',
        text: 'Call it.',
        ask: { q: 'What?', options: ['a', 'b'], answer: 1, explain: 'because' },
        completeWhen: { all: [{ answered: 'correct' }, { rolls: 1 }] },
      },
      { id: 'end', text: 'End.', completeWhen: { acknowledged: true } },
    ],
  };
  it('speaks the feedback through the single announcer and names the pick', async () => {
    const events: SimulatorEvent[] = [];
    render(<Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'a' }));
    const announcer = screen.getByTestId('roll-announcer');
    await waitFor(() => expect(announcer.textContent).toBe(askFeedback(scene.steps![0]!.ask!, 0)));
    expect(announcer.textContent).toContain('You chose "a"');
    expect(announcer.textContent).toContain('Not quite.');
    fireEvent.click(screen.getByRole('button', { name: 'b' }));
    await waitFor(() => expect(announcer.textContent).toBe(askFeedback(scene.steps![0]!.ask!, 1)));
    expect(announcer.textContent).toContain('Now roll to check your call.');
    expect(events.filter((e) => e.type === 'step-answered')).toHaveLength(2);
    // focus moved on to the unlocked Roll button
    await waitFor(() => expect(document.activeElement?.classList.contains('sim-roll')).toBe(true));
  });
});

describe('sandbox panel sheet (I064)', () => {
  const openSandbox = () => render(<Simulator mode="sandbox" initialSettings={instant} />);

  it('shows one panel at a time in a dialog with tabs', () => {
    const { container } = openSandbox();
    expect(container.querySelector('[data-testid="panel-sheet"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.sim-session-panel')).not.toBeNull();
    expect(dialog.querySelector('.sim-menu')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Menu' }));
    expect(screen.getByRole('dialog').querySelector('.sim-menu')).not.toBeNull();
    expect(screen.getByRole('dialog').querySelector('.sim-session-panel')).toBeNull();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    // the tab row reflects the single open panel
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Session' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('Escape closes the sheet and hands focus back to the tab that opened it', () => {
    openSandbox();
    const tab = screen.getByRole('button', { name: 'Session' });
    tab.focus();
    fireEvent.click(tab);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(tab);
  });

  it('traps Tab inside the sheet and keeps the dice reachable', () => {
    openSandbox();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const last = focusable[focusable.length - 1]!;
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);
    expect(screen.getByRole('button', { name: 'Throw the dice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
