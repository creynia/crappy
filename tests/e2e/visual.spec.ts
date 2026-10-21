import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Deterministic visual states: fixed seed, speed=instant, reduced motion, transitions off.
// `npm run screenshots` (SCREENSHOTS=1) also rewrites docs/screenshots from the same fixtures.
const LANDSCAPE = { width: 844, height: 390 };
const docs = process.env.SCREENSHOTS === '1';
if (docs) mkdirSync('docs/screenshots', { recursive: true });

async function settle(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.evaluate('document.fonts.ready');
}

async function snap(page: Page, name: string, docName?: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`);
  if (docs && docName) await page.screenshot({ path: `docs/screenshots/${docName}.png` });
}

const play = (q = '') => `/#/play?speed=instant&seed=7${q ? '&' + q : ''}`;

test.describe('visual', () => {
  test('table portrait', async ({ page }) => {
    await page.goto(play());
    await expect(page.locator('[data-region="pass"]')).toBeVisible();
    await snap(page, 'table-portrait', 'table-portrait');
  });

  test('table landscape', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto(play());
    await expect(page.locator('[data-region="pass"]')).toBeVisible();
    await snap(page, 'table-landscape', 'table-landscape');
  });

  test('table dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(play());
    await expect(page.locator('[data-region="pass"]')).toBeVisible();
    await snap(page, 'table-dark');
  });

  for (const [name, region, center, docName] of [
    ['sheet-good', 'pass', false, 'table-sheet-good'],
    ['sheet-avoid', 'any-7', true, 'table-sheet-avoid'],
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(play());
      if (center) await page.getByRole('button', { name: 'Center' }).click();
      await page.locator(`[data-region="${region}"]`).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await snap(page, name, docName);
    });
  }

  test('sheet with Why? dice grid', async ({ page }) => {
    await page.goto(play());
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('button', { name: 'Why?' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snap(page, 'sheet-why');
  });

  test('center tab', async ({ page }) => {
    await page.goto(play());
    await page.getByRole('button', { name: 'Center' }).click();
    await expect(page.locator('[data-region="any-7"]')).toBeVisible();
    await snap(page, 'center', 'table-center');
  });

  test('auto-roll chart', async ({ page }) => {
    await page.goto(play());
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
    await snap(page, 'autoroll-chart', 'app-autoroll-chart');
  });

  test('lesson scene', async ({ page }) => {
    await page.goto('/#/learn/pass-line');
    const scene = page.locator('section.scene').first();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.getByTestId('simulator')).toBeVisible();
    await snap(page, 'lesson-scene', 'app-lesson-scene');
  });
});
