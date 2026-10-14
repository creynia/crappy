import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

test('single-file build opens from file:// with no failed requests', async ({ page }) => {
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(pathToFileURL(path.resolve('dist-single/crappy.html')).href);
  await expect(page).toHaveTitle('crappy');
  await expect(page.locator('h1, main').first()).toBeVisible();
  expect(failed).toEqual([]);
});
