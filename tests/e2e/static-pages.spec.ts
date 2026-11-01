import { expect, test } from '@playwright/test';

test('static lesson page is served as itself, even once the service worker controls the app', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  await page.waitForFunction('!!navigator.serviceWorker.controller');

  await page.goto('/learn/pass-line/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Pass Line');
  await expect(page.locator('#app')).toHaveCount(0);
  await expect(page).toHaveTitle('The Pass Line | Learn Craps | crappy');

  // The CTA opens the lesson in the app (relative hash link).
  await page.getByRole('link', { name: /Open this lesson in crappy/ }).click();
  await expect(page).toHaveURL(/\/#\/learn\/pass-line$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Pass Line');
  await expect(page.locator('#app')).toHaveCount(1);

  // Offline, a static page is never answered with the app shell.
  await context.setOffline(true);
  await page.goto('/learn/odds-bet/').catch(() => null);
  await expect(page.locator('#app')).toHaveCount(0);
  await context.setOffline(false);
});

test('course index, bets and glossary pages exist', async ({ page }) => {
  for (const [path, h1] of [
    ['/learn/', 'How to play craps: the free course'],
    ['/bets/', 'Craps odds chart: payout, true odds and house edge of every bet'],
    ['/best-and-worst-bets/', 'The best and worst bets in craps, ranked by house edge'],
    ['/odds-bet-house-edge/', 'Craps odds bet explained: the house edge at 1x to 100x odds'],
    ['/dice-probability/', 'Craps dice probability: the odds of rolling every total'],
    ['/bets/pass-line/', 'Pass Line'],
    ['/glossary/', 'Craps glossary'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    const width = Number(await page.evaluate('document.documentElement.scrollWidth'));
    expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
