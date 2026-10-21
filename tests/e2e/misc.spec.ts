import { expect, test } from '@playwright/test';
import { BET_TYPE_IDS } from '../../src/sim/engine';

test('settings: dark theme applies', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('bets reference lists every bet type in the registry', async ({ page }) => {
  await page.goto('/#/bets');
  await expect(page.locator('a[href^="#/bets/"]')).toHaveCount(BET_TYPE_IDS.length);
});
