import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Simulator, challengeScene } from '../index';
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

describe('challenge scene panel (I030)', () => {
  it('has no Restart while the challenge runs and is labelled Challenge', () => {
    render(<Simulator scene={challengeScene({ seed: 1, rolls: 3 })} initialSettings={instant} />);
    expect(screen.getByRole('region', { name: 'Challenge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
  });
  it('a lesson scene still offers Restart under the default label', () => {
    const lesson: SceneConfig = {
      id: 'l',
      version: 1,
      steps: [{ id: 's', text: 'Roll once.', completeWhen: { rolls: 1 } }],
    };
    render(<Simulator scene={lesson} initialSettings={instant} />);
    expect(screen.getByRole('region', { name: 'Lesson step' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy();
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

describe('demo steps', () => {
  const scene: SceneConfig = {
    id: 'demo',
    version: 1,
    bankroll: 50_000,
    phase: 'point',
    point: 6,
    bets: [{ type: 'pass-line', amount: 1000 }],
    steps: [
      {
        id: 'watch',
        text: 'Watch the dealer',
        completeWhen: { acknowledged: true },
        play: [
          { action: { type: 'place-bet', betType: 'come', amount: 1000 }, say: 'A Come bet' },
          { action: { type: 'roll', dice: [5, 4] } },
          { action: { type: 'place-bet', betType: 'come', amount: 1000 } },
          { action: { type: 'roll', dice: [3, 6] } },
        ],
      },
    ],
  };
  const confirmed = (events: SimulatorEvent[]) =>
    events.filter((e) => e.type === 'action-confirmed').length;

  it('at instant speed plays every scripted action as soon as the step starts', async () => {
    const events: SimulatorEvent[] = [];
    render(<Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />);
    await waitFor(() => expect(confirmed(events)).toBe(4));
    expect(events.filter((e) => e.type === 'rolled')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Replay the demo' })).toBeTruthy();
  });

  it('Replay restores the starting state and plays the same script again', async () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator scene={scene} initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    await waitFor(() => expect(confirmed(events)).toBe(4));
    const finalText = container.querySelector('.sim-status-money')!.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Replay the demo' }));
    await waitFor(() => expect(confirmed(events)).toBe(8));
    expect(container.querySelector('.sim-status-money')!.textContent).toBe(finalText);
  });

  const narrated: SceneConfig = {
    ...scene,
    steps: [
      {
        ...scene.steps![0]!,
        play: [
          { action: { type: 'place-bet', betType: 'come', amount: 1000 }, say: 'First line' },
          { action: { type: 'roll', dice: [5, 4] }, say: 'Second line' },
          { action: { type: 'place-bet', betType: 'come', amount: 1000 }, say: 'Third line' },
          { action: { type: 'roll', dice: [3, 6] }, say: 'Fourth line' },
        ],
      },
    ],
  };

  it('shows every caption in the step panel and announces the narration once, even at instant speed', async () => {
    const { container } = render(<Simulator scene={narrated} initialSettings={instant} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay the demo' })).toBeTruthy(),
    );
    const list = screen.getByRole('list', { name: 'What happens in the demo' });
    expect(Array.from(list.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'First line',
      'Second line',
      'Third line',
      'Fourth line',
    ]);
    const live = container.querySelector('[data-testid="roll-announcer"]')!.textContent;
    expect(live).toContain('First line');
    expect(live).toContain('Fourth line');
  });

  it('scripted rolls stay out of the roll log, and a replay does not duplicate anything', async () => {
    const events: SimulatorEvent[] = [];
    render(
      <Simulator scene={narrated} initialSettings={instant} onEvent={(e) => events.push(e)} />,
    );
    await waitFor(() => expect(confirmed(events)).toBe(4));
    fireEvent.click(screen.getByRole('button', { name: 'Replay the demo' }));
    await waitFor(() => expect(confirmed(events)).toBe(8));
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByText(/No rolls yet/)).toBeTruthy();
  });

  it('a tap while the last roll is still animating skips that animation and ends the demo', async () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator
        scene={{
          ...scene,
          steps: [
            { ...scene.steps![0]!, play: [{ action: { type: 'roll', dice: [5, 4] }, pauseMs: 0 }] },
          ],
        }}
        initialSettings={{ speed: 'normal' }}
        onEvent={(e) => events.push(e)}
      />,
    );
    await waitFor(() => expect(confirmed(events)).toBe(1)); // every frame is out; the roll animates
    expect(screen.queryByRole('button', { name: 'Replay the demo' })).toBeNull();
    fireEvent.click(container.querySelector('[data-testid="simulator"]')!);
    expect(screen.queryByRole('button', { name: 'Replay the demo' })).not.toBeNull();
  });

  it('a refused scripted action stops the demo', async () => {
    const events: SimulatorEvent[] = [];
    render(
      <Simulator
        scene={{
          ...scene,
          steps: [
            {
              ...scene.steps![0]!,
              play: [
                { action: { type: 'place-bet', betType: 'pass-line', amount: 1000 } }, // not legal on a point
                { action: { type: 'roll', dice: [5, 4] } },
              ],
            },
          ],
        }}
        initialSettings={instant}
        onEvent={(e) => events.push(e)}
      />,
    );
    await waitFor(() => expect(events.some((e) => e.type === 'action-rejected')).toBe(true));
    expect(events.filter((e) => e.type === 'rolled')).toHaveLength(0);
  });

  it('a tap skips to the end state while a slower demo is playing', async () => {
    const events: SimulatorEvent[] = [];
    const { container } = render(
      <Simulator
        scene={scene}
        initialSettings={{ speed: 'normal' }}
        onEvent={(e) => events.push(e)}
      />,
    );
    await waitFor(() => expect(confirmed(events)).toBeGreaterThanOrEqual(1));
    expect(confirmed(events)).toBeLessThan(4); // paused between frames
    fireEvent.click(container.querySelector('[data-testid="simulator"]')!);
    expect(confirmed(events)).toBe(4);
    expect(screen.queryByRole('button', { name: 'Replay the demo' })).not.toBeNull();
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

describe('win prompt (I039)', () => {
  const scene: SceneConfig = {
    id: 'wp',
    version: 1,
    bankroll: 50000,
    phase: 'point',
    point: 4,
    bets: [{ type: 'place-6', amount: 1200 }],
    ui: { winPrompt: true },
    forcedDice: [
      [3, 3],
      [1, 2],
      [3, 3],
    ],
  };
  const press = async (container: Element) => {
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    return waitFor(() => {
      const p = container.querySelector('[data-testid="win-prompt"]');
      expect(p).not.toBeNull();
      return p!;
    });
  };

  it('a place-6 win offers four choices with per-roll costs; Press makes it $24 and costs $12', async () => {
    const { container } = render(<Simulator scene={scene} initialSettings={instant} />);
    const prompt = await press(container);
    const choices = [...prompt.querySelectorAll('[data-choice]')].map((b) =>
      b.getAttribute('data-choice'),
    );
    expect(choices).toEqual(['press', 'same', 'regress', 'take-down']);
    const label = (id: string) =>
      prompt.querySelector(`[data-choice="${id}"]`)!.getAttribute('aria-label')!;
    expect(label('press')).toContain('+$12 to $24');
    expect(label('press')).toContain('+$0.06/roll');
    expect(label('regress')).toContain('-$0.03/roll');
    expect(label('take-down')).toContain('-$0.06/roll');
    expect(label('same')).toContain('no change');
    // the visible cell is compact: a short name and the short delta
    expect(prompt.querySelector('[data-choice="press"]')!.textContent).toBe('Press+$0.06');
    const pressBtn = prompt.querySelector('[data-choice="press"]')!;
    const bankBefore = container.textContent.match(/Bankroll \$([\d,]+)/)![1];
    fireEvent.click(pressBtn);
    await waitFor(() => expect(container.querySelector('[data-testid="win-prompt"]')).toBeNull());
    expect(container.textContent).toContain('On table $24');
    expect(container.textContent.match(/Bankroll \$([\d,]+)/)![1]).toBe(
      String(Number(bankBefore!.replace(/,/g, '')) - 12),
    );
  });

  it('announces the choices with the roll and replaces the win toast while it is up', async () => {
    const { container } = render(<Simulator scene={scene} initialSettings={instant} />);
    await press(container);
    const live = container.querySelector('[data-testid="roll-announcer"]')!;
    await waitFor(() => expect(live.textContent).toContain('What now?'));
    expect(live.textContent).toContain('Rolled');
    expect(live.textContent).toContain('Press, +$12 to $24');
    expect((container.querySelector('.sim-toasts') as HTMLElement).hidden).toBe(true);
  });

  it('is dismissed by the next roll, and "Same bet" changes nothing', async () => {
    const { container } = render(<Simulator scene={scene} initialSettings={instant} />);
    const prompt = await press(container);
    fireEvent.click(prompt.querySelector('[data-choice="same"]')!);
    expect(container.querySelector('[data-testid="win-prompt"]')).toBeNull();
    expect(container.textContent).toContain('On table $12');
    // a miss rolls, then another hit asks again; rolling in between dismisses
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() => expect(container.textContent).toContain('Rolled'));
    expect(container.querySelector('[data-testid="win-prompt"]')).toBeNull();
  });

  it('is off in a scene unless ui.winPrompt is true', async () => {
    const off: SceneConfig = { ...scene, ui: {} };
    const { container } = render(<Simulator scene={off} initialSettings={instant} />);
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() => expect(container.textContent).toContain('Rolled'));
    expect(container.querySelector('[data-testid="win-prompt"]')).toBeNull();
  });

  it('"Always same bet" stops the prompt and is remembered', async () => {
    const { container } = render(<Simulator scene={scene} initialSettings={instant} />);
    const prompt = await press(container);
    fireEvent.click(screen.getByRole('button', { name: /^Always same bet/ }));
    expect(container.querySelector('[data-testid="win-prompt"]')).toBeNull();
    expect(prompt.isConnected).toBe(false);
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

  it('Tab from the revealed heading stays inside the sheet, and Escape works after tabbing out', () => {
    openSandbox();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    const dialog = screen.getByRole('dialog');
    const heading = dialog.querySelector<HTMLElement>('.sim-session-panel h3')!;
    heading.tabIndex = -1;
    heading.focus();
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('role')).not.toBe('dialog');
    // focus that escaped (e.g. a mouse click on the table) is pulled back on the next Tab
    const roll = screen.getByRole('button', { name: /^Roll/ });
    roll.focus();
    fireEvent.keyDown(roll, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    roll.focus();
    fireEvent.keyDown(roll, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tabs use roving tabindex and arrow keys', () => {
    openSandbox();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    const session = screen.getByRole('tab', { name: 'Session' });
    const log = screen.getByRole('tab', { name: 'Log' });
    expect(session.getAttribute('tabindex')).toBe('0');
    expect(log.getAttribute('tabindex')).toBe('-1');
    expect(session.getAttribute('aria-controls')).toBe(
      screen.getByRole('tabpanel').getAttribute('id'),
    );
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Log' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('dialog').querySelector('.sim-roll-log')).not.toBeNull();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Table panels');
  });

  it('arrow keys keep focus on the tab strip: switching a panel does not move focus', () => {
    openSandbox();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    const session = screen.getByRole('tab', { name: 'Session' });
    session.focus();
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('role')).toBe('tab');
    expect(document.activeElement?.textContent).toBe('Log');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('role')).toBe('tab');
    expect(document.activeElement?.textContent).toBe('Menu');
    expect(screen.getByRole('dialog').querySelector('.sim-menu')).not.toBeNull();
  });

  it('a bet sheet opened over the panel owns Escape and Tab', () => {
    const { container } = openSandbox();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    fireEvent.click(container.querySelector('[data-region="pass"]')!);
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);
    const bet = dialogs.find((d) => d.textContent?.includes('house edge'))!;
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(bet.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(confirm, { key: 'Escape' });
    // the bet sheet closed; the panel sheet is still open
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog').querySelector('.sim-session-panel')).not.toBeNull();
  });

  it('a short drag on the handle is not a tap: the sheet stays', () => {
    // happy-dom reports landscape by default; the handle only exists on the portrait sheet
    const mm = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) =>
        ({
          matches: false,
          media: q,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    try {
      openSandbox();
    } finally {
      mm.mockRestore();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    const handle = screen.getByRole('button', { name: /Close panel \(drag/ });
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 120, pointerId: 1 });
    fireEvent.click(handle);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.click(handle); // a plain tap closes
    expect(screen.queryByRole('dialog')).toBeNull();
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

describe('share link RNG position across Reset and reload (I071 review)', () => {
  const shared: string[] = [];
  beforeEach(() => {
    shared.length = 0;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t: string) => Promise.resolve(void shared.push(t)) },
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    localStorage.clear();
  });
  const share = async () => {
    // the Menu tab toggles: open the menu only when it is closed
    if (!screen.queryByRole('button', { name: 'Share table' }))
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share table' }));
    await waitFor(() => expect(shared.length).toBeGreaterThan(0));
    return shared[shared.length - 1]!;
  };
  const skipOf = (url: string) => new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('skip');
  const seedOf = (url: string) => new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('seed');

  it('Reset bankroll starts a fresh seed with nothing drawn: no stale skip', async () => {
    location.hash = '#/play?seed=7&skip=5';
    render(<Simulator mode="sandbox" initialSettings={instant} />);
    const first = await share();
    expect(seedOf(first)).toBe('7');
    expect(skipOf(first)).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'Reset bankroll' }));
    const after = await share();
    expect(seedOf(after)).not.toBe('7');
    expect(skipOf(after)).toBeNull();
    location.hash = '';
  });

  it('a reload restores the saved sandbox with its draw count', async () => {
    location.hash = '#/play?seed=7&skip=5';
    const key = 'crappy:test-sandbox';
    const first = render(<Simulator mode="sandbox" persistKey={key} initialSettings={instant} />);
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() => expect(screen.getByTestId('roll-announcer').textContent).not.toBe(''));
    expect(skipOf(await share())).toBe('6');
    first.unmount();
    // the next visit has no link params: the saved table comes back, one roll in
    location.hash = '#/play';
    await waitFor(() => expect(localStorage.length).toBeGreaterThan(0));
    render(<Simulator mode="sandbox" persistKey={key} initialSettings={instant} />);
    expect(skipOf(await share())).toBe('6');
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    await waitFor(() => expect(skipOf(shared[shared.length - 1]!)).toBe('6'));
    expect(skipOf(await share())).toBe('7');
    location.hash = '';
  });
});
