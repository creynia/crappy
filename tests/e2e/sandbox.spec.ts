import { expect, test, type Page } from '@playwright/test';

const url = (q = '') => `/#/play?speed=instant${q ? '&' + q : ''}`;

async function bankroll(page: Page): Promise<number> {
  const t = await page.locator('.sim-status-money b').first().innerText();
  return Number(t.replace(/[^0-9.-]/g, ''));
}

test.describe('sandbox', () => {
  test('pass line: EV sheet, confirm, roll changes the bankroll', async ({ page }) => {
    await page.goto(url('seed=1&dice=3-4'));
    await page.locator('[data-region="pass"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('house edge 1.41%');
    await expect(sheet).toContainText('Good bet');
    await sheet.getByRole('button', { name: 'Confirm' }).click();
    await expect(sheet).toHaveCount(0);
    const before = await bankroll(page);
    expect(before).toBe(495);
    await page.getByRole('button', { name: /^Roll/ }).click(); // 7 on come-out: natural, pass wins
    await expect.poll(() => bankroll(page)).toBe(500);
    await expect(page.locator('.sim-toast').first()).toContainText('Natural');
  });

  test('hard 4 shows -$1.11 and is not a one-roll bet', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="hard-4"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel('Bet amount')).toHaveText('$5');
    await sheet.getByRole('button', { name: 'Increase amount' }).click(); // $5 chip: $5 -> $10
    await expect(sheet.getByLabel('Bet amount')).toHaveText('$10');
    await expect(sheet.locator('.sim-headline')).toContainText('-$1.11');
    await expect(sheet.locator('[data-line="loss"]')).toContainText('$1.11');
    await expect(sheet).toContainText('Sucker bet');
    await expect(sheet.locator('.sim-oneroll')).toHaveCount(0);
  });

  test('center prop needs Place anyway', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="any-7"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Sucker bet');
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await expect(sheet.getByRole('button', { name: /again to place anyway/i })).toBeVisible();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.sim-center-ind')).toContainText('Center bets');
  });

  test('auto-roll 100 rolls in fast mode renders the chart', async ({ page }) => {
    await page.goto('/#/play?speed=fast');
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
  });

  test('auto-roll and strategy compare do not cause horizontal page scroll', async ({ page }) => {
    const noHScroll = async (label: string) => {
      const m = await page.evaluate<{ scrollWidth: number; clientWidth: number }>(
        '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })',
      );
      expect(m.scrollWidth, label).toBeLessThanOrEqual(m.clientWidth);
    };
    for (const { width, height } of [
      { width: 360, height: 844 },
      { width: 390, height: 844 },
      { width: 412, height: 844 },
      { width: 844, height: 390 },
    ]) {
      // single-strategy auto-roll in the sandbox
      await page.setViewportSize({ width, height });
      await page.goto('/#/play?speed=fast');
      const tab = page.getByRole('button', { name: 'Auto-roll', exact: true });
      if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
      const panel = page.locator('.sim-auto');
      await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
      await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
      await noHScroll(`auto-roll @${width}`);

      // strategy compare run on a lesson scene (the 4-column summary table)
      await page.goto('/#/learn/strategy-fun-per-dollar');
      const scene = page.locator('section.scene').nth(0);
      await scene.scrollIntoViewIfNeeded();
      await scene.getByRole('button', { name: /^Auto-roll 100/ }).click();
      await expect(scene.getByTestId('auto-roll-summary')).toBeVisible({ timeout: 15_000 });
      await noHScroll(`compare @${width}`);
    }
  });

  test('auto-roll starting bankroll picker sets the run bankroll without page overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/play?speed=fast');
    const tab = page.getByRole('button', { name: 'Auto-roll', exact: true });
    if ((await tab.getAttribute('aria-expanded')) !== 'true') await tab.click();
    const panel = page.locator('.sim-auto');
    await panel
      .getByRole('group', { name: 'Starting bankroll' })
      .getByRole('button', { name: '$5,000' })
      .click();
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('region', { name: 'Strategy summary' })).toContainText(
      '$5,000.00',
    );
    const scroll = await page.evaluate<{ scrollWidth: number; clientWidth: number }>(
      '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })',
    );
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
  });

  test('sandbox state persists across reload', async ({ page }) => {
    await page.goto(url());
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await page.goto('/');
    await page.goto(url());
    await expect(page.locator('.sim-status-money')).toContainText('On table $5');
  });
});

// ---------------------------------------------------------------------------------------------
// I083: sandbox flows. Everything below is written against user-visible behavior (roles, labels,
// text) and made deterministic with the ?seed / ?dice / ?rules URL params, so it can guard the
// Simulator.tsx refactor.

