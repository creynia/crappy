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

test('bets reference: hop has its own page with both hop edges', async ({ page }) => {
  await page.goto('/#/bets');
  await page.locator('a[href="#/bets/hop"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hop');
  const facts = page.locator('dl.facts');
  await expect(facts).toContainText('15 to 1');
  await expect(facts).toContainText('30 to 1');
  await expect(facts).toContainText('easy 11.11%, hard 13.89%');
  await expect(page.locator('.page')).toContainText('2 of 36 rolls, and pays 15:1');
  await expect(page.getByRole('link', { name: /^Lesson:/ })).toBeVisible();
});
