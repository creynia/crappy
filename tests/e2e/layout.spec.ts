import { expect, test, type Locator, type Page } from '@playwright/test';

/** Screen centre of a chip stack's bottom chip (its shadow ellipse sits right under it). */
async function stackCentre(stack: Locator) {
  const box = await stack.locator('.sim-stack > ellipse').first().boundingBox();
  if (!box) throw new Error('stack not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function confirm(page: Page) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^(Confirm|Place anyway)/ }).click();
  await expect(sheet).toHaveCount(0);
}

test('come odds sit offset on the come bet: a tap on each stack opens that bet', async ({
  page,
}) => {
  await page.goto('/#/play?speed=instant&seed=1&dice=3-3,4-4');
  await page.locator('[data-region="pass"]').click();
  await confirm(page);
  await page.getByRole('button', { name: /^Roll/ }).click(); // point 6
  await page.locator('[data-region="come"]').click();
  await confirm(page);
  await page.getByRole('button', { name: /^Roll/ }).click(); // come travels to 8
  await page.locator('[data-region="box-8"]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Come odds', exact: true }).click();
  await confirm(page);

  const come = page.locator('[data-stack][aria-label^="Edit Come bet"]');
  const odds = page.locator('[data-stack][aria-label^="Edit Come Odds bet" i]');
  await expect(come).toHaveCount(1);
  await expect(odds).toHaveCount(1);
  // both amount badges are visible (not hidden under the other stack)
  for (const s of [come, odds]) await expect(s.locator('.sim-stack-badge')).toBeVisible();

  const c = await stackCentre(come);
  await page.mouse.click(c.x, c.y);
  await expect(sheet.getByRole('heading').first()).not.toContainText(/odds/i);
  await expect(sheet.getByRole('heading').first()).toContainText(/come/i);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);

  const o = await stackCentre(odds);
  await page.mouse.click(o.x, o.y);
  await expect(sheet.getByRole('heading').first()).toContainText(/odds/i);
});
