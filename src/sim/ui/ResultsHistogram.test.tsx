import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ResultsHistogram,
  binIndex,
  binLayout,
  bucketResults,
  captionFor,
  RESULT_BINS,
} from './ResultsHistogram';

afterEach(cleanup);

// start $5 (500c). Results: -500 x3 (busted), 0 x1, +200 x2.
const FINALS = Int32Array.from([0, 0, 0, 500, 700, 700]);
const START = 500;

describe('binLayout and binIndex', () => {
  it('puts 0 on a bin edge, so no bin mixes losers and winners', () => {
    const l = binLayout(-500, 200);
    expect(l.zeroBin * l.width + l.lo).toBeCloseTo(0);
    expect(l.lo).toBeCloseTo(-550);
    expect(l.hi).toBeCloseTo(200);
  });

  it('treats a value exactly on an edge as the start of the bin to its right', () => {
    const l = { width: 50, zeroBin: 11 };
    expect(binIndex(-450, l)).toBe(2); // left edge of [-450, -400)
    expect(binIndex(-451, l)).toBe(1);
    expect(binIndex(-1, l)).toBe(10); // just below 0 is a loss bin
    expect(binIndex(0, l)).toBe(11); // 0 starts the first winning bin
    expect(binIndex(49, l)).toBe(11);
    expect(binIndex(50, l)).toBe(12);
  });

  it('keeps a value at the top edge in the last bin', () => {
    expect(binIndex(200, { width: 50, zeroBin: 11 })).toBe(RESULT_BINS - 1);
  });

  it('negative-only results fill the loss side and leave no winning bins', () => {
    const l = binLayout(-500, 0);
    expect(l.zeroBin).toBe(RESULT_BINS);
    expect(l.hi).toBe(0);
    expect(binIndex(-500, l)).toBe(0);
    expect(binIndex(-1, l)).toBe(RESULT_BINS - 1);
  });

  it('min = max at the start uses $1 bins centred on 0 without a degenerate range', () => {
    const l = binLayout(0, 0);
    expect(l.hi - l.lo).toBe(1500);
    expect(binIndex(0, l)).toBe(l.zeroBin);
  });
});

describe('bucketResults', () => {
  it('buckets finals minus start into 15 bins with 0 as an edge', () => {
    const { lo, hi, zeroBin, counts } = bucketResults(
      [{ label: 'a', color: '#000', finals: FINALS, busted: 3 }],
      START,
    );
    expect(lo).toBeCloseTo(-550);
    expect(hi).toBeCloseTo(200);
    expect(zeroBin).toBe(11);
    expect(counts).toHaveLength(1);
    const c = counts[0]!;
    expect(c).toHaveLength(RESULT_BINS);
    expect(c.reduce((a, b) => a + b, 0)).toBe(6);
    // width 50: -500 -> bin 1, 0 -> bin 11, +200 -> bin 14 (last bin)
    expect(c[1]).toBe(3);
    expect(c[11]).toBe(1);
    expect(c[14]).toBe(2);
  });

  it('includes the expected result in the range', () => {
    const { lo, hi } = bucketResults(
      [{ label: 'a', color: '#000', finals: Int32Array.from([100]), busted: 0, expected: -900 }],
      START,
    );
    expect(lo).toBeLessThanOrEqual(-900);
    expect(hi).toBeGreaterThanOrEqual(0);
  });

  it('caption counts sessions behind start and busts', () => {
    expect(captionFor({ label: 'a', color: '#000', finals: FINALS, busted: 3 }, START)).toBe(
      '3 of 6 sessions ended behind; 3 busted',
    );
  });
});

describe('ResultsHistogram', () => {
  it('renders one bar per bin with the right counts, labels and linked caption', () => {
    const { container, getByRole, getAllByText, queryAllByText } = render(
      <ResultsHistogram
        series={[
          {
            label: 'Martingale',
            color: '#2f6fed',
            finals: FINALS,
            busted: 3,
            expected: -2273,
          },
        ]}
        start={START}
      />,
    );
    const bars = container.querySelectorAll('rect[data-bin]');
    expect(bars).toHaveLength(RESULT_BINS);
    // expected -2273 widens the range: 14 loss bins of $200 (zero at bin 14), so -500 is bin 11
    // and 0 and +200 share bin 14.
    expect(container.querySelector('rect[data-bin="11"]')!.getAttribute('data-count')).toBe('3');
    expect(container.querySelector('rect[data-bin="14"]')!.getAttribute('data-count')).toBe('3');
    expect(container.querySelector('rect[data-bin="1"]')!.getAttribute('data-count')).toBe('0');
    expect(container.querySelector('[data-testid="zero-line"]')).not.toBeNull();
    // $0 is hidden here: it sits one bin from the +$200 end label and would collide with it
    expect(container.querySelectorAll('text').length).toBeGreaterThan(0);
    expect(queryAllByText('$0')).toHaveLength(0);
    expect(getAllByText('−$28').length).toBeGreaterThan(0);
    expect(getAllByText('+$2').length).toBeGreaterThan(0);
    const img = getByRole('img');
    const caption = container.querySelector(`#${img.getAttribute('aria-describedby')}`);
    expect(caption!.textContent).toContain('Solid line: break-even.');
    expect(caption!.textContent).toContain('Dashed: expected result −$22.73 (Martingale).');
    expect(caption!.textContent).toContain('3 of 6 sessions ended behind; 3 busted');
    expect(container.querySelector('.sim-hist-legend')).toBeNull();
  });

  it('compare mode overlays up to three strategies, distinct by fill, with a left-to-right legend', () => {
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
    const b = container.querySelector('rect[data-series="1"]')!;
    expect(b.getAttribute('fill')).toBe('none');
    expect(b.getAttribute('stroke')).toBe(colors[1]);
    expect(container.querySelector('rect[data-series="2"]')!.getAttribute('fill')).toMatch(
      /^url\(#.+-h2\)$/,
    );
    expect(container.querySelector('rect[data-series="0"]')!.getAttribute('fill')).toBe(colors[0]);
    expect(container.querySelector('.sim-hist-legend')!.textContent).toContain(
      'Bars in each bin, left to right: A, B, C.',
    );
    expect(container.querySelectorAll('.sim-hist-legend li')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="expected-marker"]')).toHaveLength(1);
    const caption = container.querySelector('p[id$="-c"]')!;
    expect(caption.textContent).toContain('Dashed: expected result −$2 (C).');
    expect(caption.textContent).toContain('B: 2 of 2 sessions ended behind; 0 busted');
  });
});
