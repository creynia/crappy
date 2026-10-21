import { expect, test } from './helpers';

test('app loads with the right title', async ({ page, guard }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('crappy');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await guard.check('initial');
});
