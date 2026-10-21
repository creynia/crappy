import { expect, test, type Page } from './helpers';

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

test('lesson 4: guided pass line scene, quiz, progress persists', async ({ page, guard }) => {
  await page.goto('/#/learn/pass-line');
  const scene = await openScene(page, 0);
  const stepText = scene.locator('.sim-step-text');
  await expect(stepText).toContainText('Pass Line');
  await guard.check('lesson-scene');

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
  await guard.check('lesson-quiz');

  // progress persists across reload
  await page.reload();
  const again = await openScene(page, 0);
  await expect(again.locator('.badge', { hasText: 'Done' })).toBeVisible();
  await page.goto('/#/learn/pass-line');
  const q2 = page.locator('fieldset.quiz').first();
  await expect(q2.locator('legend')).toContainText('answered');
});

test('lesson 1: auto-roll scene completes its step', async ({ page, guard }) => {
  await page.goto('/#/learn/dice-and-combinations');
  const scene = await openScene(page, 1);
  await scene.getByRole('button', { name: /^Auto-roll 600/ }).click();
  await expect(scene.locator('.sim-step-text')).toContainText('Compare the 7 bar');
  await guard.check('lesson-auto-roll-done');
});

test('lesson 20: compare runs all three strategies', async ({ page, guard }) => {
  await page.goto('/#/learn/strategy-fun-per-dollar');
  const scene = await openScene(page, 0);
  await scene.getByRole('button', { name: /^Auto-roll 100/ }).click();
  const summary = scene.getByTestId('auto-roll-summary');
  await expect(summary.locator('thead th')).toHaveCount(4);
  await expect(scene.locator('.sim-chart-legend li')).toHaveCount(4); // 3 series + the expected line
  await expect(scene.locator('.sim-step-text')).toContainText(/Done|Nice work/);
  await guard.check('lesson-compare-done');
});

test('lesson 6: the Pass bet is a contract bet and offers Add odds', async ({ page, guard }) => {
  await page.goto('/#/learn/odds-bet');
  const scene = await openScene(page, 0);
  await scene.locator('[data-stack]').first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('Contract bet');
  await guard.check('odds-sheet-open');
  await expect(sheet).not.toContainText('Free bet');
  await expect(sheet.getByRole('button', { name: 'Remove' })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Add odds' }).click();
  await expect(sheet.getByLabel('Bet amount')).toHaveText('$40');
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(scene.locator('.sim-step-text')).toContainText('Tap your Odds bet');
});

test('lesson 7: the call-the-bet question locks Roll until answered', async ({ page }) => {
  await page.goto('/#/learn/come-bets');
  const scene = await openScene(page, 1);
  await scene.getByRole('button', { name: 'Next' }).click();
  const roll = scene.getByRole('button', { name: /^Roll/ });
  await expect(roll).toBeDisabled();
  await expect(scene.locator('.sim-lock')).toContainText('Answer the question first');
  await expect(roll).toHaveAttribute('aria-describedby', /.+/);
  await expect(scene.locator('.sim-ask')).toBeVisible();
  await scene.getByRole('button', { name: 'Both lose' }).click();
  await expect(scene.locator('.sim-ask-feedback')).toContainText('Not quite');
  await expect(roll).toBeDisabled();
  await scene.getByRole('button', { name: 'The Come bet loses and the odds come back' }).click();
  await expect(scene.locator('.sim-ask-feedback')).toContainText('Correct');
  await expect(scene.locator('.sim-ask-feedback')).toContainText('Now roll to check your call');
  await expect(roll).toBeEnabled();
  await roll.click();
  await expect(scene.locator('.sim-step-text')).toContainText('lost');
  await scene.getByRole('button', { name: 'Finish' }).click();
  await expect(scene.locator('.sim-step-done')).toBeVisible();
});

test('lesson 13: $1 Fire + Small ride 1,000 hands on auto-roll', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/learn/sucker-bets');
  const scene = await openScene(page, 2); // opens on the Center panel (ui.view: center)
  await scene.getByRole('radio', { name: '$1 chip' }).click();
  const sheet = page.getByRole('dialog');
  await scene.locator('[data-region="fire"]').click();
  await expect(sheet.getByLabel('Bet amount')).toHaveText('$1');
  await expect(sheet).toContainText('about 1 in');
  await expect(sheet.locator('.sim-alt')).toHaveCount(0); // the scene allows no cheaper alternative
  await sheet.getByRole('button', { name: 'Place anyway' }).click();
  await sheet.getByRole('button', { name: /again to place anyway/i }).click();
  await scene.locator('[data-region="small"]').click();
  await expect(sheet.getByLabel('Bet amount')).toHaveText('$1');
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(scene.locator('.sim-step-text')).toContainText('My layout');
  await scene.getByRole('button', { name: /^Auto-roll 8500/ }).click();
  await expect(scene.locator('.sim-step-text')).toContainText('Bonus bet hits', {
    timeout: 90_000,
  });
  const summary = scene.getByTestId('auto-roll-summary');
  const row = (label: string) =>
    summary
      .locator('tr', { has: page.locator('th', { hasText: label }) })
      .locator('td')
      .first();
  await expect(row('Bonus bet hits')).toContainText(/Small 34:1 x\d+/);
  const expected = Number((await row('Expected loss').innerText()).replace(/[^0-9.-]/g, ''));
  expect(expected).toBeLessThan(-230); // about -$285 over 1,000 hands at $1 + $1
  expect(expected).toBeGreaterThan(-330);
  await expect(row('Busted')).toHaveText('No');
});