const money = (page: Page, label: 'Bankroll' | 'On table' | 'Session') =>
  page.locator('.sim-status-money > span', { hasText: label }).first().locator('b').innerText();

/** Dice faces as "a-b" pairs for the ?dice= param, consumed in order. */
const dice = (...rolls: string[]) => `dice=${rolls.join(',')}`;

async function place(page: Page, region: string, opts: { times?: number } = {}) {
  await page.locator(`[data-region="${region}"]`).click();
  const sheet = page.getByRole('dialog');
  for (let i = 0; i < (opts.times ?? 0); i++)
    await sheet.getByRole('button', { name: 'Increase amount' }).click();
  await sheet.getByRole('button', { name: 'Confirm' }).click();
  await expect(sheet).toHaveCount(0);
}

const roll = (page: Page) => page.getByRole('button', { name: /^Roll/ }).click();

/** Hash-only navigation does not reload, so bounce through the home route to remount the table. */
async function fresh(page: Page, q = '') {
  await page.goto('/');
  await page.goto(url(q));
}

const bank = (page: Page) => money(page, 'Bankroll');
const onTable = (page: Page) => money(page, 'On table');
const menu = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true });

test.describe('sandbox flows', () => {
  test('come bet travels to its number and takes odds', async ({ page }) => {
    await page.goto(url('seed=1&' + dice('3-3', '2-3', '1-4')));
    await place(page, 'pass');
    await roll(page); // 6: point
    await expect(page.getByText('Point: 6')).toBeVisible();
    await place(page, 'come');
    await expect.poll(() => bank(page)).toBe('$490');
    await roll(page); // 5: the Come bet travels to the 5
    await expect(page.getByRole('button', { name: /^Edit Come bet.*5/ })).toBeVisible();
    await expect.poll(() => onTable(page)).toBe('$10');
    const comeBet = page.getByRole('button', { name: /^Edit Come bet/ });
    await comeBet.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Contract bet');
    await expect(sheet.getByRole('button', { name: 'Remove' })).toBeDisabled();
    await sheet.getByRole('button', { name: 'Add odds' }).click();
    await expect(sheet.getByRole('radio', { name: 'Come odds', exact: true })).toBeChecked();
    const odds = (await sheet.getByLabel('Bet amount').innerText()).replace(/[^0-9]/g, '');
    await sheet.getByRole('button', { name: 'Confirm' }).click();
    await expect(sheet).toHaveCount(0);
    expect(Number(odds)).toBeGreaterThan(0);
    await expect.poll(() => bank(page)).toBe(`$${490 - Number(odds)}`);
    await roll(page); // 5 again: Come + odds win, pass line stays up
    // 5:5 even money on the flat bet, 3:2 on the odds, both returned
    const won = 5 + Math.floor((Number(odds) * 3) / 2);
    await expect.poll(() => bank(page)).toBe(`$${490 - Number(odds) + 5 + Number(odds) + won}`);
    await expect(page.locator('.sim-toast').first()).toContainText(/^5\b/);
  });

  test('sucker bet needs two taps and nothing is placed on the first', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="any-7"]').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await expect(sheet.getByRole('alert').filter({ hasText: 'sucker bet' })).toBeVisible();
    await expect.poll(() => bank(page)).toBe('$500');
    await expect.poll(() => onTable(page)).toBe('$0');
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => bank(page)).toBe('$495');
    await expect.poll(() => onTable(page)).toBe('$5');
  });

  test('rebet puts a one-roll bet back after it resolves', async ({ page }) => {
    await page.goto(url('seed=1&' + dice('1-1')));
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="any-7"]').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await roll(page); // snake eyes: Any 7 loses
    await expect.poll(() => onTable(page)).toBe('$0');
    await expect.poll(() => bank(page)).toBe('$495');
    await menu(page).click();
    const rebet = page.getByRole('button', { name: 'Rebet' });
    await expect(rebet).toBeEnabled();
    await rebet.click();
    await expect.poll(() => onTable(page)).toBe('$5');
    await expect.poll(() => bank(page)).toBe('$490');
    await expect(rebet).toBeDisabled();
  });

  test('changing the rules resets the table', async ({ page }) => {
    await page.goto(url('seed=1&' + dice('3-3')));
    await place(page, 'pass');
    await roll(page);
    await expect(page.getByText('Point: 6')).toBeVisible();
    await expect.poll(() => onTable(page)).toBe('$5');
    await menu(page).click();
    await page.getByLabel('Rules').selectOption({ label: '10x odds' });
    await expect.poll(() => bank(page)).toBe('$500');
    await expect.poll(() => onTable(page)).toBe('$0');
    await expect(page.getByText('Point: 6')).toHaveCount(0); // table reset
    await expect(page.getByText('Come-out roll')).toBeVisible();
    await expect(page.getByLabel('Rules')).toHaveValue('odds-10x');
  });

  test('bankroll and bets persist across a reload', async ({ page }) => {
    await page.goto(url('seed=1&' + dice('3-3')));
    await place(page, 'pass');
    await roll(page);
    await expect(page.getByText('Point: 6')).toBeVisible();
    await page.goto(url()); // no seed/dice/rules: restores the saved table
    await page.reload();
    await expect(page.getByText('Point: 6')).toBeVisible();
    await expect.poll(() => bank(page)).toBe('$495');
    await expect.poll(() => onTable(page)).toBe('$5');
  });

  test('URL params: seed and dice are deterministic, rules preset applies', async ({ page }) => {
    // five rolls, so a lucky repeat of the first total cannot fake determinism
    const firstToast = async () => {
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        await roll(page);
        await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
        seen.push(await page.locator('.sim-toast').last().innerText());
      }
      return seen.join('|');
    };
    await fresh(page, 'seed=42');
    const a = await firstToast();
    await page.evaluate(() => localStorage.clear());
    await fresh(page, 'seed=42');
    await page.reload();
    expect(await firstToast()).toBe(a);

    await fresh(page, 'seed=1&' + dice('6-6', 'junk', '3-4'));
    await roll(page);
    await expect(page.locator('.sim-toast').first()).toContainText('12');
    await roll(page);
    await expect(page.locator('.sim-toast').last()).toContainText('7');

    await fresh(page, 'rules=odds-100x&seed=1&' + dice('3-3'));
    await place(page, 'pass');
    await roll(page);
    await expect(page.getByText('Point: 6')).toBeVisible();
    await page.getByRole('button', { name: /^Edit Pass line bet/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Add odds' }).click();
    await sheet.getByRole('button', { name: 'Max odds' }).click();
    // standard 3-4-5x would cap this at $25; 100x is limited only by the bankroll
    const max = Number((await sheet.getByLabel('Bet amount').innerText()).replace(/[^0-9]/g, ''));
    expect(max).toBeGreaterThan(100);
  });

  test('bet sheet fits the viewport in portrait and landscape', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'sets its own viewports');
    for (const vp of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto(url());
      await page.locator('[data-region="pass"]').click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toContainText('Pass line');
      // wait out the slide-in transition before measuring
      let box = (await sheet.boundingBox())!;
      await expect
        .poll(async () => {
          const prev = box;
          box = (await sheet.boundingBox())!;
          return box.x === prev.x && box.y === prev.y && box.width === prev.width;
        })
        .toBe(true);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      await expect(sheet.getByRole('button', { name: 'Confirm' })).toBeInViewport();
      if (vp.width > vp.height) {
        // landscape: a side panel, so the table stays visible beside it
        await expect(page.locator('[data-region="pass"]')).toBeInViewport();
        expect(box.width).toBeLessThan(vp.width * 0.6);
      }
      await sheet.getByRole('button', { name: 'Cancel' }).click();
      await expect(sheet).toHaveCount(0);
    }
  });

  test('auto-roll with the same seed compares strategies on the same dice', async ({ page }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Auto-roll', exact: true }).click();
    const panel = page.getByTestId('auto-roll-panel');
    const run = async (odds: string) => {
      await panel.getByRole('group', { name: 'Odds' }).getByRole('button', { name: odds }).click();
      await panel.getByTestId('auto-roll-run').click();
      const summary = panel.getByTestId('auto-roll-summary');
      await expect(summary).toBeVisible();
      return summary.getByRole('row', { name: /^Total wagered/ }).innerText();
    };
    const max = await run('Max');
    const flat = await run('Flat only');
    expect(max).not.toBe(flat);
    expect(await run('Max')).toBe(max); // same seed, same settings: identical result
  });

  test('tapping the table skips the roll animation', async ({ page }) => {
    // Freeze time so only the tap can finish the roll: with the clock paused the animation timers
    // never fire, so "Roll is enabled again" proves the skip, not a fast machine.
    await page.clock.install();
    await page.goto('/#/play?speed=normal&seed=1&' + dice('3-4'));
    await place(page, 'pass');
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await roll(page);
    const rollBtn = page.getByRole('button', { name: /^Roll/ });
    await expect(rollBtn).toHaveAccessibleName(/Rolling/);
    await page.waitForTimeout(1200); // real time passes, the paused clock does not
    await expect(rollBtn).toHaveAccessibleName(/Rolling/);
    await page.getByRole('group', { name: 'Craps table' }).click({ position: { x: 4, y: 4 } });
    await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
    await expect.poll(() => bank(page)).toBe('$500'); // 7 on the come-out: the pass bet wins even money
    await expect(page.locator('.sim-toast').last()).toContainText('Natural');
  });
});
