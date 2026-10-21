import { expect, test as base, type Page } from '@playwright/test';

export { expect };
export type { Page };

export interface Guard {
  /** Assert no horizontal overflow and no console errors so far, labelled with the state name. */
  check(state: string): Promise<void>;
}

interface GuardFixtures {
  guard: Guard;
  /** Console or page errors matching any of these patterns are ignored (document each one where used). */
  guardIgnore: RegExp[];
}

/**
 * Every test that imports `test` from here gets a guard: console and page errors are recorded from
 * the start of the test, and any that remain unignored at the end of the test fail it. Call
 * `guard.check(state)` at each state to also assert no horizontal overflow there.
 */
export const test = base.extend<GuardFixtures>({
  guardIgnore: [[], { option: true }],
  guard: [
    async ({ page, guardIgnore }, use) => {
      const errors: string[] = [];
      const unignored = () => errors.filter((e) => !guardIgnore.some((re) => re.test(e)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use({
        async check(state: string) {
          const [scroll, client] = await page.evaluate<[number, number]>(
            '[document.documentElement.scrollWidth, document.documentElement.clientWidth]',
          );
          expect(
            scroll,
            `${state}: horizontal overflow (scrollWidth ${scroll} > clientWidth ${client})`,
          ).toBeLessThanOrEqual(client);
          expect(unignored(), `${state}: console errors`).toEqual([]);
        },
      });
      expect(unignored(), 'console errors during the test').toEqual([]);
    },
    { auto: true },
  ],
});
