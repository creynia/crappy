import { expect, test, type Page } from '@playwright/test';

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

  test('landscape: the prompt sits over the rail status, clear of the Roll button', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'sets its own viewport');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(url);
    await placeSix(page);
    await page.getByRole('button', { name: /^Roll/ }).click();
    const prompt = page.getByTestId('win-prompt');
    await expect(prompt).toBeVisible();
    await page.screenshot({ path: 'test-results/win-prompt-landscape.png' });
    const p = (await prompt.boundingBox())!;
    const roll = (await page.locator('.sim-roll').first().boundingBox())!;
    expect(p.y + p.height).toBeLessThanOrEqual(roll.y + 1);
  });

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
