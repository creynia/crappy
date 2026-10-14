# crappy — App & Repo Architecture

Status: design spike, ready for implementation. Companion docs:
`docs/design/curriculum.md` (lessons, quizzes, scenes) and
`docs/design/simulator.md` (engine, EV module, SVG table, `SceneConfig`).
Where this doc and the simulator doc overlap, **the simulator doc owns the
internals of `src/engine` and `src/sim-ui`**; this doc owns the boundaries,
the app shell, content pipeline, tooling, CI and delivery.

**The user constraint behind most decisions:** the only device is an Android
phone. Nothing in the deploy or use path may need a computer. The app must
also work fully offline.

---

## 1. Stack decision

| Concern          | Choice                                                     | Pinned version (verified 2026-10-14)    |
| ---------------- | ---------------------------------------------------------- | --------------------------------------- |
| Runtime          | Node 22 (`.nvmrc` = `22`)                                  | 22.22.0 in session                      |
| Bundler          | Vite                                                       | `vite@^8.3.4`                           |
| UI               | Preact + hooks (no router lib, no state lib)               | `preact@^10.29.8`                       |
| JSX plugin       | `@preact/preset-vite`                                      | `^2.10.6`                               |
| Single-file      | `vite-plugin-singlefile`                                   | `^2.3.3`                                |
| Language         | TypeScript, `strict: true`                                 | `typescript@~6.0.3`                     |
| Markdown (build) | `marked` (build-time only, never shipped)                  | `^18.1.1`                               |
| Unit tests       | Vitest (node env for engine/content; `happy-dom` for UI)   | `vitest@^5.0.4`, `happy-dom` latest     |
| E2E              | Playwright Test, Chromium only                             | `@playwright/test@1.56.1` **exact pin** |
| Lint             | ESLint flat config + `typescript-eslint` (see below)        | `eslint@^10`, `typescript-eslint@^8.71` |
| Format           | Prettier                                                   | `prettier@^3`                           |

Decisions and reasons:

- **Preact, not React / Svelte / vanilla.** 4 kB runtime keeps the single
  offline HTML file small; JSX + hooks is familiar to every implementer agent;
  SVG table is just JSX. Do **not** use Preact 11 yet (just released;
  `@preact/preset-vite` is developed against 10.x).
- **TypeScript 6.0, not 7.** `typescript-eslint@8.71` peer-requires
  `typescript <6.1`. TS 7 (native compiler) breaks the lint stack.
- **Vite 8** works with `vite-plugin-singlefile@2.3.3` + Preact preset:
  verified in a scratch build; output is one ~14 kB HTML with an inline
  `<script type="module">`, which runs under `file://` in Chromium 141 and
  `localStorage` works there. Fallback if Rolldown ever misbehaves: `vite@^7`
  (all plugins peer-support 7 and 8).
- **Playwright pinned to exactly `1.56.1`.** The session has browsers
  preinstalled at `/opt/pw-browsers` (`chromium-1194`, which is the revision
  1.56.1 expects). With `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (already
  set in the session) and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` during
  `npm install`, e2e runs locally with no download. CI runs
  `npx playwright install --with-deps chromium`. Bump Playwright only together
  with the session image.
- **No router, no state library, no CSS framework, no charting lib, no
  YAML/MDX/zod.** A 60-line hash router, `useState`/`useReducer` + a tiny
  context store, plain CSS with custom properties, and hand-rolled SVG for the
  table and the bankroll chart. Validation is hand-written TS guards.
- **ESLint:** `eslint.config.js` with `@eslint/js` recommended +
  `typescript-eslint` `recommendedTypeChecked` (scoped to `src/**`, `tests/**`)
  + `eslint-config-prettier`. Skip `eslint-plugin-react-hooks` unless it
  supports ESLint 10 at install time (check `npm view eslint-plugin-react-hooks peerDependencies`).
  Custom rule via `no-restricted-imports`: **`src/engine/**` may not import
  `preact`, `src/sim-ui`, `src/app`, or touch `document`/`window`**.

Total runtime dependencies: **1 (`preact`)**. Everything else is dev-only.

**License: MIT.** It is the most widely recognised permissive license,
needs no explanation to contributors, and GitHub's license picker shows it
clearly. (0BSD is fine too, but MIT is the safe default.) `LICENSE` holds
`Copyright (c) 2026 crappy contributors`.

---

## 2. Delivery to the phone

Four paths, all produced from the same source. Path (d) is the fastest first
look; (a)+(c) is the long-term home; (b) is the "works with no internet ever"
copy.

### (a) GitHub Pages via Actions

- Workflow `.github/workflows/pages.yml` (see §5) builds `dist/` and deploys
  with `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`.
