import { expect, test } from '@playwright/test';

test.describe('session plan', () => {
  for (const vp of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    test(`plan tab shows expected loss, risk and a suggested bankroll (${vp.name})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'sets its own viewports');
      test.setTimeout(90_000);
      await page.setViewportSize(vp);
      await page.goto('/#/play?speed=instant&seed=1');
      await page.getByRole('button', { name: 'Auto-roll', exact: true }).click();
      const panel = page.getByTestId('auto-roll-panel');
      await panel.getByRole('button', { name: 'Plan', exact: true }).click();
      const plan = page.getByTestId('plan-panel');
      await expect(plan.getByTestId('plan-expected')).toContainText('expected loss over 400 rolls');
      await panel
        .getByRole('group', { name: 'Bankroll' })
        .getByRole('button', { name: '$100' })
        .click();
      await expect(plan.getByTestId('plan-suggest')).toContainText('gets that under 5%', {
        timeout: 80_000,
      });
      await expect(plan.getByTestId('plan-risk')).toContainText('simulated sessions');
      await expect(plan.getByTestId('plan-stop')).toContainText('Suggested stop-loss');
      const overflow = await page
        .locator('html')
        .evaluate(
          (el: { scrollWidth: number; clientWidth: number }) => el.scrollWidth - el.clientWidth,
        );
      expect(overflow).toBeLessThanOrEqual(0);
      await plan.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/plan-${vp.name}.png` });
    });
  }
});
