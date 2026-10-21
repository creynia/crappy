import { render } from 'preact';
import { describe, expect, it } from 'vitest';
import { validateScene } from '../scene';
import { calloutBox, placeCallouts, wrapText } from './Callouts';
import {
  centerLayout,
  craplessLandscapeLayout,
  craplessPortraitLayout,
  landscapeLayout,
  portraitLayout,
} from './layouts';
import { BET_TYPES_WITHOUT_REGION, REGION_IDS } from './layouts/types';
import { regionIdForBet } from './layouts';
import { BET_TYPE_IDS } from '../engine/bets';
import { Table } from './Table';

const LAYOUTS = [portraitLayout, landscapeLayout, centerLayout];
const LONG =
  'Bet with the shooter here: it wins on 7 or 11 and loses on 2, 3 or 12, then rides the point.';

describe('callout geometry', () => {
  it('REGION_IDS lists exactly the regions of the layouts (crapless felts included)', () => {
    const ids = new Set(
      [...LAYOUTS, craplessPortraitLayout, craplessLandscapeLayout].flatMap((l) =>
        l.regions.map((r) => r.id),
      ),
    );
    expect([...ids].sort()).toEqual([...REGION_IDS].sort());
  });
  it.each(LAYOUTS.map((l) => [l.id, l] as const))(
    '%s: every bubble stays inside the viewBox, above or below, short or long',
    (_, l) => {
      for (const r of l.regions)
        for (const placement of ['above', 'below'] as const)
          for (const text of ['Here.', LONG]) {
            const g = calloutBox(r.rect, l.viewBox, text, placement);
            const b = g.box;
            expect(b.x, r.id).toBeGreaterThanOrEqual(0);
            expect(b.y, r.id).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w, r.id).toBeLessThanOrEqual(l.viewBox.w);
            expect(b.y + b.h, r.id).toBeLessThanOrEqual(l.viewBox.h);
            // every line fits the bubble width (approximate glyph width 0.56em)
            for (const line of g.lines)
              expect(line.length * g.fontSize * 0.56).toBeLessThanOrEqual(b.w);
          }
    },
  );
  it('prefers the asked side and flips when there is no room', () => {
    const pass = portraitLayout.regions.find((r) => r.id === 'pass')!;
    const above = calloutBox(pass.rect, portraitLayout.viewBox, 'Here.', 'above');
    expect(above.box.y + above.box.h).toBeLessThanOrEqual(pass.rect.y);
    // nothing below the pass line: 'below' flips above
    const flipped = calloutBox(pass.rect, portraitLayout.viewBox, 'Here.', 'below');
    expect(flipped.box.y + flipped.box.h).toBeLessThanOrEqual(pass.rect.y);
    const box4 = portraitLayout.regions.find((r) => r.id === 'box-4')!;
    const below = calloutBox(box4.rect, portraitLayout.viewBox, 'Here.', 'below');
    expect(below.box.y).toBeGreaterThanOrEqual(box4.rect.y + box4.rect.h);
  });
  it('every bet type has a callout region except the listed ones (which validation rejects)', () => {
    for (const t of [...BET_TYPE_IDS])
      expect(regionIdForBet(t, null) === null, t).toBe(BET_TYPES_WITHOUT_REGION.includes(t));
    const r = validateScene({
      id: 's',
      version: 1,
      callouts: [{ target: { betType: 'come-odds' }, text: 'x' }],
    });
    expect(r.ok ? [] : r.errors).toEqual([
      'callouts[0].target.betType: come-odds has no fixed table region; target a number box instead, e.g. "box-6"',
    ]);
  });
  it('wraps words without splitting them', () => {
    expect(wrapText('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });
  it('resolves bet-type targets and drops targets the layout lacks', () => {
    const placed = placeCallouts(
      [
        { target: { betType: 'place-6' }, text: 'a' },
        { target: 'any-7', text: 'b' },
      ],
      portraitLayout,
      't',
    );
    expect(placed.map((c) => c.regionId)).toEqual(['box-6']);
  });
});

describe('callouts in the Table', () => {
  it('draws the bubble and describes the region with its text', () => {
    const el = document.createElement('div');
    render(
      <Table
        layout={portraitLayout}
        bets={[]}
        point={null}
        callouts={[{ target: 'field', text: 'One roll only.' }]}
      />,
      el,
    );
    const field = el.querySelector('[data-region="field"]')!;
    const id = field.getAttribute('aria-describedby')!;
    expect(id).toBeTruthy();
    expect(el.querySelector(`[id="${id}"]`)!.textContent).toBe('One roll only.');
    expect(el.querySelector('[data-region="pass"]')!.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('scene validation of callouts', () => {
  const base = { id: 's', version: 1, bankroll: 50_000 };
  it('accepts region and bet-type targets, rejects unknown ones', () => {
    expect(
      validateScene({
        ...base,
        callouts: [
          { target: 'pass', text: 'Here.' },
          { target: { betType: 'hard-8' }, text: 'There.', placement: 'below' },
        ],
      }).ok,
    ).toBe(true);
    const bad = validateScene({
      ...base,
      callouts: [
        { target: 'box-7', text: 'x' },
        { target: 'pass', text: '', placement: 'left' },
      ],
    });
    expect(bad.ok ? [] : bad.errors).toEqual([
      'callouts[0].target: unknown table region "box-7"',
      'callouts[1].text: must be a non-empty string',
      'callouts[1].placement: must be "above" or "below"',
    ]);
    const step = validateScene({
      ...base,
      steps: [
        {
          id: 'a',
          text: 't',
          completeWhen: { rolls: 1 },
          callouts: [{ target: { betType: 'nope' }, text: 'x' }],
        },
      ],
    });
    expect(step.ok).toBe(false);
  });
});
