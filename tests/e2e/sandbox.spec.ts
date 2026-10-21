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

  test('auto-roll 100 rolls in fast mode renders the chart', async ({ page, guard }) => {
    await page.goto('/#/play?speed=fast');
    await page.getByRole('button', { name: 'Auto-roll' }).click();
    const panel = page.locator('.sim-auto');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /^Auto-roll 100$/ }).click();
    await expect(panel.getByRole('img').first()).toBeVisible({ timeout: 15_000 });
    await guard.check('auto-roll-done');
  });

  test('sandbox state persists across reload', async ({ page, guard }) => {
    await page.goto(url());
    await page.locator('[data-region="pass"]').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
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
    await menu(page).click();
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
});
