import { expect, test } from '@playwright/test';

test('practice: open the hub and finish a 10-item line-calls round', async ({ page }) => {
  await page.goto('/#/more');
  await page.getByRole('link', { name: /Practice/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
  await page.getByRole('link', { name: /Line calls/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Line calls' })).toBeVisible();

  // Answer each question with the first choice; misses are re-asked, so the round may run
  // longer than 10, but it always ends.
  const summary = page.locator('.pr-summary');
  for (let i = 0; i < 40 && !(await summary.isVisible()); i++) {
    await page.locator('.pr-choice').first().click();
    await expect(page.locator('.pr-feedback')).toBeVisible();
    await page.getByRole('button', { name: /^(Next|See results)$/ }).click();
  }
  await expect(summary.getByRole('heading', { name: /Round complete: \d+ of 10/ })).toBeVisible();

  // Progress persists: the hub shows the best score after a reload.
  await page.goto('/#/practice');
  await page.reload();
  await expect(page.getByRole('link', { name: /Line calls/ })).toContainText(/Best \d+\/10/);
});

test('practice: an EV quiz round runs to the summary', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByRole('link', { name: /EV quiz/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'EV quiz' })).toBeVisible();
  await expect(page.locator('.pr-choice').first()).toContainText(/%|\$/);
  const summary = page.locator('.pr-summary');
  for (let i = 0; i < 40 && !(await summary.isVisible()); i++) {
    await page.locator('.pr-choice').first().click();
    await expect(page.locator('.pr-feedback')).toBeVisible();
    await page.getByRole('button', { name: /^(Next|See results)$/ }).click();
  }
  await expect(summary.getByRole('heading', { name: /Round complete: \d+ of 10/ })).toBeVisible();
});