- Trigger: `push` to `main` and `workflow_dispatch` (the "Run workflow"
  button is available in the GitHub mobile **web** UI and the GitHub Android
  app's Actions tab).
- URL: `https://creynia.github.io/crappy/`. Vite `base: './'` (relative), so
  the same build works at any path, including `file://`.
- **One-time settings the user must do** (GitHub in Chrome on the phone; the
  GitHub Android app does not expose repo Settings — use github.com in Chrome
  and, if a tab is hidden, the "⋯" overflow or "Desktop site"):
  1. **Repo must be public.** GitHub Free only serves Pages from public repos
     (private Pages needs Pro/Team). Settings → General → Danger Zone →
     Change visibility → Public.
  2. **Settings → Pages → Build and deployment → Source: "GitHub Actions".**
  3. Merge the work branch into `main` (the `github-pages` environment only
     allows deployment from the default branch by default). The session opens
     a PR; the user taps **Merge** in the GitHub app.
- `actions/configure-pages` with `enablement: true` **does not work with the
  default `GITHUB_TOKEN`** (enabling Pages needs repo-admin rights; it would
  need a PAT stored as a secret, which is fiddly on a phone). Do not rely on
  it. Use `configure-pages@v5` without `enablement`. Alternative the session
  can try for the user: `gh api -X POST repos/creynia/crappy/pages -f build_type=workflow`
  (succeeds only if the session's GitHub credential has admin on the repo;
  if it 403s, fall back to step 2 by hand). If the first deploy runs before
  Pages is enabled, it fails with "Get Pages site failed" — enable, then
  re-run the workflow.

### (b) Single self-contained offline HTML: `crappy.html`

- `npm run build:single` → `vite build --mode single` → `dist-single/crappy.html`.
  `vite-plugin-singlefile` inlines all JS/CSS; the favicon is an inline SVG
  data URI. No external requests at all.
- Mode `single` sets `define: { __SINGLE_FILE__: true }`. In that mode the
  build **omits** the manifest `<link>`, does **not** register a service
  worker, and emits no separate assets. All dynamic imports are inlined
  (plugin default) — do not use `import()` for code splitting anywhere.
- Hash routing (`#/learn/…`) is mandatory: `file://` and `content://` have no
  server rewriting.
- `scripts/finalize-single.mjs` renames `index.html` → `crappy.html` and
  **fails the build** if the HTML contains any `src=`/`href=` that isn't
  `data:`, `#…`, or an absolute `https://` link inside lesson prose. An e2e
  spec opens it via `file://` and plays one roll.
- **Opening it on Android:** download (from a Release, from the Pages site's
  `crappy.html` link, or from the session) → Chrome's **Downloads** list →
  tap the file. Chrome renders it (as a `content://` URI) with JS enabled. If
  a file manager offers "HTML Viewer", choose **Chrome** instead (HTML Viewer
  doesn't run JS). Inline `<script type="module">` is fine under
  `file://`/`content://` — only *external* module scripts are blocked by
  CORS.
- Storage under `file://`/`content://` may be unavailable or partitioned
  (opaque origin). `src/app/storage.ts` must wrap every access in `try/catch`
  and fall back to an in-memory store, showing a one-line banner "Progress
  won't be saved in this copy — use Settings → Export". Settings has
  **Export progress / Import progress** (base64 JSON text the user can copy)
  so progress moves between the file copy and the Pages/PWA copy.
- Pages also serves the file at `https://creynia.github.io/crappy/crappy.html`
  (pages.yml copies it into `dist/`), and Home links to it ("Download offline
  copy") when not in single-file mode.

### (c) PWA installable from the Pages URL

- `public/manifest.webmanifest`: `name: "crappy — learn craps"`,
  `short_name: "crappy"`, `start_url: "./"`, `scope: "./"`,
  `display: "standalone"`, `background_color: "#0b3d2e"`,
  `theme_color: "#0b3d2e"`, icons 192/512 PNG + 512 maskable PNG + SVG.
- **Icons without heavy deps:** `assets/icon.svg` is hand-authored (a die
  showing five pips on felt green). `scripts/gen-icons.mjs` (zero deps) draws
  the same design procedurally (rounded square + circles, 4× supersampled
  antialiasing) and encodes PNGs with `node:zlib` + a 30-line PNG writer,
  emitting `public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (extra safe-zone padding), `apple-touch-icon.png`
  (180). Runs in `predev`/`prebuild`; outputs are gitignored. A unit test
  asserts the PNG signature + IHDR dimensions.
- **Service worker without Workbox:** `src/pwa/sw.ts` is compiled by a small
  Vite plugin `build/vite-plugin-sw.ts` which, in `generateBundle`, emits
  `sw.js` with an injected `PRECACHE = [...all emitted file names, "./"]` and
  `VERSION = <hash of that list>`. Strategy: install → precache everything
  (the whole app is < 1 MB); fetch → cache-first for same-origin GET,
  navigation requests fall back to cached `./index.html`; activate → delete
  old `crappy-*` caches. Update flow: new SW waits; app shows a toast
  "Update available — Reload", which posts `SKIP_WAITING` then reloads.
- Registration (`src/pwa/register.ts`) runs only when
  `!__SINGLE_FILE__ && location.protocol === 'https:'` (or `localhost`), and
  never in dev.
- Install on phone: open the Pages URL in Chrome → menu ⋮ → **Add to Home
  screen / Install app**. Optional in-app "Install" button using
  `beforeinstallprompt` on Home.

### (d) Claude Artifact (instant preview from the session)

The session's Artifact tool can publish `dist-single/crappy.html` as a
private claude.ai page the user opens in the Claude app — no GitHub setup
needed. It is a single file with no external requests, so it fits the
artifact rules (keep the `<title>` "crappy", body background set, dark-mode
tokens on `:root` — which the app does anyway). localStorage works per
artifact origin, but treat it as a preview channel; Pages/PWA is the home.

### Release attachment

`.github/workflows/release.yml` builds `crappy.html` and attaches it to a
GitHub Release so it's a one-tap download in the GitHub app:

- On `push` of tag `v*`: create release `vX.Y.Z` with `crappy.html`
  (`gh release create "$GITHUB_REF_NAME" dist-single/crappy.html --generate-notes`).
- On `push` to `main`: update a rolling pre-release tagged `latest-build`
  (`gh release delete latest-build --cleanup-tag -y || true` then
  `gh release create latest-build --prerelease --target "$GITHUB_SHA" --title "Latest build" dist-single/crappy.html`).
  This means the user never has to create tags on a phone.
- `permissions: contents: write`. Release assets download as
  `application/octet-stream`, so Chrome saves rather than navigates — which
  is what we want.

---

## 3. App structure

### Routes (hash-based)

| Hash                  | Screen         | Notes |
| --------------------- | -------------- | ----- |
| `#/`                  | Home           | Continue button (next incomplete lesson), progress ring, links to Learn/Play/Bets; "Download offline copy" + "Install" when applicable |
| `#/learn`             | Lesson list    | Grouped by chapter (incl. the three "Perfect strategy" chapters: Lowest edge / Practical / Fun-per-dollar); lessons are never locked; status ✓ done / ◐ in progress / ○ new |
| `#/learn/:lessonId`   | Lesson view    | Prose, "Show the math" collapsibles, embedded scenes, quizzes, Prev/Next; `?step=n` not needed — scroll position only |
| `#/play`              | Sandbox        | Full `SimTable` free play: bankroll, all bets, auto-roll N rolls with bankroll chart |
| `#/bets`              | Bet reference  | Table/cheat sheet: bet, pays, true odds, house edge, "good/ok/avoid" badge; sort by edge |
| `#/bets/:betId`       | Bet detail     | Description, payout, edge, link to lesson + "Try it" (opens `#/play?preset=<betId>`) |
| `#/glossary`          | Glossary       | Alphabetical, search box, anchors `#/glossary?term=hardway` |
| `#/settings`          | Settings       | Theme (System/Light/Dark), Animations (On/Off — Off also honored from `prefers-reduced-motion`), Fast mode, starting bankroll, table minimum, Export/Import progress, Reset progress (confirm), About/license/version |
| anything else         | Not found      | Link home |

Lessons are never locked (a learner may skip ahead); "Continue" picks the
first incomplete one.

### Router (`src/app/router.ts`)

`parseHash(hash) → { path: string; params: Record<string,string>; query: URLSearchParams }`,
a `useRoute()` hook subscribing to `hashchange`, `navigate(to)`, and a
`<Link href="#/…">` that is just an `<a>`. Route table in `src/app/routes.tsx`.
Scroll to top on route change, except restore scroll for back navigation into
a lesson (store `scrollY` per hash in `sessionStorage`, try/catch).

### State & storage (`src/app/storage.ts`, `src/app/store.tsx`)

Single key `crappy:v1` in localStorage:

```ts
interface PersistedV1 {
  version: 1;
  lessons: Record<LessonId, {
    startedAt?: number; completedAt?: number;
    quizzes: Record<QuizId, { correct: boolean; attempts: number }>;
    scenes: Record<SceneId, { completed: boolean; step: number }>;
  }>;
  settings: {
    theme: 'system' | 'light' | 'dark';
    animations: boolean;     // default true; forced false if prefers-reduced-motion and user never set it
    fastMode: boolean;       // default false; shortens dice/chip animations ~4x, auto-advances settle
    startingBankroll: number;// default 500
    tableMinimum: number;    // default 10
  };
  sandbox?: unknown;         // opaque snapshot owned by sim-ui (engine GameState JSON)
}
```

- `load()` validates shape, migrates by `version`, falls back to defaults on
  anything malformed (never throws). `save()` debounced 300 ms.
- `StoreProvider` context exposes `progress`, `settings`, and actions
  (`markQuiz`, `markSceneStep`, `completeLesson`, `updateSettings`,
  `exportCode()`, `importCode(s)`, `reset()`).
- A lesson is **complete** when every quiz is answered correctly at least
  once and every scene with `required: true` (default true) is completed.
- Settings flow into the simulator as props (`animations`, `fastMode`) —
  sim-ui never reads storage itself.

### Theming & layout

- `src/app/styles/tokens.css`: CSS custom properties on `:root` —
  `--felt: #0b6e4f`, `--felt-dark: #0b3d2e`, `--rail: #5a3a1e`,
  `--chip-red/blue/green/black/…`, `--gold: #d4af37`, `--bg`, `--surface`,
  `--text`, `--muted`, `--accent`, `--good`, `--warn`, `--bad`. Dark values
  under `@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) {…} }`
  and `:root[data-theme=dark] {…}`. Default look: dark UI chrome with green
  felt accents (dark is the "casino" look; light is available).
- Mobile-first: single column, max content width 42rem, 16px gutters,
  bottom tab bar (Learn · Play · Bets · More) on narrow screens, top nav at
  ≥ 768px. Tap targets ≥ 44px. No horizontal page scroll; the table SVG
  scales to width via `viewBox` (landscape gets a larger table).
- `prefers-reduced-motion` respected by default; Settings can override.
- Fonts: system stack only (offline, zero bytes).

---

## 4. Content delivery

### Authoring format: Markdown + fenced directive blocks

One file per lesson: `content/lessons/<NN>-<slug>.md`. Chapters are defined
in `content/chapters.json` (ordered list: `{ id, title, summary, lessons: LessonId[] }`).
Prose authors (the curriculum spike) write plain Markdown; interactive parts
are fenced code blocks whose info string is a directive and whose body is
JSON (JSON, not YAML, so there's no parser dependency and errors are precise).

````markdown
---
id: pass-line-basics
title: The Pass Line
summary: The one bet every craps player should know.
minutes: 6
---

Friendly prose here…

```math
title: Why the pass line edge is 1.41%
---
Markdown body (shown collapsed under "Show the math"). Supports tables
and inline `code`. Plain text formulas; no TeX renderer.
```

```scene
{ "id": "first-come-out", "title": "Your first come-out roll",
  "preset": { "...": "SceneConfig per docs/design/simulator.md" },
  "steps": [
    { "text": "Tap the Pass Line to bet $10.", "until": { "event": "betPlaced", "betId": "pass", "amount": 10 } },
    { "text": "Now roll the dice.", "until": { "event": "rolled" } }
  ] }
```

```quiz
{ "id": "q-pass-7", "prompt": "On the come-out roll you throw a 7. What happens to a Pass Line bet?",
  "choices": ["It wins", "It loses", "Nothing"], "answer": 0,
  "explain": "A 7 or 11 on the come-out is a natural — Pass wins even money." }
```

```callout
{ "kind": "tip", "text": "Markdown **allowed** here." }
```
````

Directive set (closed list; unknown directive = build error):

| Directive | Body                                                         | Renders as |
| --------- | ------------------------------------------------------------ | ---------- |
| `math`    | `title: …` line, `---`, then Markdown                        | `<details class="math"><summary>Show the math: {title}</summary>…</details>` |
| `scene`   | JSON `LessonScene` (wraps `SceneConfig` + guided `steps`)    | `<LessonScene>` → `<SimTable>` |
| `quiz`    | JSON `Quiz` (`choices` + `answer` index, or `answer: number` with `kind: "number"` for numeric answers; optional `explain`) | `<Quiz>` |
| `callout` | JSON `{ kind: "tip"|"warning"|"myth"|"etiquette", text }`    | styled aside |

Front matter is a tiny `key: value` subset (strings, numbers; values that
start with `[` or `{` are parsed as JSON). Parser lives in
`src/content/frontmatter.ts` (~40 lines) — no gray-matter.

Other content files:
- `content/glossary.json` — `[{ term, slug, definition (markdown), see?: string[] }]`.
- `content/bets.json` — per `BetId`: `{ summary, howItWorks (md), verdict: "best"|"ok"|"avoid", lessonId? }`.
  Numbers (payout, true odds, house edge) are **not** written here — they
  come from the engine's bet registry + EV module so they can never drift.

### Build-time compilation

`build/vite-plugin-content.ts` exposes virtual module `virtual:content`:

```ts
// src/content/types.ts (owned by content WP)
export type Block =
  | { kind: 'html'; html: string }                 // marked output, trusted repo content
  | { kind: 'math'; title: string; html: string }
  | { kind: 'scene'; scene: LessonScene }
  | { kind: 'quiz'; quiz: Quiz }
  | { kind: 'callout'; callout: Callout };
export interface Lesson { id: LessonId; title: string; summary: string; minutes: number; chapterId: string; blocks: Block[] }
export interface ContentBundle { chapters: Chapter[]; lessons: Lesson[]; glossary: GlossaryEntry[]; bets: Record<BetId, BetCopy> }
```

- The compiler is a pure function `compileLesson(source: string, file: string): Lesson`
  in `src/content/compile.ts` (uses `marked.lexer`; `code` tokens with a
  directive lang become blocks, consecutive other tokens are rendered to one
  `html` block). The Vite plugin just reads files, calls it, and emits
  `export default <JSON>`. Same function is used by tests — single source of truth.
- `marked` is a devDependency only; the shipped bundle contains HTML strings.
- Glossary auto-linking: the compiler wraps the first occurrence of a
  glossary term per lesson written as `[[term]]` into `<a href="#/glossary?term=slug">`.
  Unknown `[[term]]` = build error.
- HMR: plugin calls `server.watcher.add('content/**')` and invalidates the
  virtual module.

### Content validation (`tests/content/*.test.ts`, Vitest, node env)

Runs `compileLesson` on every file and asserts:
1. Front matter has `id`, `title`, `summary`, `minutes`; `id` unique and
   matches filename slug; each lesson appears in exactly one chapter;
   every chapter lesson id exists.
2. Every `scene` passes `validateSceneConfig()` exported by `src/sim-ui`
   (which checks bet ids against the engine registry `BETS`, dice presets are
   1–6, bankroll ≥ 0, etc.), scene ids unique within a lesson, every step's
   `until` is a known `SimEvent` matcher and references valid `BetId`s.
3. Every `quiz`: ≥ 2 choices, `answer` in range, no duplicate choices, id unique.
4. `math` blocks have non-empty title + body; `callout.kind` valid.
5. Every `[[term]]` resolves; every glossary `see` resolves.
6. `bets.json` has an entry for **every** `BetId` in the engine registry and
   no extras; every `lessonId` exists.
7. Snapshot-free: no test depends on prose wording.

### Lesson ↔ simulator integration

- `src/sim-ui` exports `<SimTable>` with props
  `{ scene?: SceneConfig; animations: boolean; fastMode: boolean; onEvent?: (e: SimEvent) => void; highlight?: HighlightSpec; controls?: ControlsSpec }`
  and emits a typed `SimEvent` union (at minimum: `betPlaced`, `betRemoved`,
  `rolled`, `betResolved`, `pointSet`, `pointOff`, `sevenOut`, `bankrollChanged`).
  Exact shapes are defined in `docs/design/simulator.md`; this doc only
  requires that the union is exported from `src/sim-ui/index.ts` and is
  serialisable.
- `src/app/lesson/LessonScene.tsx` (app-owned) wraps `<SimTable>`:
  holds `stepIndex`, shows step text in a coach bubble above the table, passes
  the step's optional `highlight` to SimTable, and on each `SimEvent` runs the
  pure matcher `matchStep(step.until, event)` (from `src/content/steps.ts`).
  On match → advance, persist `scenes[id].step`; after the last step → mark
  scene complete, show "Nice — continue reading ↓". A "Reset scene" and
  "Skip step" button are always available (skipping does not count as
  completion; a lesson can still be marked complete manually from its footer).
- Steps may also force dice (`"dice": [3,4]`) for the next roll — passed via
  `SceneConfig`'s scripted-dice facility (owned by simulator spike).
- `LessonScene` mounts the table lazily when scrolled into view
  (IntersectionObserver) to keep long lessons fast on phones.

---

## 5. Repository layout

Ownership tags refer to work packages in §6.

```
crappy/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 [WP5]
│   │   ├── pages.yml              [WP5]
│   │   └── release.yml            [WP5]
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md          [WP5]
│   │   └── lesson_idea.md         [WP5]
│   └── pull_request_template.md   [WP5]
├── assets/
│   └── icon.svg                   [WP0]
├── build/                         # Node-side Vite plugins (not shipped)
│   ├── vite-plugin-content.ts     [WP3]
│   └── vite-plugin-sw.ts          [WP4]
├── content/                       # authored content (curriculum spike → WP3/WP6)
│   ├── chapters.json
│   ├── lessons/NN-slug.md
│   ├── glossary.json
│   └── bets.json
├── docs/
│   ├── design/{architecture,curriculum,simulator}.md
│   └── authoring.md               [WP3] how to write a lesson (directives reference)
├── public/
│   ├── manifest.webmanifest       [WP4]
│   └── icons/                     # generated, gitignored
├── scripts/
│   ├── gen-icons.mjs              [WP4]
│   └── finalize-single.mjs        [WP4]
├── src/
│   ├── main.tsx                   [WP0 stub → WP3]  render(<App/>), registers SW
│   ├── env.d.ts                   [WP0]  __SINGLE_FILE__, __APP_VERSION__, virtual:content types
│   ├── engine/                    [WP1]  pure TS, no DOM — see simulator.md
│   │   ├── index.ts               public API (types, BETS registry, createGame, placeBet, roll, …)
│   │   ├── ev.ts                  house edge / EV per BetId
│   │   └── rng.ts                 seeded RNG
│   ├── sim-ui/                    [WP2]  Preact SVG table — see simulator.md
│   │   ├── index.ts               exports SimTable, SceneConfig, SimEvent, validateSceneConfig, BankrollChart
│   │   ├── SimTable.tsx, Dice.tsx, Chips.tsx, BetSpot.tsx, AutoRoll.tsx, BankrollChart.tsx
│   │   └── sim.css
│   ├── content/                   [WP3]  types + compiler (pure, node-safe)
│   │   ├── types.ts, compile.ts, frontmatter.ts, steps.ts
│   │   └── index.ts               re-exports bundle from virtual:content
│   ├── app/                       [WP3]
│   │   ├── App.tsx, routes.tsx, router.ts, store.tsx, storage.ts
│   │   ├── screens/ Home.tsx LessonList.tsx LessonView.tsx Sandbox.tsx BetReference.tsx BetDetail.tsx Glossary.tsx Settings.tsx NotFound.tsx
│   │   ├── lesson/ Blocks.tsx LessonScene.tsx Quiz.tsx MathDetails.tsx Callout.tsx
│   │   ├── components/ TabBar.tsx Header.tsx ProgressRing.tsx Toast.tsx
│   │   └── styles/ tokens.css base.css layout.css
│   └── pwa/                       [WP4]
│       ├── sw.ts
│       └── register.ts
├── tests/
│   ├── engine/      [WP1]   ├── sim-ui/   [WP2]
│   ├── content/     [WP3]   ├── app/      [WP3]  (router, storage, store)
│   ├── build/       [WP4]   (icons PNG header, single-file has no external refs)
│   └── e2e/         [WP6]   *.spec.ts
├── index.html                     [WP0]
├── vite.config.ts                 [WP0; WP3/WP4 add their plugin lines]
├── vitest.config.ts               [WP0]
├── playwright.config.ts           [WP0 stub → WP6]
├── tsconfig.json                  [WP0]  (app, strict, noUncheckedIndexedAccess, jsx: react-jsx, jsxImportSource: preact)
├── tsconfig.node.json             [WP0]  (build/, scripts/, configs)
├── eslint.config.js               [WP0]
├── .prettierrc.json               [WP0]  { "singleQuote": true, "printWidth": 100 }
├── .prettierignore, .editorconfig, .gitignore, .nvmrc  [WP0]
├── package.json, package-lock.json [WP0]  (deps added later only by WP owner, see §6 rules)
├── LICENSE (MIT)                  [WP0]
├── README.md                      [WP5]
├── CONTRIBUTING.md                [WP5]
└── CODE_OF_CONDUCT.md             [WP5]  Contributor Covenant 2.1, by reference link
```

`.gitignore`: `node_modules/ dist/ dist-single/ public/icons/ test-results/ playwright-report/ coverage/ *.log .DS_Store`.
`.editorconfig`: utf-8, lf, 2-space, final newline, trim trailing whitespace (not for `*.md`).
`.nvmrc`: `22`.

### package.json

```json
{
  "name": "crappy",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "predev": "node scripts/gen-icons.mjs",
    "dev": "vite",
    "prebuild": "node scripts/gen-icons.mjs",
    "build": "tsc -b && vite build",
    "build:single": "vite build --mode single && node scripts/finalize-single.mjs",
    "build:all": "npm run build && npm run build:single && cp dist-single/crappy.html dist/crappy.html",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "npm run lint && npm run typecheck && npm run format:check && npm test"
  }
}
```

(`tsc -b` uses project references: `tsconfig.json` references
`tsconfig.app.json` + `tsconfig.node.json`; if references get awkward, drop
`-b` and run `tsc -p` on each — implementer's call, keep `typecheck` green.)

`vite.config.ts` shape:

```ts
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    define: { __SINGLE_FILE__: single, __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [preact(), contentPlugin(), ...(single ? [viteSingleFile()] : [swPlugin()])],
    build: { outDir: single ? 'dist-single' : 'dist', target: 'es2022' },
  };
});
```

`index.html` contains `<link rel="manifest">` + apple-touch-icon behind an
HTML transform in `swPlugin` (so single mode never references them).

`playwright.config.ts`: `testDir: tests/e2e`, one project `chromium` with
`devices['Pixel 7']` viewport (mobile-first) + one `Desktop Chrome`;
`webServer: { command: 'npm run build:all && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }`;
`use.baseURL: 'http://localhost:4173/'`. The single-file spec uses
`page.goto('file://' + path.resolve('dist-single/crappy.html'))`.

`vitest.config.ts`: default `environment: 'node'`; `environmentMatchGlobs`
(or per-file `// @vitest-environment happy-dom`) for `tests/sim-ui` and
`tests/app`. Coverage not required in CI.

### CI workflows

**`ci.yml`** — `on: push (all branches), pull_request`; `concurrency` per ref,
cancel-in-progress.

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run format:check
      - run: npm test
      - run: npm run build:all
      - uses: actions/upload-artifact@v4
        with: { name: crappy-html, path: dist-single/crappy.html }
  e2e:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report }
```

**`pages.yml`** — `on: push: branches [main]` + `workflow_dispatch`;
`permissions: { contents: read, pages: write, id-token: write }`;
`concurrency: { group: pages, cancel-in-progress: false }`.
Job `build`: checkout, setup-node, `npm ci`, `npm run build:all`,
`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3 with path: dist`.
Job `deploy`: `needs: build`, `environment: { name: github-pages, url: ${{ steps.d.outputs.page_url }} }`,
`actions/deploy-pages@v4` (id `d`).

**`release.yml`** — `on: push: tags ['v*'], branches [main]` + `workflow_dispatch`;
`permissions: contents: write`; builds `npm run build:single`, then the two
`gh release` branches from §2 (uses `GH_TOKEN: ${{ github.token }}`).

### CONTRIBUTING.md (WP5) must cover

Prereqs (Node 22), `npm ci`, scripts table, architecture map (link here),
"Writing a lesson" (link `docs/authoring.md`), rule that engine stays pure,
how to run e2e locally (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci`, then
`npx playwright install chromium` or set `PLAYWRIGHT_BROWSERS_PATH`),
Conventional-ish commit messages, every PR must pass `npm run check`.

### README.md (WP5) must cover

One-paragraph pitch, screenshot placeholder, **"Use it" first** (Pages URL,
install as app, download `crappy.html` from Releases → Latest build),
features, "Is this gambling advice?" disclaimer (education only, house always
has an edge, 1-800-GAMBLER / local resources), dev quickstart, license MIT.

---

## 6. Implementation plan (work packages)

Rules for all agents:
- Touch only files your WP owns. Need something from another WP? Code
  against the contract in `src/<area>/index.ts`; if a stub is missing, add a
  `// TODO(WPn)` and tell the coordinator — don't edit their files.
- **Only WP0 runs `npm install`.** WP0 installs the full dependency set
  below up front so later WPs never touch `package.json`/lockfile in
  parallel. If a WP truly needs a new dep, the coordinator adds it serially.
- Every WP finishes with `npm run check` green (lint, typecheck, format, unit).
- Install command in-session: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`.

Full dependency list for WP0:
`dependencies`: `preact@^10.29.8`.
`devDependencies`: `vite@^8.3.4`, `@preact/preset-vite@^2.10.6`,
`vite-plugin-singlefile@^2.3.3`, `typescript@~6.0.3`, `vitest@^5.0.4`,
`happy-dom`, `@playwright/test@1.56.1`, `marked@^18.1.1`, `eslint@^10`,
`@eslint/js`, `typescript-eslint@^8.71.2`, `eslint-config-prettier`,
`globals`, `prettier@^3`, `@types/node@^22`.

### Phase 0 (serial, one agent)

**WP0 — Scaffold & contracts.** Everything tagged [WP0] in §5, plus
**contract stubs** so everyone can compile in parallel:
- `src/engine/index.ts`: exported types and function signatures from
  `docs/design/simulator.md` with `throw new Error('TODO(WP1)')` bodies, and
  a real `BETS`/`BetId` list (copy from simulator doc).
- `src/sim-ui/index.ts`: `SceneConfig`, `SimEvent`, `SimTableProps` types,
  `validateSceneConfig` stub returning `[]`, and a placeholder `SimTable`
  that renders "table coming soon".
- `src/content/types.ts` (full, from §4) and `src/env.d.ts` with
  `declare module 'virtual:content'`.
- `src/main.tsx` rendering "crappy" hello screen.
- One trivial Vitest test and one Playwright smoke test (page title).
Exit: `npm run check`, `npm run build:all`, `npm run test:e2e` all green.

### Phase 1 (parallel, 5 agents)

**WP1 — Engine + EV** (`src/engine/**`, `tests/engine/**`). Internals per
simulator.md. Must stay DOM-free; property tests with seeded RNG (e.g. 1e6
simulated rolls converge to analytic EV within tolerance — keep runtime < 10 s).

**WP2 — Simulator UI** (`src/sim-ui/**`, `tests/sim-ui/**`). SVG table,
dice/chip animations honoring `animations`/`fastMode` props (skippable by
tap), scripted dice for scenes, `AutoRoll` (N rolls, strategy preset,
speed) + `BankrollChart` (hand-rolled SVG polyline, axes, no lib),
`validateSceneConfig`. Develops against engine stubs/types; integrates when
WP1 lands (WP2 may land after WP1 within phase 1 — coordinate merge order
WP1 → WP2).

**WP3 — App shell + content pipeline** (`src/app/**`, `src/content/**`,
`src/main.tsx`, `build/vite-plugin-content.ts`, `tests/app/**`,
`tests/content/**`, `docs/authoring.md`, `content/` sample: 2 placeholder
lessons + chapters/glossary/bets skeleton). Router, store/storage with
export/import, all screens, theming, lesson block renderer, Quiz,
MathDetails, Callout, LessonScene + step matcher. Uses `SimTable`
placeholder until WP2 lands. Bet reference reads `BETS` + `ev.ts`.

**WP4 — PWA & single-file build** (`build/vite-plugin-sw.ts`, `src/pwa/**`,
`public/manifest.webmanifest`, `scripts/gen-icons.mjs`,
`scripts/finalize-single.mjs`, `tests/build/**`, adding its plugin line to
`vite.config.ts` — the only shared-file edit allowed, a one-line change).

**WP5 — Repo docs & CI** (`.github/**`, `README.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`). Workflows exactly as §5, using the pinned major action versions listed there; keep them simple (no matrix, no custom actions). Verify locally with `npx --yes @action-validator/cli .github/workflows/*.yml` if reachable, otherwise by careful review.

### Phase 2 (after phase 1 merges)

**WP6 — Content authoring** (`content/**`). Convert `docs/design/curriculum.md`
into lesson files; content tests from WP3 must pass. Can be split across
multiple agents **by chapter** (each owns its own lesson files; one agent
owns `chapters.json`, `glossary.json`, `bets.json`).

**WP7 — Integration & e2e** (`tests/e2e/**`, `playwright.config.ts`, small
glue fixes coordinated with owners). Specs:
1. `home.spec`: loads, Continue goes to first lesson.
2. `lesson.spec`: answer a quiz, complete a guided scene (scripted dice),
   lesson shows ✓ in the list after reload (progress persisted).
3. `sandbox.spec`: place pass line, roll, bankroll changes; auto-roll 100
   in fast mode, chart renders.
4. `settings.spec`: dark theme toggle, animations off, export → reset →
   import restores progress.
5. `offline.spec`: PWA — load, wait for SW `ready`, `context.setOffline(true)`, reload, app renders.
6. `single-file.spec`: open `dist-single/crappy.html` via `file://`, navigate
   `#/play`, roll once, no failed network requests.
7. `bets.spec`: reference table lists every engine BetId.

### Phase 3

**WP8 — Polish & ship**: accessibility pass (labels on SVG spots,
focus order, contrast in both themes), bundle-size check (single file
target < 400 kB), merge PR to `main`, verify Pages + `latest-build` release.

Interfaces summary (what each layer may import):

```
engine   ← nothing (pure TS)
sim-ui   ← engine
content  ← engine (types, BETS), sim-ui (types + validateSceneConfig only)
app      ← engine, sim-ui, content, pwa
pwa      ← nothing app-specific
```

---

## 7. How the user views it on the phone

**Right now, no setup (preview):** ask the session to publish the single-file
build as an Artifact; tap the link in the Claude app. Done.

**Permanent web app (once):**
1. In the Claude app, ask: "open a PR to main and give me the link." Open the
   link → **Merge pull request** → Confirm (GitHub app or Chrome).
2. In Chrome go to `github.com/creynia/crappy` → **Settings**
   (if not visible, ⋮ → "Desktop site").
   - General → Danger Zone → **Change visibility → Public** (if private).
   - **Pages** → Build and deployment → Source → **GitHub Actions**.
3. **Actions** tab → "Deploy to Pages" → **Run workflow** (or wait for the
   next push). When it's green, open **https://creynia.github.io/crappy/**.
4. Chrome ⋮ → **Add to Home screen / Install app**. It now opens like an app
   and works offline after the first load.

**Offline file copy:**
1. GitHub app → crappy → **Releases** → "Latest build" → tap **crappy.html**
   (or on the website, tap "Download offline copy").
2. Chrome ⋮ → **Downloads** → tap `crappy.html` → if asked, open with
   **Chrome** (not "HTML Viewer").
3. If progress doesn't stick in this copy, use Settings → Export/Import to
   move it between copies.

**Updating:** every merge to `main` redeploys Pages and refreshes the
"Latest build" release automatically. The installed app shows
"Update available — Reload".
