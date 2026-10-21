import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } }); // instant animations

test('challenge: 300 scored rolls, result screen and best score', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/#/challenge');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Challenge');
  await expect(page.locator('.challenge-bands li')).toHaveCount(5);
  await page.goto('/#/challenge?seed=7');
  const rolls = page.getByTestId('challenge-rolls');
  await expect(rolls).toContainText('Roll 0 of 300');
  await expect(page.getByRole('region', { name: 'Challenge' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);
  const roll = page.getByRole('button', { name: /^Roll/ });
  const sheet = page.getByRole('dialog');
  // Pass line with max odds whenever a point is on: the "perfect" line of play.
  for (let i = 1; i <= 300; i++) {
    if ((await page.locator('[data-stack]').count()) === 0) {
      await page.locator('[data-region="pass"]').click();
      await sheet.getByRole('button', { name: 'Confirm' }).click();
      await expect(sheet).toHaveCount(0);
    } else if (
      (await page.locator('.sim-puck.is-on').count()) > 0 &&
      (await page.locator('[data-stack]').count()) === 1
    ) {
      await page.locator('[data-region="pass"]').click();
      await sheet.getByRole('button', { name: 'Confirm' }).click();
      await expect(sheet).toHaveCount(0);
    }
    await roll.click();
    // the 300th roll ends the scene and swaps the table for the result screen
    if (i < 300) await expect(rolls).toContainText(`Roll ${i} of 300`);
  }
  const result = page.getByTestId('challenge-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('challenge-score')).toHaveText(/^\d+\.\d\d%$/);
  await expect(result).toContainText(/Perfect strategy|Sharp/);
  await expect(result).toContainText('Points played without odds');
  await expect(result).toContainText(/you finished (up|down) \$/);
  await expect(result).toContainText('Bets decided by the dice');
  await expect(result.locator('.challenge-kv')).toContainText(/Rolls\s*300/);
  await expect(result).toContainText('does not touch the score');
  await expect(result).not.toContainText(/win money|real money/i);
  await page.getByRole('button', { name: 'Seed of the day' }).click();
  await expect(page.getByTestId('challenge-rolls')).toContainText(/Roll 0 of 300 · seed \d{8}/);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText(/Your best:/)).toBeVisible();
});
