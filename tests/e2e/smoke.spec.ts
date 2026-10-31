import { expect, test } from './helpers';

test('app loads with the right title', async ({ page, guard }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/^Learn Craps Free: .* \| crappy$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await guard.check('initial');
});
