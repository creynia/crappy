# crappy

Learn craps from zero to perfect strategy. crappy pairs short, friendly lessons with an interactive table simulator that shows the expected value of every bet before you make it. It runs in your browser, installs on your phone, and works offline.

<!-- screenshot placeholder: docs/screenshots/ -->

## Use it

- **Open it:** <https://creynia.github.io/crappy/> (direct file download: <https://creynia.github.io/crappy/crappy.html>)
- **Install it as an app (Android/Chrome):** open the link above, tap the Chrome menu (three dots), then **Add to Home screen** (or **Install app**). It then launches full screen and works offline.
- **Download one offline file:** go to this repo's **Releases**, open **Latest build** and download `crappy.html`. Open it in Chrome from your Downloads list. It has no external requests at all. Progress in this copy is separate from the website copy, so use Settings, then Export/Import to move it.

### One-time setup (maintainer, from a phone)

The repo is already public. Use github.com in Chrome (tap the menu and choose **Desktop site** if a tab is hidden):

1. **Settings, Pages, Build and deployment, Source: GitHub Actions.**
2. Run **Deploy to GitHub Pages** again from the **Actions** tab (**Run workflow**), or merge to `main`.

## Features

- Lessons from "what is the table?" to the bets worth making and the ones to skip
- A practice table with real craps rules and payouts
- Expected value, house edge and odds shown for every bet
- Quizzes and a glossary
- Installable and fully offline; no accounts, no tracking, no ads

## Is this gambling advice?

No. crappy is for education. In craps the house always has an edge, and no betting system changes that; the lessons show you which bets cost the least, not how to win. Play money only here. If gambling is causing you or someone you know harm, call **1-800-GAMBLER** (US) or find local resources at your national problem-gambling helpline.

## Development

Requires Node >= 22.12.

```sh
npm ci
npm run dev        # local dev server
npm run check      # lint, typecheck, format check, unit tests
npm run build:all  # dist/ (PWA) and dist-single/crappy.html
npm run test:e2e   # Playwright (needs a browser, see CONTRIBUTING.md)
```

Design documents are in [`docs/design/`](docs/design/). Planned future work is listed in [`docs/chips.md`](docs/chips.md). See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

## License

[MIT](LICENSE)
