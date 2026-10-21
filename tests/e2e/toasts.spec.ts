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

  test('swipe sideways dismisses a toast; at most two are shown', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'pointer swipe on the phone project');
    await page.goto(url);
    await place(page);
    const roll = page.getByRole('button', { name: /^Roll/ });
    await roll.click();
    await roll.click();
    await roll.click();
    await expect(page.locator('.sim-toast')).toHaveCount(2);
    const toast = page.locator('.sim-toast').last();
    const b = (await toast.boundingBox())!;
    const y = b.y + b.height / 2;
    await page.mouse.move(b.x + 20, y);
    await page.mouse.down();
    await page.mouse.move(b.x + 120, y, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('.sim-toast')).toHaveCount(1);
  });
});
