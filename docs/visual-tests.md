# Visual regression tests

`tests/e2e/visual.spec.ts` captures deterministic states (seed 7, `speed=instant`,
reduced motion, animations and transitions off) with `toHaveScreenshot`:
portrait/landscape table, dark mode, good/avoid sheets, Why? grid, center tab,
auto-roll chart and a lesson scene. Chromium only, `maxDiffPixelRatio` 0.02.

- The `visual` Playwright project is opt-in (`VISUAL=1`), so `npm run test:e2e`
  and the required CI jobs never run it. CI has an advisory `visual` job
  (`continue-on-error`) that does.
- With no committed baselines the CI job writes them and uploads them as the `visual-report` artifact for review. Baselines live in `tests/e2e/__screenshots__/`. Pixels vary with OS and fonts,
  so generate baselines on the CI image (Linux) before committing them.
- Refresh baselines: `VISUAL=1 npx playwright test --project=visual --update-snapshots`.
- `npm run screenshots` does the same and also rewrites the `docs/screenshots/`
  files that share these fixtures.
