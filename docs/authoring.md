# Authoring lessons

Content lives in `content/` and is compiled at build time into the `virtual:content` module
(`build/vite-plugin-content.ts`, using `src/content/compile.ts`). `npm test` validates all of it.

## Files

| File | Purpose |
| --- | --- |
| `content/chapters.json` | Ordered `[{ id, title, summary, lessons: [lessonId, ...] }]`. Every lesson file must be listed in exactly one chapter. |
| `content/lessons/NN-<lessonId>.md` | One lesson. The id in the front matter must equal the slug in the file name. |
| `content/glossary.json` | `[{ term, slug, definition (markdown), see?: [slug] }]` |
| `content/bets.json` | One entry for every bet id (and no others): `{ summary, howItWorks (markdown), verdict, lessonId? }`. `verdict` is a fallback tier: `free\|good\|fair\|poor\|avoid`. The live tier and the edge shown in the app come from the math module. |
| `content/_sample-*` | Placeholders, used only while the real `chapters.json` / `glossary.json` / `bets.json` are missing. Files starting with `_` in `lessons/` are skipped in builds unless the real chapters file is missing; tests always check them. |

## Lesson format

```markdown
---
id: pass-line
title: The Pass Line
summary: The one bet every craps player should know.
minutes: 6
---

Friendly prose in **Markdown**. Link glossary terms with [[point]] or [[point|the point number]].

:::tip
A short callout (etiquette, practical advice).
:::

:::math Why the edge is 1.41%
Collapsed under "Show the math: Why the edge is 1.41%". The lesson must read fine without it.
:::

```scene
id: l04-s1
version: 1
title: Bet the Pass Line
bankroll: 50000          # cents
rules: standard-vegas    # or field-3x-12, odds-10x, odds-100x
allowedBets: [pass-line]
highlightedBets: [pass-line]
steps: [...]             # guided steps, see docs/design/simulator.md section 4
```

```quiz
- q: On the come-out you roll a 7. What happens to a Pass Line bet?
  options: ["It wins", "It loses", "Nothing"]
  answer: 0              # 0-based index into options
  explain: "A 7 or 11 on the come-out is a natural."
```
```

Rules:

- `scene` blocks are `SceneConfig` YAML (money in cents, canonical bet ids from `src/sim/engine/bets.ts`).
  They are checked with `validateScene`; a bad scene fails the build with the file name.
  Scene ids must be unique inside a lesson.
- A step's `completeWhen` is a condition. Kinds: `all`, `any`, `not` (nest freely); `action` (with
  `count`); `event` (with `betType`, `count`); `rolls`; `phase`; `point`; `betOnTable`
  (`type`, optional `minAmount` and `point`, e.g. a come bet travelled to 6); `betResolved`
  (`type`, optional `result`: `won`, `lost` or `pushed`; `pushed` is a push such as a dont-pass bet on
  12, not odds returned when they are off; a win on a standing bet such as a come bet counts as
  resolved on that roll, so `won` means the bet paid); `bankrollAtLeast` / `bankrollAtMost`;
  `equityAtLeast` / `equityAtMost` (equity is bankroll plus chips on the table); `previewed`;
  `autoRollCompleted`; `acknowledged`.
- Example, a come bet that travels to 6 and then wins (two steps; the second waits for the win):

  ```yaml
  steps:
    - id: travel
      text: Place a $5 come bet. The next roll moves it to 6.
      completeWhen: { betOnTable: { type: come, point: 6 } }
    - id: win
      text: Roll the 6 to win the come bet.
      completeWhen: { betResolved: { type: come, result: won } }
  ```

- A condition that is already true when a step starts completes that step at once. Equity does not
  change when a bet is placed, so wait for a roll (for example `forcedDice` that loses) before
  testing equity.
- A **demo step** has `play: [{ action, say?, pauseMs? }]` (1-30 frames). When the step starts, the
  actions are played one at a time (bets, and rolls with `dice: [a, b]`) with `say` shown as a caption,
  then control is handed back; the learner can tap to skip to the end or press Replay. Scripted actions
  skip the step's `allowedActions` gate, and instant speed (reduced motion) plays them all at once.
  `validateScene` replays each script from the scene start plus that step's `setup` and reports an
  illegal frame with the step id, so give a demo step the `setup` it needs and complete it with
  `acknowledged` (its own actions also count toward `completeWhen`).
- Quiz `q`, `options` and `explain` are plain text (not Markdown); HTML is escaped, not rendered.
- Headings: write `##` (or any level); the compiler shifts the lesson's headings so the shallowest becomes an `<h2>` under the page's `<h1>`.
- `quiz` blocks are a YAML list of `{ id?, q, options, answer, explain }`. The id defaults to
  `<lessonId>-q<n>` (1-based across the lesson); progress is stored under that id, so do not reorder
  questions in a published lesson without giving them explicit ids. Need 2+ distinct options.
- Containers are `:::math Title` (title required) and `:::tip`, closed by a line with only `:::`.
  Any other `:::name` is an error. Inside code fences, `:::` is plain text.
- Unknown `[[term]]` is an error. Glossary `see` entries must be existing slugs.
- Raw HTML in Markdown is passed through; keep it to repo-trusted content.

## Checking your work

```
npm test -- tests/content   # parse + validation
npm run dev                 # live reload on content changes
```
