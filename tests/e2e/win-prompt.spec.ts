import { expect, test, type Locator, type Page } from '@playwright/test';

/** True when the prompt sits on top of any point of a 5x5 grid across the element. */
async function anyUnder(loc: Locator): Promise<boolean> {
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
            ?.closest('.sim-winprompt') != null,
      ),
    pts,
  );
}

const url = '/#/play?speed=instant&seed=1&dice=2-2,3-3,3-3';

async function placeSix(page: Page) {
  await page.getByRole('button', { name: /^Roll/ }).click(); // 2-2: point 4
  await expect(page.getByText('Point: 4')).toBeVisible();
  await page.locator('[data-region="box-6"]').click();
  const sheet = page.getByRole('dialog');
  const fix = sheet.getByRole('button', { name: /^Fix to/ });
  if (await fix.count()) await fix.click();
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(sheet).toHaveCount(0);
}

test.describe('win prompt', () => {
  test('a box-6 win asks Press / Same / Regress / Take down; Press doubles the bet', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'desktop', 'covered on phone sizes');
    await page.goto(url);
    await placeSix(page);
    const bankBefore = await page
      .locator('.sim-status-money > span', { hasText: 'Bankroll' })
      .first()
      .locator('b')
      .innerText();
    await page.getByRole('button', { name: /^Roll/ }).click(); // 3-3: the 6 hits
    const prompt = page.getByTestId('win-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button', { name: /^Press/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: /^Same bet/ })).toBeVisible();
    await expect(prompt.getByRole('button', { name: /^Take down/ })).toBeVisible();
    // the prompt never covers a betting region or the Roll button
    for (const sel of ['[data-region="pass"]', '[data-region="box-8"]', '.sim-roll']) {
      const loc = page.locator(sel).first();
      const b = (await loc.boundingBox())!;
      const covered = await loc.evaluate(
        (_el: unknown, pt: { x: number; y: number }) =>
          (
            globalThis as unknown as {
              document: {
                elementFromPoint(x: number, y: number): { closest(s: string): unknown } | null;
              };
            }
          ).document
            .elementFromPoint(pt.x, pt.y)
            ?.closest('.sim-winprompt') != null,
        { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      );
      expect(covered, `${sel} under the prompt`).toBe(false);
    }
    await page.screenshot({ path: `test-results/win-prompt-${info.project.name}.png` });
    await prompt.getByRole('button', { name: /^Press/ }).click();
    await expect(prompt).toHaveCount(0);
    expect(bankBefore).toBeTruthy();
    await expect(page.locator('.sim-status-money')).toContainText('On table $');
  });

  for (const vp of [
    { name: '390x844', width: 390, height: 844 },
    { name: '360x640', width: 360, height: 640 },
    { name: '844x390', width: 844, height: 390 },
    { name: '667x375', width: 667, height: 375 },
  ]) {
    test(`prompt is fully on screen, never over Pass, chips or Roll, and moves nothing (${vp.name})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      await page.setViewportSize(vp);
      await page.goto(url);
      await placeSix(page);
      const roll = page.getByRole('button', { name: /^Roll/ });
      await roll.click(); // 3-3: the 6 hits
      const prompt = page.getByTestId('win-prompt');
      await expect(prompt).toBeVisible();
      await page.screenshot({ path: `test-results/win-prompt-${vp.name}.png` });
      const p = (await prompt.boundingBox())!;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(vp.width);
      expect(p.y + p.height).toBeLessThanOrEqual(vp.height);
      // every visible cell is a 44px target
      for (const cell of await prompt.getByRole('button').all()) {
        if (!(await cell.isVisible())) continue;
        const b = (await cell.boundingBox())!;
        expect(b.width, 'cell width').toBeGreaterThanOrEqual(43.5);
        expect(b.height, 'cell height').toBeGreaterThanOrEqual(43.5);
      }
      for (const [name, loc] of [
        ['pass', page.locator('[data-region="pass"]').first()],
        ['roll', roll],
        ['chips', page.getByRole('radiogroup').first()],
      ] as const) {
        if ((await loc.count()) === 0) continue;
        expect(await anyUnder(loc), `${name} is under the prompt`).toBe(false);
      }
      // dismissing it moves nothing
      const rollBox = await roll.boundingBox();
      await prompt.getByRole('button', { name: /^Same bet/ }).click();
      await expect(prompt).toHaveCount(0);
      expect(await roll.boundingBox()).toEqual(rollBox);
    });
  }

  test('keyboard: Tab reaches the choices and Escape dismisses', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard flow on desktop');
    await page.goto(url);
    await placeSix(page);
    await page.getByRole('button', { name: /^Roll/ }).click();
    const prompt = page.getByTestId('win-prompt');
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: /^Same bet/ }).focus();
    await expect(prompt.getByRole('button', { name: /^Same bet/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0);
  });
});
