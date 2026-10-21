import { expect, test, type Locator, type Page } from '@playwright/test';

/** Screen centre of a chip stack's bottom chip (its shadow ellipse sits right under it). */
async function stackCentre(stack: Locator) {
  const box = await stack.locator('.sim-stack > ellipse').first().boundingBox();
  if (!box) throw new Error('stack not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function confirm(page: Page) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^(Confirm|Place anyway)/ }).click();
  await expect(sheet).toHaveCount(0);
}

// The project's own viewport, plus the widths the review checked (run once, under desktop).
const VIEWPORTS = [
  null,
  { width: 360, height: 740 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(vp ? `${vp.width}x${vp.height}` : 'project viewport', () => {
    if (vp) test.use({ viewport: vp });
    // extra viewports run once, under the desktop project
    test.skip(({ isMobile }) => vp !== null && isMobile, 'extra viewports run once');
    for (const c of [
      { name: '$5 come, default odds', raise: 0, maxOdds: false, odds: null },
      { name: '$20 come, $100 odds', raise: 3, maxOdds: true, odds: '$100' },
    ]) {
      test(`come odds sit offset on the come bet (${c.name}): a tap on each stack opens that bet`, async ({
        page,
      }) => {
        await page.goto('/#/play?speed=instant&seed=1&dice=3-3,4-4');
        await page.locator('[data-region="pass"]').click();
        await confirm(page);
        await page.getByRole('button', { name: /^Roll/ }).click(); // point 6
        await page.locator('[data-region="come"]').click();
        const sheet = page.getByRole('dialog');
        for (let i = 0; i < c.raise; i++)
          await sheet.getByRole('button', { name: 'Increase amount' }).click(); // $5 chip steps
        await confirm(page);
        await page.getByRole('button', { name: /^Roll/ }).click(); // come travels to 8
        await page.locator('[data-region="box-8"]').click();
        await sheet.getByRole('radio', { name: 'Come odds', exact: true }).click();
        if (c.maxOdds) await sheet.getByRole('button', { name: 'Max odds' }).click();
        await confirm(page);

        const come = page.locator('[data-stack][aria-label^="Edit Come bet on 8"]');
        const odds = page.locator('[data-stack][aria-label^="Edit Come Odds bet on 8" i]');
        await expect(come).toHaveCount(1);
        await expect(odds).toHaveCount(1);
        if (c.odds) await expect(odds.locator('.sim-stack-badge')).toHaveText(c.odds);
        // both amount badges are visible (not hidden under the other stack)
        for (const s of [come, odds]) await expect(s.locator('.sim-stack-badge')).toBeVisible();

        const cc = await stackCentre(come);
        await page.mouse.click(cc.x, cc.y);
        await expect(sheet.getByRole('heading').first()).not.toContainText(/odds/i);
        await expect(sheet.getByRole('heading').first()).toContainText(/come/i);
        await sheet.getByRole('button', { name: 'Cancel' }).click();
        await expect(sheet).toHaveCount(0);

        const o = await stackCentre(odds);
        await page.mouse.click(o.x, o.y);
        await expect(sheet.getByRole('heading').first()).toContainText(/odds/i);
      });
    }
  });
}
