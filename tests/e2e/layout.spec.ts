import { expect, test, type Locator, type Page } from '@playwright/test';
import { test as guardTest } from './helpers';

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

// Immersive landscape play: the app header and tab bar give way to a menu handle (I063).
guardTest.describe('immersive landscape play', () => {
  guardTest.skip(
    ({ viewport }) => !viewport || viewport.width < viewport.height || viewport.height > 520,
    'short landscape only',
  );

  guardTest('the felt gets the height and the nav stays reachable', async ({ page, guard }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    const felt = page.locator('.sim-table-wrap');
    await expect(felt).toBeVisible();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.tabbar')).toBeHidden();
    const box = (await felt.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(330);
    // nothing sticks out sideways or needs vertical scrolling, and the handle clears the table
    await guard.check('immersive-play');
    const handle = page.locator('.immersive-menu');
    const hb = (await handle.boundingBox())!;
    expect(hb.x).toBeGreaterThanOrEqual(0);
    expect(hb.x + hb.width).toBeLessThanOrEqual(box.x + 0.5);
    expect(await page.evaluate('document.documentElement.scrollHeight')).toBeLessThanOrEqual(390);
    // the nav opens from the handle and works
    await handle.click();
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    const learn = page.locator('#immersive-nav').getByRole('link', { name: 'Learn' });
    await expect(learn).toBeVisible();
    await learn.click();
    await expect(page).toHaveURL(/#\/learn/);
    await expect(page.locator('.topbar')).toBeVisible(); // other pages keep the header
  });

  guardTest('Escape closes the menu', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    await page.locator('.immersive-menu').click();
    await expect(page.locator('#immersive-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#immersive-nav')).toBeHidden();
  });

  guardTest('Escape returns focus to the handle', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    await page.locator('.immersive-menu').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.immersive-menu')).toBeFocused();
  });

  guardTest(
    'an outside tap closes the menu without pressing what is underneath',
    async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto('/#/play?speed=instant&seed=7');
      await page.locator('.immersive-menu').click();
      await expect(page.locator('#immersive-nav')).toBeVisible();
      // tap the PASS LINE area: the menu closes and no bet sheet opens
      await page.mouse.click(400, 370);
      await expect(page.locator('#immersive-nav')).toBeHidden();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    },
  );

  guardTest('tap targets stay at least 44px on the slim rail', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    for (const sel of ['.sim-rail .sim-tab', '.sim-rail .sim-chipbtn:not([disabled])']) {
      for (const el of await page.locator(sel).all()) {
        const b = (await el.boundingBox())!;
        expect(b.height, sel).toBeGreaterThanOrEqual(43.5);
        expect(b.width, sel).toBeGreaterThanOrEqual(43.5);
      }
    }
    // the challenge link is in the Pages menu, not above the table
    await expect(page.locator('.play-challenge-link')).toBeHidden();
    await page.locator('.immersive-menu').click();
    await expect(
      page.locator('#immersive-nav').getByRole('link', { name: 'Challenge' }),
    ).toBeVisible();
  });

  guardTest('a tap at the felt edge reaches Big 6, not the Pages handle', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    const region = page.locator('[data-region="big-6"]');
    const box = (await region.boundingBox())!;
    const handle = (await page.locator('.immersive-menu').boundingBox())!;
    expect(handle.x + handle.width).toBeLessThanOrEqual(box.x + 0.5); // the 44px target never overlaps the felt
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Big 6 is a red-tier bet: the sheet asks twice
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: /^(Confirm|Place anyway)/ }).click();
    if (await sheet.isVisible())
      await sheet.getByRole('button', { name: /again to place anyway|^Place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('[data-stack]')).toHaveCount(1); // the bet landed
    await expect(page.locator('#immersive-nav')).toBeHidden();
  });

  for (const [w, h] of [
    [844, 390],
    [667, 375],
    [568, 320],
  ] as const) {
    guardTest(
      `${w}x${h}: the page never scrolls, even after a bet and with a toast`,
      async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/#/play?speed=instant&seed=7');
        const fits = async (state: string) =>
          expect(
            await page.evaluate('document.documentElement.scrollHeight - innerHeight'),
            state,
          ).toBeLessThanOrEqual(0);
        await fits('fresh table');
        await page.locator('[data-region="pass"]').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
        await fits('after a bet');
        await page.getByRole('button', { name: /^Roll/ }).click();
        await expect(page.locator('.sim-toast').first()).toBeVisible();
        await fits('with a toast showing');
      },
    );
  }
});
