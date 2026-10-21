import { expect, test, type Page } from './helpers';

// Phone widths the guard covers: 360, 390, 412 portrait and 844x390 landscape. Runs in the `mobile`
// project only; each test loops the widths so the e2e count stays small.
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 844, height: 390 },
];
const at = ({ width, height }: { width: number; height: number }) => `${width}x${height}`;

/** Fresh document for each state, so an open sheet or panel from the last state does not carry over. */
async function open(page: Page, url: string) {
  await page.goto('about:blank');
  await page.goto(url);
}

test.describe('overflow and console guard at phone widths', () => {
  test('sandbox table, pass-line sheet and Why? panel', async ({ page, guard }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await open(page, '/#/play?speed=instant&seed=1&dice=3-4');
      await guard.check(`table @${at(vp)}`);
      await page.locator('[data-region="pass"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await guard.check(`bet sheet @${at(vp)}`);
      await page.getByRole('button', { name: 'Why?' }).click();
      await guard.check(`Why? panel @${at(vp)}`);
    }
  });

  test('sandbox center view and a center prop sheet', async ({ page, guard }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await open(page, '/#/play?speed=instant');
      await page.getByRole('button', { name: 'Center' }).click();
      await guard.check(`center table @${at(vp)}`);
      await page.locator('[data-region="any-7"]').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await guard.check(`center prop sheet @${at(vp)}`);
    }
  });

  test('auto-roll 100 and a strategy compare run', async ({ page, guard }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await open(page, '/#/play?speed=fast');
      const tab = page.getByRole('button', { name: 'Auto-roll', exact: true });
      if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
      const panel = page.locator('.sim-auto');
      await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
      await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
      await guard.check(`auto-roll done @${at(vp)}`);

      await open(page, '/#/learn/strategy-fun-per-dollar');
      const scene = page.locator('section.scene').nth(0);
      await scene.scrollIntoViewIfNeeded();
      await scene.getByRole('button', { name: /^Auto-roll 100/ }).click();
      await expect(scene.getByTestId('auto-roll-summary')).toBeVisible({ timeout: 15_000 });
      await guard.check(`strategy compare done @${at(vp)}`);
    }
  });

  test('lesson scene (pass line) and the dice-and-combinations lesson', async ({ page, guard }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await open(page, '/#/learn/pass-line');
      await expect(page.locator('section.scene').first()).toBeVisible();
      await guard.check(`lesson scene @${at(vp)}`);
      await open(page, '/#/learn/dice-and-combinations');
      await expect(page.locator('section.scene').first()).toBeVisible();
      await guard.check(`dice lesson @${at(vp)}`);
    }
  });

  test('top-level routes, including two bet details', async ({ page, guard }) => {
    const routes = [
      '/',
      '/learn',
      '/practice',
      '/bets',
      '/bets/pass-line',
      '/bets/place-6',
      '/glossary',
      '/settings',
      '/more',
    ];
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      for (const route of routes) {
        await open(page, `/#${route}`);
        await guard.check(`${route} @${at(vp)}`);
      }
    }
  });
});
