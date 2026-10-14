# Orchestrator decisions (authoritative where design docs disagree)

This file reconciles `architecture.md`, `simulator.md` and `curriculum.md` and
records the product owner's answers. If a design doc conflicts with this file,
this file wins.

## Source layout

- The simulator lives under **`src/sim/**`** exactly as laid out in
  `simulator.md` (`src/sim/engine`, `src/sim/math`, `src/sim/strategy`,
  `src/sim/ui`, `src/sim/scene`, public API `src/sim/index.ts`).
  This replaces `src/engine/**` and `src/sim-ui/**` from `architecture.md`.
- Simulator unit tests are colocated (`src/sim/**/*.test.ts(x)`) as in
  `simulator.md`. Everything else uses `tests/**` as in `architecture.md`.
  Vitest includes both globs.
- E2E specs live in `tests/e2e/**` (not `e2e/`).
- App, content pipeline, PWA, build scripts and CI follow `architecture.md`.
- Import rules: `src/sim/engine` ← nothing; `src/sim/math` ← engine;
  `src/sim/strategy` ← engine, math; `src/sim/ui`/`scene` ← engine, math,
  strategy; `src/content` ← `src/sim` (types, bet registry, `validateScene`);
  `src/app` ← everything.

## Product owner answers

| Topic | Decision |
| --- | --- |
| Lesson tone | Friendly prose; collapsible "Show the math" blocks |
| Perfect strategy | Three separate chapters: pure lowest edge, practical, fun-per-dollar |
| Default rules | Standard Vegas: 3-4-5x odds, Field 2x on 2 and 12, buy/lay 5% vig on win only, lay odds 6x flat; presets: Field 3x-12, 10x, 100x |
| Vig rounding | Casino style: 5% rounded down to whole dollars, $1 minimum |
| Bonus side bets (Fire, ATS) | Mentioned in the sucker-bets lesson only; not simulated in v1 |
| World/Whirl | Included as bet id `world` |
| Etiquette | One short lesson near the end + tips sprinkled through |
| Bad bets in sandbox | Allowed; red tier warning + suggested better alternative |
| Pacing | ~1s animations, tap to skip, fast mode, auto-roll with bankroll chart |
| Winning bets | Real-table behavior (place/buy/lay/hard/big & flat line bets stay up; come, odds, field, props come down with Rebet) |
| Center props on portrait | "Center" tab swaps to a full-width props panel |
| Sound | Not in v1 — tracked as a future chip in `docs/chips.md` |
| First viewing | Claude Artifact of the single-file build, then GitHub Pages |
| Lesson gating | All lessons open; "Continue" goes to next unfinished |
| License | MIT |
| Repo visibility | Public (already) |

## Reconciling curriculum.md with simulator.md

- **Bet ids**: the engine ids in `simulator.md` §1.2 are canonical
  (`aces-2`, `ace-deuce-3`, `boxcars-12`, …). The registry is **extended with
  `buy-5`, `buy-6`, `buy-8`, `buy-9`, `lay-5`, `lay-6`, `lay-8`, `lay-9`**
  (buy pays true odds 3:2 / 6:5, lay pays 2:3 / 5:6, vig as for 4/10).
  **No hop bets** in v1 (mentioned in lesson text only; add as a chip).
  Content must use canonical ids; a content test rejects unknown ids.
- **Vig rounding**: casino style (`floor-dollar-min-1`), per the product owner.
  Curriculum text claiming "exactly 5%, no rounding" must be rewritten to match:
  the simulator rounds like a real casino, and the lesson explains why you buy
  in $20 units. Edge tables quote the 5%-of-$20-unit numbers (4.76% buy,
  2.44% lay-4 at $40, etc.).
- **Content format**: lessons are Markdown with `:::math Title` … `:::` and
  `:::tip` … `:::` containers, and ` ```scene ` / ` ```quiz ` fenced **YAML**
  blocks (the `yaml` npm package parses them at build time). This replaces the
  fenced-JSON directives in `architecture.md` §4.
- **Scene blocks** are written in the `SceneConfig` shape from `simulator.md`
  §4.1 (money in **cents**, `rules` preset ids `standard-vegas`, `field-3x-12`,
  `odds-10x`, `odds-100x`). The curriculum's informal scene YAML is converted to
  that shape by the content-authoring agents. Each scene is checked with
  `validateScene` in a content test.
- **Strategy ids**: `simulator.md` §2.5 ids are canonical
  (`pass-max-odds`, `dont-pass-max-lay`, `three-point-molly`, `place-6-8`,
  `iron-cross`, `field-every-roll`, …).
- **Curriculum-requested sim features**:
  - Strategy comparison on the same dice: **in v1** (`autoRoll.compareMode`;
    compared strategies share the seed).
  - Survival / multi-session chart: **in v1** via `simulateMany`
    (p10/p50/p90 bands + bust rate).
  - "Call the bet" mode and "plan panel": **cut from v1**, tracked as chips;
    lessons must read fine without them.
- **Red-tier bets** need a second tap to confirm in the sandbox (curriculum §6).
