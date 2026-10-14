import { expect, test } from '@playwright/test';

test('settings: dark theme applies', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('bets reference lists all 42 bet types', async ({ page }) => {
  await page.goto('/#/bets');
  await expect(page.locator('a[href^="#/bets/"]')).toHaveCount(42);
});
