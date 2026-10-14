import { expect, test } from '@playwright/test';

test('PWA works offline after the service worker is installed', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  // Wait until the SW controls the page (clients.claim) so subresources are served from cache.
  await page.waitForFunction('!!navigator.serviceWorker.controller');

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('crappy');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test('manifest and icons are served', async ({ request }) => {
  const m = await request.get('/manifest.webmanifest');
  expect(m.ok()).toBe(true);
  expect(((await m.json()) as { short_name: string }).short_name).toBe('crappy');
  expect((await request.get('/icons/icon-192.png')).ok()).toBe(true);
});
