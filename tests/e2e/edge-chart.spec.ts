import { expect, test } from '@playwright/test';

test.describe('edge chart', () => {
  test('toggle shows result per dollar wagered with the house edge and a funnel', async ({
    page,
  }, info) => {
    await page.goto('/#/play?speed=instant&seed=3');
    await page.getByRole('button', { name: 'Auto-roll', exact: true }).click();
    const panel = page.getByTestId('auto-roll-panel');
    await panel.getByTestId('auto-roll-run').click();
    await expect(panel.getByTestId('bankroll-chart')).toBeVisible();
    await panel.getByRole('button', { name: 'Show as % of money bet' }).click();
    const chart = panel.getByTestId('edge-chart');
    await expect(chart).toBeVisible();
    await expect(panel.getByTestId('bankroll-chart')).toHaveCount(0);
    await expect(chart).toContainText('Rolls (log scale)');
    await expect(chart).toContainText('House edge');
    await expect(chart.locator('[data-role="funnel"]')).toHaveCount(1);
    await expect(chart.getByRole('img')).toHaveAccessibleName(/House edge on this strategy/);
    // the hidden summary table must not widen the page
    const overflow = await page
      .locator('html')
      .evaluate(
        (el: { scrollWidth: number; clientWidth: number }) => el.scrollWidth - el.clientWidth,
      );
    expect(overflow).toBeLessThanOrEqual(0);
    await chart.scrollIntoViewIfNeeded();
    await chart.screenshot({ path: `test-results/edge-chart-${info.project.name}.png` });
    await panel.getByRole('button', { name: 'Bankroll', exact: true }).click();
    await expect(panel.getByTestId('bankroll-chart')).toBeVisible();
  });
});
