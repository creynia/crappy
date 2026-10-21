import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { Simulator } from '../index';
import type { SceneConfig, SimulatorEvent } from '../index';
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
