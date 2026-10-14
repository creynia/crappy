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
