import { expect, test, type Page } from '@playwright/test';

const url = (q = '') => `/#/play?speed=instant${q ? '&' + q : ''}`;

async function bankroll(page: Page): Promise<number> {
  const t = await page.locator('.sim-status-money b').first().innerText();
  return Number(t.replace(/[^0-9.-]/g, ''));
}

test.describe('sandbox', () => {
  test('pass line: EV sheet, confirm, roll changes the bankroll', async ({ page }) => {
    await page.goto(url('seed=1&dice=3-4'));
    await page.locator('[data-region="pass"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('house edge 1.41%');
    await expect(sheet).toContainText('Good bet');
    await sheet.getByRole('button', { name: 'Confirm' }).click();
    await expect(sheet).toHaveCount(0);
    const before = await bankroll(page);
    expect(before).toBe(495);
    await page.getByRole('button', { name: /^Roll/ }).click(); // 7 on come-out: natural, pass wins
    await expect.poll(() => bankroll(page)).toBe(500);
    await expect(page.locator('.sim-toast').first()).toContainText('Natural');
  });

  test('hard 4 shows -$1.11 and is not a one-roll bet', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="hard-4"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel('Bet amount')).toHaveText('$5');
    await sheet.getByRole('button', { name: 'Increase amount' }).click(); // $5 chip: $5 -> $10
    await expect(sheet.getByLabel('Bet amount')).toHaveText('$10');
    await expect(sheet.locator('.sim-headline')).toContainText('-$1.11');
    await expect(sheet.locator('[data-line="loss"]')).toContainText('$1.11');
    await expect(sheet).toContainText('Sucker bet');
    await expect(sheet.locator('.sim-oneroll')).toHaveCount(0);
  });

  test('center prop needs Place anyway', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="any-7"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Sucker bet');
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await expect(sheet.getByRole('button', { name: /again to place anyway/i })).toBeVisible();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.sim-center-ind')).toContainText('Center bets');
  });

  test('hop bet: pick a hard hop in the 21-pair picker, win 30 to 1', async ({ page }) => {
    await page.goto(url('seed=1&dice=3-3'));
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="hop"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('.sim-hop-cell')).toHaveCount(21);
    await expect(sheet).toContainText('11.11%'); // starts on the 2-4 easy hop
    await sheet.locator('[data-hop="3-3"]').click();
    await expect(sheet.locator('[data-hop="3-3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet).toContainText('13.89%');
    const amount = Number(
      (await sheet.getByLabel('Bet amount').innerText()).replace(/[^0-9.]/g, ''),
    );
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit Hop 3-3 bet/ })).toBeVisible();
    const before = await bankroll(page);
    await page.getByRole('button', { name: /^Roll/ }).click();
    await expect.poll(() => bankroll(page)).toBe(before + amount * 31);
  });

  test('auto-roll 100 rolls in fast mode renders the chart', async ({ page }) => {
    await page.goto('/#/play?speed=fast');
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
  });

  test('sandbox state persists across reload', async ({ page }) => {
    await page.goto(url());
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await page.goto('/');
    await page.goto(url());
    await expect(page.locator('.sim-status-money')).toContainText('On table $5');
  });
});
