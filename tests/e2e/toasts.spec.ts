import { expect, test, type Locator, type Page } from '@playwright/test';

const url = '/#/play?speed=instant&seed=1&dice=3-4,3-3,2-2';

/** The odds nudge (a one-time sticky message) would take the toast's place; these tests are about toasts, so it is pre-dismissed. */
async function hideNudge(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('crappy-sim-hide-odds-hint', '1');
    } catch {
      /* no storage: the nudge stays hidden for this page */
    }
  });
}

async function place(page: Page) {
  await page.locator('[data-region="pass"]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(sheet).toHaveCount(0);
}

/** True when a toast sits on top of any point of a 5x5 grid across the element. */
async function anyUnderToast(loc: Locator): Promise<boolean> {
  const b = (await loc.boundingBox())!;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      pts.push({ x: b.x + 2 + ((b.width - 4) * i) / 4, y: b.y + 2 + ((b.height - 4) * j) / 4 });
  return loc.evaluate(
    (_el: unknown, ps: { x: number; y: number }[]) =>
      ps.some(
        (pt) =>
          (
            globalThis as unknown as {
              document: {
                elementFromPoint(x: number, y: number): { closest(s: string): unknown } | null;
              };
            }
          ).document
            .elementFromPoint(pt.x, pt.y)
            ?.closest('.sim-toast') != null,
      ),
    pts,
  );
}

/** True when a toast sits on top of the centre of the element. */
async function underToast(loc: Locator): Promise<boolean> {
  const b = (await loc.boundingBox())!;
  return loc.evaluate(
    (_el: unknown, pt: { x: number; y: number }) =>
      (
        globalThis as unknown as {
          document: {
            elementFromPoint(x: number, y: number): { closest(s: string): unknown } | null;
          };
        }
      ).document
        .elementFromPoint(pt.x, pt.y)
        ?.closest('.sim-toast') != null,
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
}

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test.describe('toast overlay', () => {
  test.beforeEach(async ({ page }) => {
    await hideNudge(page);
  });
  for (const vp of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    test(`toast is on screen and moves nothing (${vp.name})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto(url);
      await place(page);
      const targets = ['.sim-roll', '.sim-felt', '.sim-status'];
      await page.getByRole('button', { name: /^Roll/ }).click();
      const toast = page.locator('.sim-toast').first();
      await expect(toast).toContainText('Natural');
      await expect(toast).toBeInViewport({ ratio: 0.9 });
      const t = (await toast.boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(vp.width);
      expect(t.y + t.height).toBeLessThanOrEqual(vp.height);
      await page.screenshot({ path: `test-results/toast-${vp.name}.png` });
      // same game state with and without the toast: nothing may move or grow
      const withToast = await Promise.all(targets.map((s) => box(page, s)));
      const heightWith = (await page.locator('html').boundingBox())!.height;
      await page.locator('.sim-toast-x').first().click();
      await expect(page.locator('.sim-toast')).toHaveCount(0);
      expect(await Promise.all(targets.map((s) => box(page, s)))).toEqual(withToast);
      expect((await page.locator('html').boundingBox())!.height).toBe(heightWith);
    });
  }

  for (const vp of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
    { name: 'small portrait', width: 360, height: 740 },
  ]) {
    test(`two toasts never cover a betting region (${vp.name})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto(url);
      await place(page);
      const roll = page.getByRole('button', { name: /^Roll/ });
      await roll.click();
      await roll.click();
      await expect(page.locator('.sim-toast')).toHaveCount(2);
      await page.screenshot({ path: `test-results/toasts2-${vp.name}.png` });
      for (const region of ['pass', 'come', 'box-6', 'box-8']) {
        const loc = page.locator(`[data-region="${region}"]`);
        await expect(loc.first(), `${region} exists`).toBeVisible();
        expect(await underToast(loc.first()), `${region} is under a toast`).toBe(false);
      }
      expect(await underToast(roll), 'Roll is under a toast').toBe(false);
    });
  }

  for (const vp of [
    { name: 'landscape phone', width: 844, height: 390 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`in a lesson, toasts never cover the step card, Restart or the table (${vp.name})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto('/#/learn/pass-line');
      const scene = page.locator('section.scene').first();
      await scene.scrollIntoViewIfNeeded();
      await scene.getByRole('radio', { name: '$10 chip' }).click();
      await scene.locator('[data-region="pass"]').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
      const roll = scene.getByRole('button', { name: /^Roll/ });
      await roll.click();
      await roll.click();
      await expect(scene.locator('.sim-toast')).toHaveCount(2);
      const targets = [
        scene.locator('.sim-step-text'),
        scene.getByRole('button', { name: 'Restart' }),
        scene.locator('[data-region="pass"]'),
        scene.locator('[data-region="box-6"]'),
        scene.locator('[data-region="box-8"]'),
        roll,
      ];
      for (const t of targets) {
        if ((await t.count()) === 0) continue;
        expect(
          await underToast(t.first()),
          `${await t
            .first()
            .innerText()
            .catch(() => '')} covered`,
        ).toBe(false);
      }
      await scene.screenshot({ path: `test-results/lesson-toasts-${vp.name}.png` });
    });
  }

  for (const vp of [
    { name: 'landscape phone', width: 844, height: 390 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`a long multi-bet seven-out toast never touches Roll (${vp.name})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto('/#/play?speed=instant&seed=1&dice=3-3,3-4,2-2');
      await place(page);
      const roll = page.getByRole('button', { name: /^Roll/ });
      await roll.click(); // 3-3: point 6
      for (const region of ['field', 'box-8', 'box-5', 'box-9']) {
        await page.locator(`[data-region="${region}"]`).click();
        const sheet = page.getByRole('dialog');
        const fix = sheet.getByRole('button', { name: /^Fix to/ });
        if (await fix.count()) await fix.click();
        await sheet.getByRole('button', { name: 'Confirm' }).click();
        await expect(sheet).toHaveCount(0);
      }
      await roll.click(); // 3-4: seven-out takes pass, field... and the numbers
      await expect(page.locator('.sim-toast').first()).toBeVisible();
      await page.screenshot({ path: `test-results/toast-sevenout-${vp.name}.png` });
      expect(await anyUnderToast(roll), 'part of Roll is under a toast').toBe(false);
    });
  }

  test('swipe or tap dismisses a toast; at most two are shown', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await hideNudge(page);
    await page.goto(url);
    await place(page);
    const roll = page.getByRole('button', { name: /^Roll/ });
    await roll.click();
    await roll.click();
    await roll.click();
    await expect(page.locator('.sim-toast')).toHaveCount(2);
    // swipe with a touch pointer
    const toast = page.locator('.sim-toast').last();
    const b = (await toast.boundingBox())!;
    const y = b.y + b.height / 2;
    await toast.dispatchEvent('pointerdown', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: b.x + 20,
      clientY: y,
    });
    await toast.dispatchEvent('pointermove', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      clientX: b.x + 140,
      clientY: y,
    });
    await toast.dispatchEvent('pointerup', {
      pointerId: 7,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: b.x + 140,
      clientY: y,
    });
    await expect(page.locator('.sim-toast')).toHaveCount(1);
    // a tap on the body dismisses too
    await page
      .locator('.sim-toast')
      .first()
      .tap({ position: { x: 20, y: 8 } });
    await expect(page.locator('.sim-toast')).toHaveCount(0);
    await ctx.close();
  });
});
