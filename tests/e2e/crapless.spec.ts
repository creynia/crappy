import { expect, test } from '@playwright/test';

test.describe('crapless craps', () => {
  test("Rules menu switches to the crapless table: 2/3/11/12 boxes, no don't side", async ({
    page,
  }) => {
    await page.goto('/#/play?speed=instant');
    await expect(page.locator('[data-region="box-2"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByLabel('Rules').selectOption('crapless');
    for (const n of [2, 3, 11, 12])
      await expect(page.locator(`[data-region="box-${n}"]`)).toBeVisible();
    await expect(page.locator('[data-region="dont-pass"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.locator('[data-region="dont-come"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('[data-region="dont-pass"]').click({ force: true }); // dimmed (aria-disabled) but tappable
    await expect(page.locator('.sim-toast').first()).toContainText("no don't side");
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('[data-region="pass"]').click();
    await expect(page.getByRole('dialog')).toContainText('5.38%');
  });

  test('place the pass line, a forced 2 sets the point to 2', async ({ page }) => {
    await page.goto('/#/play?speed=instant&rules=crapless&dice=1-1');
    await page.locator('[data-region="pass"]').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Confirm' }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: /^Roll/ }).click();
    await expect(page.locator('.sim-status')).toContainText('Point: 2');
    await expect(page.locator('.sim-status-money')).toContainText('On table $5');
    await page.locator('[data-region="box-2"]').click();
    await expect(page.getByRole('dialog')).toContainText('Place 2');
  });
});
