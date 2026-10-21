import { expect, test } from './helpers';

// Immersive landscape play: the app header and tab bar give way to a menu handle (I063).
test.describe('immersive landscape play', () => {
  test.skip(
    ({ viewport }) => !viewport || viewport.width < viewport.height || viewport.height > 520,
    'short landscape only',
  );

  test('the felt gets the height and the nav stays reachable', async ({ page, guard }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    const felt = page.locator('.sim-table-wrap');
    await expect(felt).toBeVisible();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.tabbar')).toBeHidden();
    const box = (await felt.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(330);
    // nothing sticks out sideways or needs vertical scrolling, and the handle clears the table
    await guard.check('immersive-play');
    const handle = page.locator('.immersive-menu');
    const hb = (await handle.boundingBox())!;
    expect(hb.x).toBeGreaterThanOrEqual(0);
    expect(hb.x + hb.width).toBeLessThanOrEqual(box.x + 0.5);
    expect(await page.evaluate('document.documentElement.scrollHeight')).toBeLessThanOrEqual(390);
    // the nav opens from the handle and works
    await handle.click();
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    const learn = page.locator('#immersive-nav').getByRole('link', { name: 'Learn' });
    await expect(learn).toBeVisible();
    await learn.click();
    await expect(page).toHaveURL(/#\/learn/);
    await expect(page.locator('.topbar')).toBeVisible(); // other pages keep the header
  });

  test('Escape closes the menu', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/#/play?speed=instant&seed=7');
    await page.locator('.immersive-menu').click();
    await expect(page.locator('#immersive-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#immersive-nav')).toBeHidden();
  });
});
