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
