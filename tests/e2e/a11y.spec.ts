import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages: [string, string][] = [
  ['home', '/'],
  ['lesson', '/#/learn/pass-line'],
  ['sandbox', '/#/play?speed=instant'],
];

for (const [name, path] of pages) {
  test(`a11y: ${name} has no serious violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(500);
    if (name === 'lesson') await page.locator('section.scene').first().scrollIntoViewIfNeeded();
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}
