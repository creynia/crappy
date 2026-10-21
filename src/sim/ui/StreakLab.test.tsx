import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exactProbability, scanStreaks } from '../strategy/streaks';
import { StreakLab, conditionText, statText } from './StreakLab';

afterEach(cleanup);

describe('StreakLab', () => {
  it('runs 100,000 rolls and shows sample size, interval and exact chance for each target', async () => {
    const done = vi.fn();
    render(<StreakLab initialSeed={7} onCompleted={done} />);
    fireEvent.click(screen.getByTestId('streak-run'));
    await waitFor(() => expect(screen.getAllByTestId('streak-row')).toHaveLength(3));
    const text = screen.getByTestId('streak-result').textContent;
    expect(text).toContain('after 3 sevens in a row');
    expect(text).toMatch(/\([\d,]+ of [\d,]+\)/); // sample size
    expect(text).toMatch(
      /Observed [\d.]+% \([\d,]+ of [\d,]+\)\. Normal wobble .*: [\d.]+% to [\d.]+%/,
    );
    expect(text).toContain('exact chance is 16.7% (1/6)');
    expect(text).toContain('exact chance is 13.9% (5/36)');
    expect(done).toHaveBeenCalledWith(100_000);
  });

  it('changing the streak changes the question', async () => {
    render(<StreakLab initialSeed={7} />);
    fireEvent.change(screen.getByLabelText('Streak'), { target: { value: 'drought' } });
    fireEvent.click(screen.getByTestId('streak-run'));
    await waitFor(() => screen.getByTestId('streak-result'));
    expect(screen.getByTestId('streak-result').textContent).toContain('without a 6');
  });

  it('texts match the numbers', () => {
    expect(conditionText({ kind: 'sevens', n: 1 })).toBe('after a 7');
    const r = scanStreaks({ seed: 2, rolls: 20_000, condition: { kind: 'sevens', n: 1 } });
    expect(statText(r.stats.seven)).toContain(r.stats.seven.hits.toLocaleString('en-US'));
    expect(
      statText(
        scanStreaks({ seed: 1, rolls: 20, condition: { kind: 'sevens', n: 6 } }).stats.seven,
      ),
    ).toContain('never happened');
    expect(exactProbability('seven').d).toBe(6n);
  });

  it('a rare streak says too few samples instead of a misleading interval', () => {
    const r = scanStreaks({ seed: 1, rolls: 100_000, condition: { kind: 'sevens', n: 6 } });
    const text = statText(r.stats.seven);
    if (r.stats.seven.samples === 0) expect(text).toContain('never happened');
    else expect(text).toContain('too few samples');
    const tiny = scanStreaks({ seed: 1, rolls: 100_000, condition: { kind: 'sevens', n: 5 } });
    expect(tiny.stats.seven.samples).toBeLessThan(30);
    expect(statText(tiny.stats.seven)).toContain('too few samples to tell');
    expect(statText(tiny.stats.seven)).not.toContain('0.0% to 0.0%');
  });

  it('clamps How many on blur, not while typing', () => {
    render(<StreakLab />);
    const input = screen.getByLabelText('How many') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '60' } });
    expect(input.value).toBe('60');
    fireEvent.blur(input);
    expect(input.value).toBe('6');
  });
});
