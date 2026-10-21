import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Deterministic visual states: fixed seed, speed=instant, reduced motion, transitions off.
// With SCREENSHOTS=1 (`npm run screenshots`) the spec only rewrites docs/screenshots at 2x and
// skips the pixel comparison, so it never leaves baselines behind.
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

/** Compare against the baseline (VISUAL=1) or write the docs image (SCREENSHOTS=1). */
async function snap(page: Page, name: string, docName?: string, target?: Locator) {
  await settle(page);
  if (docs) {
    // Element captures scroll the page, so the fixed tab bar would be drawn across them.
    if (target) await page.addStyleTag({ content: '.tabbar{display:none!important}' });
    if (docName) await (target ?? page).screenshot({ path: `docs/screenshots/${docName}.png` });
    return;
  }
  await expect(target ?? page).toHaveScreenshot(`${name}.png`);
}

// seed=7 only fixes the random rolls; `dice=` forces specific rolls where a state needs a point.
const play = (q = '') => `/#/play?speed=instant&seed=7${q ? '&' + q : ''}`;
const pass = (page: Page) => page.locator('[data-region="pass"]');

async function openPassOdds(page: Page) {
  await page.goto(play('dice=3-3'));
  await pass(page).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('button', { name: /^Roll/ }).click(); // 6: the point
  await page.locator('[data-stack]').first().click();
  await page.getByRole('button', { name: 'Add odds' }).click();
  await expect(page.getByRole('dialog')).toContainText('Free bet');
}

test.describe('visual', () => {
  test('table portrait', async ({ page }) => {
    await page.goto(play());
    await expect(pass(page)).toBeVisible();
    await snap(page, 'table-portrait', 'table-portrait');
  });

  test('table landscape', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto(play());
    await expect(pass(page)).toBeVisible();
    await snap(page, 'table-landscape', 'table-landscape');
  });

  test('table dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(play());
    await expect(pass(page)).toBeVisible();
    await snap(page, 'table-dark');
  });

  // The old docs shot of the good-tier sheet was landscape; the others are portrait.
  for (const [name, region, center, docName, landscape] of [
    ['sheet-good', 'pass', false, 'table-sheet-good', true],
    ['sheet-good-portrait', 'pass', false, undefined, false],
    ['sheet-avoid', 'any-7', true, 'table-sheet-avoid', false],
  ] as const) {
    test(name, async ({ page }) => {
      if (landscape) await page.setViewportSize(LANDSCAPE);
      await page.goto(play());
      if (center) await page.getByRole('button', { name: 'Center' }).click();
      await page.locator(`[data-region="${region}"]`).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await snap(page, name, docName);
    });
  }

  test('sheet free-odds tier', async ({ page }) => {
    await openPassOdds(page);
    await snap(page, 'sheet-free', 'table-sheet-free');
  });

  test('sheet free-odds tier landscape', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await openPassOdds(page);
    await snap(page, 'sheet-free-landscape');
  });

  test('sheet with the Why? dice grid', async ({ page }) => {
    await page.goto(play());
    await pass(page).click();
    await page.getByRole('button', { name: 'Why?' }).click();
    const grid = page.locator('.sim-dicegrid');
    if ((await grid.count()) > 0) await grid.scrollIntoViewIfNeeded();
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
    const chart = panel.getByRole('img').first();
    await expect(chart).toBeVisible({ timeout: 15_000 });
    await chart.scrollIntoViewIfNeeded();
    await snap(page, 'autoroll-chart', 'app-autoroll-chart', panel);
  });

  test('lesson scene', async ({ page }) => {
    await page.goto('/#/learn/pass-line');
    const scene = page.locator('section.scene').first();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.getByTestId('simulator')).toBeVisible();
    await snap(page, 'lesson-scene', 'app-lesson-scene', scene);
  });

  test('lesson scene landscape', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto('/#/learn/pass-line');
    const scene = page.locator('section.scene').first();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.getByTestId('simulator')).toBeVisible();
    await snap(page, 'lesson-scene-landscape');
  });
});
