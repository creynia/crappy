import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } }); // the app forces instant animations

async function openScene(page: Page, n: number) {
  const scene = page.locator('section.scene').nth(n);
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.getByTestId('simulator')).toBeVisible();
  return scene;
}

test('home Continue leads to lesson 1', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('a.btn-big');
  await expect(cta).toContainText(/Start|Continue/);
  await cta.click();
  await expect(page).toHaveURL(/#\/learn\/dice-and-combinations/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('lesson 4: guided pass line scene, quiz, progress persists', async ({ page }) => {
  await page.goto('/#/learn/pass-line');
  const scene = await openScene(page, 0);
  const stepText = scene.locator('.sim-step-text');
  await expect(stepText).toContainText('Pass Line');

  // roll is locked until the bet is placed
  await expect(scene.getByRole('button', { name: /^Roll/ })).toBeDisabled();

  await scene.getByRole('radio', { name: '$10 chip' }).click();
  await scene.locator('[data-region="pass"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(stepText).toContainText('8 is the point');

  const roll = scene.getByRole('button', { name: /^Roll/ });
  await roll.click(); // 4-4
  await expect(stepText).toContainText('A 5 does nothing');
  await roll.click(); // 2-3
  await expect(stepText).toContainText('You made the point');
  await roll.click(); // 6-2
  await expect(scene.getByText('Done.', { exact: false }).first()).toBeVisible();
  await expect(scene.locator('.badge', { hasText: 'Done' })).toBeVisible();

  // quiz
  const quiz = page.locator('fieldset.quiz').first();
  await quiz.scrollIntoViewIfNeeded();
  await quiz.getByLabel('$10', { exact: true }).check();
  await quiz.getByRole('button', { name: 'Check answer' }).click();
  await expect(quiz.getByRole('status')).toContainText('Correct');

  // progress persists across reload
  await page.reload();
  const again = await openScene(page, 0);
  await expect(again.locator('.badge', { hasText: 'Done' })).toBeVisible();
  await page.goto('/#/learn/pass-line');
  const q2 = page.locator('fieldset.quiz').first();
  await expect(q2.locator('legend')).toContainText('answered');
});
