# crappy

Learn craps from zero to perfect strategy. crappy pairs short, friendly lessons with an interactive table simulator that shows the expected value of every bet before you make it. It runs in your browser, installs on your phone, and works offline.

<!-- screenshot placeholder: docs/screenshots/ -->

## Use it

- **Open it:** <https://creynia.com/crappy/> (direct file download: <https://creynia.com/crappy/crappy.html>)
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

### Static pages for search engines and LLMs

The app uses hash routes (`#/learn/pass-line`), which crawlers ignore. So the normal build (`dist/`, not the single file) also writes plain, JavaScript-free pages from the same content, each with a button into the app:

| URL (under https://creynia.com/crappy/)                             | Source                                                                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `learn/` and `learn/<lessonId>/`                                    | `content/chapters.json`, `content/lessons/*.md` (practice scenes become a "try this in the app" note; quizzes show their answer in a collapsed box)                                                          |
| `bets/` and `bets/<betId>/`                                         | `content/bets.json` plus the payout and house edge from the math module (same as the app's Bets screen)                                                                                                      |
| `glossary/` (one `#<slug>` anchor per term)                         | `content/glossary.json`                                                                                                                                                                                      |
| `best-and-worst-bets/`, `odds-bet-house-edge/`, `dice-probability/` | Question pages ("best bets in craps", "3-4-5x odds", "craps dice probability"): every number is computed at build time by the engine and math modules (`src/sim/math`, `src/app/bets.ts`, `passMaxOddsEdge`) |
| `sitemap.xml`, `llms.txt`, `llms-full.txt`                          | all of the above                                                                                                                                                                                             |

The generator is [`build/static-site.ts`](build/static-site.ts) (wired in by `build/vite-plugin-static.ts`, which also adds the canonical link and a `<noscript>` block to the app shell). The service worker never precaches these files and never answers them with the app shell. `tests/build/static-site.test.ts` checks every page (one h1, title, description, canonical, JSON-LD) and that the sitemap matches the pages; it also pins the question pages' key figures to the math module and checks each page's "Related" block (3 to 5 links chosen from the lesson, bet and topic data). After each deploy from `main`, the Pages workflow submits the sitemap URLs to IndexNow (`scripts/indexnow.mjs`).

Design documents are in [`docs/design/`](docs/design/). Planned future work is listed in [`docs/chips.md`](docs/chips.md). See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

## License

[MIT](LICENSE)
