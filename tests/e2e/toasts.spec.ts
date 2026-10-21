import { expect, test, type Page } from '@playwright/test';

const url = '/#/play?speed=instant&seed=1&dice=3-4,3-3,2-2';

async function place(page: Page) {
  await page.locator('[data-region="pass"]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(sheet).toHaveCount(0);
}

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test.describe('toast overlay', () => {
  for (const vp of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    test(`toast is on screen and moves nothing (${vp.name})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto(url);
      await place(page);
      const targets = ['.sim-roll', '.sim-felt', '.sim-status'];
      await page.getByRole('button', { name: /^Roll/ }).click();
      const toast = page.locator('.sim-toast').first();
      await expect(toast).toContainText('Natural');
      await expect(toast).toBeInViewport({ ratio: 1 });
      const t = (await toast.boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(vp.width);
      expect(t.y + t.height).toBeLessThanOrEqual(vp.height);
      await page.screenshot({ path: `test-results/toast-${vp.name}.png` });
      // same game state with and without the toast: nothing may move or grow
      const withToast = await Promise.all(targets.map((s) => box(page, s)));
      const heightWith = (await page.locator('html').boundingBox())!.height;
      await page.locator('.sim-toast-x').first().click();
      await expect(page.locator('.sim-toast')).toHaveCount(0);
      expect(await Promise.all(targets.map((s) => box(page, s)))).toEqual(withToast);
      expect((await page.locator('html').boundingBox())!.height).toBe(heightWith);
    });
  }

  for (const vp of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
    { name: 'small portrait', width: 360, height: 740 },
  ]) {
    test(`two toasts never cover a betting region (${vp.name})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto(url);
      await place(page);
      const roll = page.getByRole('button', { name: /^Roll/ });
      await roll.click();
      await roll.click();
      await expect(page.locator('.sim-toast')).toHaveCount(2);
      await page.screenshot({ path: `test-results/toasts2-${vp.name}.png` });
      for (const region of ['pass', 'come', 'place-6', 'place-8']) {
        const loc = page.locator(`[data-region="${region}"]`);
        if ((await loc.count()) === 0) continue;
        const b = (await loc.first().boundingBox())!;
        const covered = await loc.first().evaluate(
          (_el: unknown, pt: { x: number; y: number }) =>
            (
              globalThis as unknown as {
                document: {
                  elementFromPoint(x: number, y: number): { closest(s: string): unknown } | null;
                };
              }
            ).document
              .elementFromPoint(pt.x, pt.y)
              ?.closest('.sim-toast') != null,
          { x: b.x + b.width / 2, y: b.y + b.height / 2 },
        );
        expect(covered, `${region} is under a toast`).toBe(false);
      }
    });
  }

  test('swipe or tap dismisses a toast; at most two are shown', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(url);
    await place(page);
    const roll = page.getByRole('button', { name: /^Roll/ });
    await roll.click();
    await roll.click();
    await roll.click();
    await expect(page.locator('.sim-toast')).toHaveCount(2);
    // swipe with a touch pointer
    const toast = page.locator('.sim-toast').last();
    const b = (await toast.boundingBox())!;
    const y = b.y + b.height / 2;
    await toast.dispatchEvent('pointerdown', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: b.x + 20,
      clientY: y,
    });
    await toast.dispatchEvent('pointermove', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      clientX: b.x + 140,
      clientY: y,
    });
    await toast.dispatchEvent('pointerup', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: b.x + 140,
      clientY: y,
    });
    await expect(page.locator('.sim-toast')).toHaveCount(1);
    // a tap on the body dismisses too
    await page
      .locator('.sim-toast')
      .first()
      .tap({ position: { x: 20, y: 8 } });
    await expect(page.locator('.sim-toast')).toHaveCount(0);
    await ctx.close();
  });
});
