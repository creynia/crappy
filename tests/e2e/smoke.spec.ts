import { expect, test } from '@playwright/test';

test('app loads with the right title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('crappy');
  await expect(page.getByRole('heading', { name: 'crappy' })).toBeVisible();
});
