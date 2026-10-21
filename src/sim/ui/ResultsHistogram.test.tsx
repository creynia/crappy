import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { ResultsHistogram, bucketResults, captionFor, RESULT_BINS } from './ResultsHistogram';

afterEach(cleanup);

// start $5 (500c). Results: -500 x3 (busted), 0 x1, +200 x2.
const FINALS = Int32Array.from([0, 0, 0, 500, 700, 700]);
const START = 500;

describe('bucketResults', () => {
  it('buckets finals minus start into 15 equal bins over [min, max] incl. 0', () => {
    const { lo, hi, counts } = bucketResults(
      [{ label: 'a', color: '#000', finals: FINALS, busted: 3 }],
      START,
    );
    expect(lo).toBe(-500);
    expect(hi).toBe(200);
    expect(counts).toHaveLength(1);
    const c = counts[0]!;
    expect(c).toHaveLength(RESULT_BINS);
    expect(c.reduce((a, b) => a + b, 0)).toBe(6);
    // width = 700/15 ≈ 46.67: -500 -> bin 0, 0 -> bin 10 (500/46.67 ≈ 10.7), +200 -> bin 14 (last bin)
    expect(c[0]).toBe(3);
    expect(c[10]).toBe(1);
    expect(c[14]).toBe(2);
  });

  it('includes the expected result in the range', () => {
    const { lo, hi } = bucketResults(
      [{ label: 'a', color: '#000', finals: Int32Array.from([100]), busted: 0, expected: -900 }],
      START,
    );
    expect(lo).toBe(-900);
    expect(hi).toBe(0);
  });

  it('caption counts sessions behind start and busts', () => {
    expect(captionFor({ label: 'a', color: '#000', finals: FINALS, busted: 3 }, START)).toBe(
      '3 of 6 sessions ended behind; 3 busted',
    );
  });
});

describe('ResultsHistogram', () => {
  it('renders one bar per bin with the right counts, axis labels and aria summary', () => {
    const { container, getByRole, getAllByText } = render(
      <ResultsHistogram
        series={[{ label: 'Pass line', color: '#2f6fed', finals: FINALS, busted: 3 }]}
        start={START}
      />,
    );
    const bars = container.querySelectorAll('rect[data-bin]');
    expect(bars).toHaveLength(RESULT_BINS);
    expect(container.querySelector('rect[data-bin="0"]')!.getAttribute('data-count')).toBe('3');
    expect(container.querySelector('rect[data-bin="10"]')!.getAttribute('data-count')).toBe('1');
    expect(container.querySelector('rect[data-bin="14"]')!.getAttribute('data-count')).toBe('2');
    expect(container.querySelector('[data-testid="zero-line"]')).not.toBeNull();
    expect(getAllByText('$0').length).toBeGreaterThan(0);
    expect(getAllByText('−$5').length).toBeGreaterThan(0);
    expect(getAllByText('+$2').length).toBeGreaterThan(0);
    const img = getByRole('img');
    expect(img.querySelector('desc')!.textContent).toBe(
      'Pass line: 3 of 6 sessions ended behind; 3 busted',
    );
    expect(container.textContent).toContain('3 of 6 sessions ended behind; 3 busted');
    expect(container.querySelector('.sim-hist-legend')).toBeNull();
  });

  it('compare mode overlays up to three strategies in their colours with a legend', () => {
    const colors = ['#2f6fed', '#d9480f', '#2b8a3e'];
    const { container } = render(
      <ResultsHistogram
        start={START}
        series={[
          { label: 'A', color: colors[0]!, finals: FINALS, busted: 3 },
          { label: 'B', color: colors[1]!, finals: Int32Array.from([400, 400]), busted: 0 },
          {
            label: 'C',
            color: colors[2]!,
            finals: Int32Array.from([0]),
            busted: 1,
            expected: -200,
          },
        ]}
      />,
    );
    expect(container.querySelectorAll('rect[data-bin]')).toHaveLength(RESULT_BINS * 3);
    expect(container.querySelectorAll('rect[data-series="1"][data-bin][fill]')).toHaveLength(
      RESULT_BINS,
    );
    expect(container.querySelector('rect[data-series="2"]')!.getAttribute('fill')).toBe(colors[2]);
    expect(container.querySelectorAll('.sim-hist-legend li')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="expected-marker"]')).toHaveLength(1);
  });
});
