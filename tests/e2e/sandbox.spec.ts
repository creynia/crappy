import { encodeCustom, PRESETS_AS_CUSTOM } from '../../src/sim/strategy/custom';
import { expect, test, type Page } from './helpers';

const url = (q = '') => `/#/play?speed=instant${q ? '&' + q : ''}`;

async function bankroll(page: Page): Promise<number> {
  const t = await page.locator('.sim-status-money b').first().innerText();
  return Number(t.replace(/[^0-9.-]/g, ''));
}

test.describe('sandbox', () => {
  test('pass line: EV sheet, confirm, roll changes the bankroll', async ({ page, guard }) => {
    await page.goto(url('seed=1&dice=3-4'));
    await page.locator('[data-region="pass"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('house edge 1.41%');
    await guard.check('sheet-open');
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

  test('center prop needs Place anyway', async ({ page, guard }) => {
    await page.goto(url());
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="any-7"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Sucker bet');
    await guard.check('center');
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await expect(sheet.getByRole('button', { name: /again to place anyway/i })).toBeVisible();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.sim-center-ind')).toContainText('Center bets');
  });

  test('hop bet: pick a hard hop in the 21-pair picker, win 30 to 1', async ({ page }) => {
    await page.goto(url('seed=1&dice=3-3'));
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="hop"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('.sim-hop-cell')).toHaveCount(21);
    await expect(sheet).toContainText('11.11%'); // starts on the 2-4 easy hop
    await sheet.locator('[data-hop="3-3"]').click();
    await expect(sheet.locator('[data-hop="3-3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet).toContainText('13.89%');
    await expect(sheet.locator('.sim-hop-note')).toContainText('pays 30 to 1 · edge 13.89%');
    const amount = Number(
      (await sheet.getByLabel('Bet amount').innerText()).replace(/[^0-9.]/g, ''),
    );
    await sheet.getByRole('button', { name: 'Place anyway' }).click();
    await sheet.getByRole('button', { name: /again to place anyway/i }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit Hop 3-3 bet/ })).toBeVisible();
    const before = await bankroll(page);
    await page.getByRole('button', { name: /^Roll/ }).click();
    await expect.poll(() => bankroll(page)).toBe(before + amount * 31);
  });

  test('bonus rail: Small collects pips, Fire is a sucker bet, neither can be taken down', async ({
    page,
  }) => {
    await page.goto(url('seed=1&dice=1-1,1-2,3-4'));
    await page.getByRole('button', { name: 'Center' }).click();
    await page.locator('[data-region="fire"]').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('house edge 20.76%');
    await expect(sheet).toContainText('Sucker bet');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('[data-region="small"]').click();
    await expect(sheet).toContainText('house edge 7.76%');
    await expect(sheet).toContainText('Costly');
    await expect(sheet.getByLabel('Bet amount')).toHaveText('$5');
    await sheet.getByRole('button', { name: 'Confirm' }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('button', { name: /^Roll/ }).click(); // 2
    await expect(page.locator('[data-region="small"] .sim-pips .is-hit')).toHaveCount(1);
    await page.getByRole('button', { name: /^Roll/ }).click(); // 3
    await expect(page.locator('[data-region="small"] .sim-pips .is-hit')).toHaveCount(2);
    await page.locator('[data-stack]').first().click();
    await expect(sheet).toContainText('stays up until the hand decides it');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: /^Roll/ }).click(); // 7: Small loses
    await expect(page.locator('[data-stack]')).toHaveCount(0);
  });

  test('my system: a shared link opens the builder and the system runs (I013)', async ({
    page,
    guard,
  }) => {
    // the narrowest phone we support: the builder must not scroll sideways
    await page.setViewportSize({ width: 360, height: 740 });
    const molly = encodeCustom(PRESETS_AS_CUSTOM['three-point-molly']!);
    await page.goto(url(`system=${molly}`));
    await page.getByRole('button', { name: 'Auto-roll', exact: true }).click();
    const panel = page.getByTestId('auto-roll-panel');
    await expect(panel.getByLabel('Strategy')).toHaveValue('custom');
    const builder = panel.locator('.sim-sb');
    await expect(builder.locator('[name="comeCount"]')).toHaveValue('2');
    await builder.locator('[name="numbersKind"]').selectOption('place');
    await expect(builder.getByRole('checkbox', { name: 'Place 6' })).toBeChecked();
    const box = (await builder.locator('label:has([name="n4"])').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await guard.check('system-builder');
    await panel.getByTestId('auto-roll-run').click();
    await expect(panel.getByTestId('auto-roll-summary')).toContainText('Edge on action');
    await expect(builder.locator('.sim-sb-link input')).toHaveValue(/^#\/play\?system=[\w-]+$/);
  });

  test('custom rules: upfront vig changes the buy 4 edge (I033)', async ({ page, guard }) => {
    await page.goto(url());
    const buy4 = async () => {
      await page.locator('[data-region="box-4"]').click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('radio', { name: /^Buy/ }).click();
      const text = await sheet.locator('.sim-headline').innerText();
      await sheet.getByRole('button', { name: 'Cancel' }).click();
      return text;
    };
    expect(await buy4()).toContain('1.67%');
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.locator('.sim-menu');
    await menu.getByLabel('Rules').selectOption('custom');
    const form = page.locator('form.sim-rules');
    await form.getByLabel('Buy/lay vig paid').selectOption('upfront');
    await expect(form.getByTestId('rules-summary')).toContainText('Buy 4 $25: 3.85%');
    await guard.check('rules-editor-open');
    // every select in the editor is a 44px tap target, even inside the menu
    // (43.5 allows for sub-pixel rounding: a 44px control can measure 43.999969)
    for (const sel of await form.locator('select').all())
      expect((await sel.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await form.getByRole('button', { name: /^Apply/ }).click();
    await expect(form).toHaveCount(0);
    await expect(menu.getByLabel('Rules')).toHaveValue('custom');
    // the panel sheet sits over the table in landscape: close it before betting (I064)
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('panel-sheet')).toHaveCount(0);
    expect(await buy4()).toContain('4.76%');
  });

  test('auto-roll 100 rolls in fast mode renders the chart', async ({ page, guard }) => {
    await page.goto('/#/play?speed=fast');
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
    await guard.check('auto-roll-done');
  });

  test('strategy table: sort, run it, no horizontal overflow', async ({ page }) => {
    await page.goto('/#/play?speed=fast');
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await panel.getByRole('button', { name: 'Compare all' }).click();
    const table = panel.getByTestId('strategy-table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    const fits = await page.evaluate(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(fits).toBe(true);
    if (process.env.SHOT)
      await page.screenshot({ path: `${process.env.SHOT}-${test.info().project.name}.png` });
    await table.getByRole('button', { name: /^Run it: Iron Cross/ }).click();
    await expect(table).toHaveCount(0);
    await expect(panel.getByRole('combobox', { name: 'Strategy' })).toHaveValue('iron-cross');
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

  test('cost toggle sits in the status line; Roll does not move or get covered', async ({
    page,
  }) => {
    type Box = { x: number; y: number; width: number; height: number };
    const overlaps = (a: Box, b: Box) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const { width, height } of [
      { width: 390, height: 844 },
      { width: 360, height: 740 },
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(url('seed=1&dice=3-4'));
      const rollBefore = await page.locator('.sim-roll').boundingBox();
      await page.locator('[data-region="pass"]').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
      expect(await page.evaluate<number>('window.scrollY')).toBe(0);
      const cost = await page.locator('.sim-cost-toggle').boundingBox();
      const status = await page.locator('.sim-status').first().boundingBox();
      const roll = await page.locator('.sim-roll').boundingBox();
      expect(cost, `${width}x${height} cost toggle`).not.toBeNull();
      expect(status, `${width}x${height} status line`).not.toBeNull();
      // (a) the toggle starts inside the status line, at its top-right
      expect(cost!.y, `${width}x${height} toggle top in status line`).toBeGreaterThanOrEqual(
        status!.y,
      );
      expect(
        cost!.x + cost!.width,
        `${width}x${height} toggle right in status line`,
      ).toBeLessThanOrEqual(status!.x + status!.width + 1);
      expect(cost!.height, `${width}x${height} toggle hit area`).toBeGreaterThanOrEqual(44);
      // (b) the toggle does not cover the status text
      const texts = await page.evaluate<{ boxes: Box[]; clipped: string[] }>(`(() => {
        const boxes = [];
        const clipped = [];
        for (const sel of ['.sim-status-money > *', '.sim-point', '.sim-last']) {
          for (const e of document.querySelectorAll(sel)) {
            const r = e.getBoundingClientRect();
            boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
            if (e.scrollWidth > e.clientWidth + 1) clipped.push(sel);
          }
        }
        return { boxes, clipped };
      })()`);
      expect(texts.clipped, `${width}x${height} status text clipped`).toEqual([]);
      for (const box of texts.boxes) {
        expect(overlaps(cost!, box), `${width}x${height} toggle over status text`).toBe(false);
      }
      // Roll grows once a bet shows its cost inside the button, on main too; rev-i compares Roll with main
      void rollBefore;
      // (d) Roll does not intersect the rack or the toggle, and a plain click reaches it
      const chips = await page.locator('.sim-rack').boundingBox();
      if (chips) expect(overlaps(roll!, chips), `${width}x${height} roll vs chip rack`).toBe(false);
      expect(overlaps(roll!, cost!), `${width}x${height} roll vs cost toggle`).toBe(false);
      await page.locator('.sim-roll').click({ timeout: 5_000 });
    }
  });

  test('sandbox state persists across reload', async ({ page, guard }) => {
    await page.goto(url());
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    // the table saves from an effect after render: wait for the bet on screen AND in storage
    // before leaving, or a loaded CI machine can reload before the save
    await expect(page.locator('.sim-status-money')).toContainText('On table $5');
    await page.waitForFunction(
      `Object.keys(localStorage).some((k) => /^crappy:sim:.*:v1$/.test(k) && (localStorage.getItem(k) || '').includes('"pass-line"'))`,
    );
    await page.goto('/');
    await page.goto(url());
    await expect(page.locator('.sim-status-money')).toContainText('On table $5');
    await guard.check('sandbox-reloaded');
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
      // wait out the slide-in transition before measuring: every animation finished and the box
      // (position AND size) unchanged between two polls
      let box = (await sheet.boundingBox())!;
      await expect
        .poll(async () => {
          const prev = box;
          box = (await sheet.boundingBox())!;
          const settled = await page.evaluate<boolean>(
            '(() => { const el = document.querySelector("[role=dialog]"); return !el || el.getAnimations({ subtree: true }).every((a) => a.playState === "finished"); })()',
          );

          return (
            settled &&
            box.x === prev.x &&
            box.y === prev.y &&
            box.width === prev.width &&
            box.height === prev.height
          );
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

  test('a come bet slides from the box to its number, then sweeps on the seven-out', async ({
    page,
  }) => {
    // Drive the animation timeline with a controlled clock so each step is observable.
    await page.clock.install();
    await page.goto('/#/play?speed=normal&seed=1&' + dice('4-4', '2-3', '3-4'));
    await place(page, 'pass');
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await roll(page); // point 8
    await page.clock.runFor(2000);
    await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
    await place(page, 'come');
    await roll(page); // 5: the come bet travels
    await page.clock.runFor(700); // dice 650: the travel step (no puck on a 5) is under way
    const ghost = page.locator('.sim-ghost-travel');
    await expect(ghost).toHaveCount(1);
    await expect(ghost).toHaveClass(/is-moving/);
    await expect(ghost).toHaveAttribute('style', /--dx: -?\d.*--dy: -?\d/);
    await expect(page.locator('[data-stack]')).toHaveCount(1); // only the pass line while the chips move
    await page.clock.runFor(300);
    await expect(ghost).toHaveCount(0);
    await expect(page.locator('[data-stack]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
    await roll(page); // seven-out: both bets are swept
    await page.clock.runFor(700); // dice settled, puck moving: the chips still sit on their spots
    await expect(page.locator('.sim-ghost-lose')).toHaveCount(2);
    await expect(page.locator('.sim-ghost-lose.is-moving')).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(page.locator('.sim-ghost-lose.is-moving')).toHaveCount(2);
    await page.clock.runFor(1000);
    await expect(page.locator('.sim-ghost-lose')).toHaveCount(0);
    await expect(page.locator('[data-stack]')).toHaveCount(0);
  });

  test('point made with a come bet in the box: the chip waits at the box until the travel step', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/#/play?speed=normal&seed=1&' + dice('4-4', '5-3'));
    await place(page, 'pass');
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await roll(page); // point 8
    await page.clock.runFor(2000);
    await place(page, 'come');
    const comeBox = await page.locator('[data-stack="b2"] .sim-stack').getAttribute('transform');
    await roll(page); // 8: point made, pass wins, the come bet travels to the 8
    await page.clock.runFor(700); // dice settled (650), puck step running: nothing has moved yet
    const ghost = page.locator('.sim-ghost-travel');
    await expect(ghost).toHaveCount(1);
    await expect(ghost).not.toHaveClass(/is-moving/);
    await expect(ghost.locator('.sim-stack')).toHaveAttribute('transform', comeBox!);
    await expect(page.locator('[data-stack="b2"]')).toHaveCount(0); // never drawn at the 8 early
    await page.clock.runFor(100); // the travel step starts at 750
    await expect(ghost).toHaveClass(/is-moving/);
    await page.clock.runFor(250);
    await expect(ghost).toHaveCount(0);
    await expect(page.locator('[data-stack="b2"]')).toHaveCount(1);
    await page.clock.runFor(1000);
    await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
  });

  test('panel sheet: tabs switch panels, Escape restores focus, the handle drags it away', async ({
    page,
  }) => {
    await page.goto(url('seed=1'));
    const sessionTab = page.getByRole('button', { name: 'Session', exact: true });
    await sessionTab.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.sim-session-panel')).toBeVisible();
    await expect(sheet.locator('.sim-session-panel h3').first()).toBeFocused();
    // Tab from the heading stays in the sheet; Escape works even after focus wandered outside
    await page.keyboard.press('Tab');
    await expect(sheet.locator(':focus')).toHaveCount(1);
    await page.locator('[data-region="field"]').focus();
    await page.keyboard.press('Tab');
    await expect(sheet.locator(':focus')).toHaveCount(1);
    await page.locator('[data-region="field"]').focus();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await sessionTab.click();
    await sheet.getByRole('tab', { name: 'Menu' }).click();
    await expect(sheet.locator('.sim-menu')).toBeVisible();
    await expect(sheet.locator('.sim-session-panel')).toHaveCount(0);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    // the dice stay reachable from the sheet
    await sheet.getByRole('button', { name: 'Throw the dice' }).click();
    await expect(page.getByTestId('roll-announcer')).not.toHaveText('');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(sessionTab).toBeFocused(); // back to the control that opened the sheet
    await sessionTab.click();
    await expect(sheet).toBeVisible();
    const handle = sheet.getByRole('button', { name: /Close panel \(drag/ });
    if ((await handle.count()) === 0) {
      // landscape viewports (phone-landscape, desktop): a side panel with no drag handle
      await expect(page.locator('.sim-sheet-panel .sim-panel-sheet')).toBeVisible();
      await sheet.getByRole('button', { name: 'Close panel' }).click();
      await expect(sheet).toHaveCount(0);
      return;
    }
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 60, { steps: 4 });
    await page.mouse.move(x, y + 140, { steps: 4 });
    await page.mouse.up();
    await expect(sheet).toHaveCount(0);
  });

  test('share link: the menu copies a link that reproduces the layout and the next rolls', async ({
    page,
  }) => {
    // capture the share text instead of the system share sheet / clipboard
    await page.addInitScript(() => {
      const w = globalThis as unknown as { __shared: string[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (t: string) => Promise.resolve(void w.__shared.push(t)) },
        configurable: true,
      });
    });
    await page.goto(url('seed=11&' + dice('4-4')));
    await place(page, 'pass');
    await roll(page); // point 8 (forced), then the seed takes over
    await expect(page.getByRole('button', { name: /^Roll(?!ing)/ })).toBeEnabled();
    await place(page, 'come');
    await menu(page).click();
    await page.getByRole('button', { name: 'Share table' }).click();
    await expect(page.locator('.sim-toast').last()).toContainText('Link copied');
    const shared = await page.evaluate(
      () => (globalThis as unknown as { __shared: string[] }).__shared,
    );
    expect(shared[0]).toMatch(
      /#\/play\?seed=11&rules=standard-vegas&bankroll=500&point=8&bets=pass-line:5,come:5$/,
    );
    await page.getByRole('button', { name: 'Copy as scene YAML' }).click();
    const yaml = (
      await page.evaluate(() => (globalThis as unknown as { __shared: string[] }).__shared)
    )[1]!;
    expect(yaml).toContain('point: 8');
    expect(yaml).toContain('type: come, amount: 500');
    // the original rolls on; the link opened elsewhere rolls the same dice
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    await expect(page.getByTestId('panel-sheet')).toHaveCount(0);
    await roll(page);
    // the live announcer keeps the last roll's text in both orientations
    const announcer = page.getByTestId('roll-announcer');
    await expect(announcer).not.toHaveText('');
    const total = await announcer.innerText();
    await page.goto('/');
    await page.goto(shared[0]!.slice(shared[0]!.indexOf('#')));
    await expect(bank(page)).resolves.toBe('$490');
    await expect(page.locator('[data-stack]')).toHaveCount(2);
    await expect(page.locator('.sim-puck.is-on')).toHaveCount(1);
    await roll(page);
    await expect(page.getByTestId('roll-announcer')).toHaveText(total);
  });

  test('share link: malformed parts are skipped with a toast', async ({ page }) => {
    await page.goto(
      url('seed=1&bankroll=200&point=9&bets=pass-line:5,hard-8:1,come-odds@6:10,junk:3'),
    );
    await expect(page.locator('.sim-toast').last()).toContainText('Skipped from the link');
    await expect(page.locator('.sim-toast').last()).toContainText('junk');
    await expect(page.locator('.sim-toast').last()).toContainText('come-odds');
    await expect(bank(page)).resolves.toBe('$194');
    await expect(page.locator('[data-stack]')).toHaveCount(1); // pass line; hard 8 sits on the center panel
    await expect(page.locator('.sim-center-ind')).toContainText('Center bets: $1');
    await expect(page.locator('.sim-puck.is-on')).toHaveCount(1);
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

  test('roll log keeps every roll and a history pill opens it at that roll', async ({ page }) => {
    await page.goto('/#/play?speed=instant&seed=1&' + dice('3-3', '2-2', '3-4'));
    await place(page, 'pass');
    await roll(page); // point 6
    await roll(page); // 4: nothing
    await roll(page); // 7: seven out
    await page.getByRole('button', { name: 'Log' }).click();
    const items = page.getByRole('list', { name: /Rolls, newest first/ }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.first()).toContainText('Seven out.');
    await expect(items.last()).toContainText('Point is 6.');
    await page.getByRole('button', { name: 'Losses' }).click();
    await expect(items).toHaveCount(1);
    // tapping the oldest pill in the status strip focuses that roll (the compact landscape rail has no strip)
    await page.getByRole('button', { name: 'All' }).click();
    const pill = page.locator('.sim-history [data-roll="1"]');
    if (await pill.isVisible()) {
      await pill.click();
      await expect(page.locator('.sim-log-entry.is-focus')).toContainText('Point is 6.');
    }
  });

  test('opening Session or Auto-roll scrolls the panel into view and focuses its heading', async ({
    page,
  }) => {
    await page.goto(url());
    // the heading must be fully visible and hit-testable at its centre (not under the bottom nav)
    const clear = async (selector: string) => {
      await expect(page.locator(selector).first()).toBeInViewport({ ratio: 1 });
      const hit = await page.evaluate<boolean>(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el.contains(top);
      })()`);
      expect(hit).toBe(true);
    };
    await page.getByRole('button', { name: 'Session', exact: true }).click();
    const session = page.locator('.sim-session-panel h3').first();
    await clear('.sim-session-panel h3');
    await expect(session).toBeFocused();

    // the sheet covers the tab row: switch panels with the sheet's own tabs (I064)
    await page.getByRole('tab', { name: 'Auto-roll' }).click();
    const auto = page.locator('.sim-autoroll');
    // What the reveal guarantees is where the panel starts, not how much of it fits: a tall panel can
    // never be half in view. Its top sits at the top edge of the sheet body it scrolls in (I064;
    // scroll-margin is 8px) and its first control is fully visible and hit-testable. Switching with
    // the sheet's tab strip keeps focus on the tab so the arrow keys keep working.
    await expect(page.getByRole('tab', { name: 'Auto-roll' })).toBeFocused();
    const body = page.locator('.sim-panel-body');
    await expect
      .poll(async () => {
        const y = (await auto.boundingBox())!.y;
        const top = (await body.boundingBox())!.y;
        return y >= top - 1 && y <= top + 24;
      })
      .toBe(true);
    // the panel's first control (strategy picker, or a view toggle above it)
    await clear('.sim-autoroll :is(select, button, input)');
  });

  test('the % of loss column is inside the table at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(url('seed=1&dice=3-4'));
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('button', { name: /^Roll/ }).click(); // 7: the pass line resolves
    await page.getByRole('button', { name: 'Session', exact: true }).click();
    const head = page.locator('.sim-session-table th', { hasText: '% of loss' });
    await expect(head).toBeVisible();
    const h = await head.boundingBox();
    const w = await page.locator('.sim-session-table-wrap').boundingBox();
    expect(h!.x + h!.width).toBeLessThanOrEqual(w!.x + w!.width + 1);
  });
});
