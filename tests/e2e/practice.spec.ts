import { expect, test } from '@playwright/test';

test('practice: open the hub and finish a 10-item line-calls round', async ({ page }) => {
  await page.goto('/#/more');
  await page.getByRole('link', { name: /Practice/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
  await page.getByRole('link', { name: /Line calls/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Line calls' })).toBeVisible();

  // Answer each question with the first choice; misses are re-asked, so the round may run
  // longer than 10, but it always ends.
  const summary = page.locator('.pr-summary');
  for (let i = 0; i < 40 && !(await summary.isVisible()); i++) {
    await page.locator('.pr-choice').first().click();
    await expect(page.locator('.pr-feedback')).toBeVisible();
    await page.getByRole('button', { name: /^(Next|See results)$/ }).click();
  }
  await expect(summary.getByRole('heading', { name: /Round complete: \d+ of 10/ })).toBeVisible();

  // Progress persists: the hub shows the best score after a reload.
  await page.goto('/#/practice');
  await page.reload();
  await expect(page.getByRole('link', { name: /Line calls/ })).toContainText(/Best \d+\/10/);
});

test('practice: the best-move drill ranks every option by EV in its feedback', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByRole('link', { name: /Best move/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Best move' })).toBeVisible();
  // three or four moves to choose from, a puck and the chips already on the table
  const choices = page.locator('.pr-choice');
  expect(await choices.count()).toBeGreaterThanOrEqual(3);
  expect(await choices.count()).toBeLessThanOrEqual(4);
  await choices.first().click();
  const feedback = page.locator('.pr-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('Ranked by expected value per dollar, per bet resolved.');
  await expect(feedback.locator('ol.pr-explain-list > li').first()).toContainText(/^1[ .]/);
  await expect(feedback).toContainText(/Expected value: /);
  // the correct move is marked, whether or not it was the one picked
  await expect(page.locator('.pr-choice.right')).toHaveCount(1);
  // the rest of the round plays out
  const summary = page.locator('.pr-summary');
  await page.getByRole('button', { name: /^(Next|See results)$/ }).click();
  for (let i = 0; i < 40 && !(await summary.isVisible()); i++) {
    await page.locator('.pr-choice').first().click();
    await expect(page.locator('.pr-feedback')).toBeVisible();
    await page.getByRole('button', { name: /^(Next|See results)$/ }).click();
  }
  await expect(summary.getByRole('heading', { name: /Round complete: \d+ of 10/ })).toBeVisible();
});

test('practice: call the bet, call every stack on the table and check', async ({ page }) => {
  await page.goto('/#/practice');
  await page.getByRole('link', { name: /Call the bet/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Call the bet' })).toBeVisible();
  const check = page.locator('.pr-call-check');
  await expect(check).toBeDisabled();
  const stacks = page.locator('.pr-call .sim-stack-hit');
  const n = await stacks.count();
  expect(n).toBeGreaterThan(0);
  // Tapping a stack selects it; a call moves on to the next uncalled stack.
  await stacks.first().click();
  await expect(stacks.first()).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < n; i++) await page.locator('.pr-call .pr-choice').first().click();
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.locator('.pr-feedback')).toBeVisible();
  await expect(page.locator('.pr-call-why li')).toHaveCount(n);
  await expect(page.locator('.sim-call.is-right, .sim-call.is-wrong')).toHaveCount(n);
});

for (const [w, h] of [
  [390, 844],
  [844, 390],
] as const) {
  test(`practice: call the bet stack targets are at least 44px at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/#/practice/call-the-bet');
    const targets = page.locator('.pr-call .sim-stack-target');
    await expect(targets.first()).toBeAttached();
    // measured after the table has laid out (the radius is set in screen px)
    await expect
      .poll(async () => {
        const sizes: number[] = [];
        for (let i = 0; i < (await targets.count()); i++) {
          const b = await targets.nth(i).boundingBox();
          sizes.push(b ? Math.min(b.width, b.height) : 0);
        }
        return Math.min(...sizes);
      })
      .toBeGreaterThanOrEqual(44);
  });
}
