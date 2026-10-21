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
| Crapless craps | **Simulated** (I036, approved 2026-10-21): rules `variant: 'crapless'` via preset `crapless` (Rules menu, `?rules=crapless`). Come-out: 7 wins, nothing loses, 2/3/4/5/6/8/9/10/11/12 are points. Odds pay 6:1 on 2/12 and 3:1 on 3/11, capped at 1x on 2/12 and 2x on 3/11 (with 3-4-5x elsewhere a max-odds win is 6x the flat on every point). Place 2/12 pay 11:2, place 3/11 pay 11:4. No don't side and no Fire Bet (validation `unknown-bet`); All/Tall/Small stay. Bet ids `place-2`, `place-3`, `place-11`, `place-12` live in `CRAPLESS_BET_TYPE_IDS`, outside the 42-bet `BET_TYPE_IDS` catalogue. Pass/Come edge 373/6930 (5.38%) |
| Vig rounding | Casino style: 5% rounded down to whole dollars, $1 minimum |
| Bonus side bets (Fire, ATS) | **Simulated** (I037, approved 2026-10-21; supersedes "lesson text only"): bet ids `fire`, `all`, `tall`, `small`, category `bonus`, placeable only before a new shooter's first roll, never removable, prop minimum; Fire 24/249/999 to 1, All/Tall/Small 175/34/34 to 1; exact math in `src/sim/math/bonus.ts`. Taught in the sucker-bets lesson |
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
  **No hop bets** in v1 (mentioned in lesson text only; add as a chip). Shipped as
  a chip (I035): bet id `hop` with a `hop: [die, die]` pair on the bet, the place-bet
  action and scene BetInit / ActionMatcher (easy 15:1, hard 30:1).
  Content must use canonical ids; a content test rejects unknown ids.
- **Vig rounding**: casino style (`floor-dollar-min-1`), per the product owner,
  vig charged **on win** by default. Curriculum text claiming "exactly 5%, no
  rounding" must be rewritten: the simulator rounds like a real casino, and the
  lesson teaches "buy for **$20 or more**" (at $20–$39 the vig is $1; e.g.
  buy-4 $25 → 1.33%). Reference figures at full-vig-efficient amounts, vig on win:
  buy-4/10 $20 → **1/60 = 1.667%**; buy-5/9 $20 → 1/50 = 2.00% (per roll 1/180),
  pays +$30 − $1 = +$29; buy-6/8 $20 → 1/44 = 2.27% (per roll 1/144), pays +$23;
  lay-4/10 $40 → 1/60 = 1.667%; lay-5/9 $30 → 1/50; lay-6/8 $24 → 1/44
  (each lay wins +$20 − $1 = +$19). Full-pay units (no short pay): buy-5/9 $2,
  buy-6/8 $5, lay-5/9 $3, lay-6/8 $6, place-4/10 $5, place-5/9 $5, place-6/8 $6.
  With the `upfront` vig variant the edge base is **bet + vig**: buy 1/21 = 4.76%,
  lay-4 1/41 = 2.44%, lay-5 1/31 = 3.23%, lay-6 1/25 = 4.00%.
  `suggestAmount` bumps buy bets to at least $20 and lay bets to at least
  $40 (4/10), $30 (5/9), $24 (6/8) so the vig rounding doesn't wipe out the benefit.
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

## Design review round 1 (PR #1) — resolutions

- **EV tiers** (one scheme everywhere; replaces simulator.md's 4 tiers and
  architecture.md's `best|ok|avoid`). Type: `EdgeTier = 'free' | 'good' | 'fair' | 'poor' | 'avoid'`.
  By edge per bet resolved `e`: `free` e ≤ 0 (blue/teal "Free bet");
  `good` 0 < e ≤ 2.0% (green "Good bet"); `fair` 2.0% < e ≤ 5.0% (yellow "Fair");
  `poor` 5.0% < e < 9.0% (orange "Costly"); `avoid` e ≥ 9.0% (red "Sucker bet").
  Removing a bet that gives up EV is shown as `avoid`. Only `avoid` needs the
  second "Place anyway" tap (Settings can turn that off). Text label always accompanies colour.
- **Alternatives**: curriculum.md §6.3 table is canonical (learner copy wins);
  simulator's "add odds first" rule stays. Add entries for buy-6/8 → place,
  lay-5..9 → dont-come + lay odds.
- **Hardways** use `propMin` ($1), not `tableMin`.
- **Short-pay warnings** cover every bet with a full-pay unit (list above). The
  warning states the actual payout, e.g. "$5 on the 6 pays $5.83 here; most casinos pay $5 — bet in $6 units."
  (Sim default `payoutUnit` stays as in simulator.md.)
- **Steps**: the sim scene runner (`src/sim/scene`, `SceneConfig.steps` /
  `completeWhen`) owns guided steps. The app's `LessonScene` only renders
  `<Simulator scene onEvent>` and persists progress from `step-completed` /
  `scene-completed` events. API names: `Simulator`, `SimulatorEvent`,
  `validateScene` (not `SimTable`/`SimEvent`/`validateSceneConfig`).
- **Quiz schema**: ```quiz YAML is a list of `{ id?, q, options: string[], answer: number (0-based), explain }`;
  default id `<lessonId>-q<n>` (1-based). Progress is keyed by that id.
- **Speed setting**: `animationSpeed: 'normal' | 'fast' | 'instant'` (+ OS reduced motion
  forces `instant`). Settings also has "Rolls per hour" (default 100) used by per-hour EV lines,
  and "Confirm sucker bets" (default on).
- **Lesson features requested by the curriculum** — in v1:
  - Totals tally/histogram (no-bet auto-roll; strategy id `no-bet`) — strategy agent.
  - Session panel (§6.4: total bet, expected, actual, luck, edge per $, per-bet
    breakdown) — container agent, using engine stats.
  - Auto-roll of the user's current layout with re-bet each roll — strategy id `my-layout`.
  - `martingale-pass` strategy (myths lesson; double after loss, reset after win, cap at table max/bankroll).
  - Multi-session runs (`repeat`) via `simulateMany`; charts: running result, session results, survival.
  - Strategies take `oddsMultiple` (0 = flat). Lessons map: "pass + max odds" → `pass-max-odds`;
    flat pass → `pass-max-odds` with `oddsMultiple: 0`; Molly in lesson 20 uses max odds.
  - Cut (lessons must not depend on them): drag-to-preview (use tap → sheet), challenge mode,
    "call the bet" mode, session plan panel. The latter two are chips.
- **Teaching fixes for content agents**: Pass+odds vs DP+lay odds are *not*
  mirror images (only the flat bets are); the hourly cost difference is
  **$0.15/hour** ($4.19 − $4.04); remove all "checkpoint unlocks" wording
  (all lessons open); use canonical rule preset ids; sound is not in v1.
