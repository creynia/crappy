import { expect, type Page } from '@playwright/test';

export interface PageGuard {
  /** Assert no horizontal overflow and no console errors so far, labelled with the state name. */
  check(state: string): Promise<void>;
}

/**
 * Watches a page from the start of a test. Call once right after the page fixture is available,
 * before navigating, then call `check(state)` at each state the test reaches.
 */
export function watchPage(page: Page): PageGuard {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return {
    async check(state: string) {
      const [scroll, client] = await page.evaluate<[number, number]>(
        '[document.documentElement.scrollWidth, document.documentElement.clientWidth]',
      );
      expect(
        scroll,
        `${state}: horizontal overflow (scrollWidth ${scroll} > clientWidth ${client})`,
      ).toBeLessThanOrEqual(client);
      expect(errors, `${state}: console errors`).toEqual([]);
    },
  };
}
