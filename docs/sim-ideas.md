# crappy simulator enrichment: ranked ideas

> Snapshot of the live idea board (`board.json` + `board.py` claim tool, kept outside the repo during implementation). Statuses here are as of the snapshot time; the board is re-synced by later PRs.

_Auto-generated from board.json by board.py at 2026-10-21 04:33 UTC. Do not edit by hand._

| Rank | ID | Size | Status | Owner | Title | Area | PR |
|---|---|---|---|---|---|---|---|
| 1 | I081 | L | in-progress | opus-1 | Refactor Simulator.tsx into hooks and subcomponents | infra |  |
| 2 | I045 | S | claimed | haiku-1 | Fix horizontal page overflow after auto-roll | ui |  |
| 3 | I001 | S | claimed | haiku-2 | Exact variance / standard deviation per bet in the math module | ev-math |  |
| 4 | I003 | S | in-progress | haiku-3 | Fix combined edge when two Come bets are on the table (chip) | ev-math |  |
| 5 | I002 | S | held |  | Contract-bet sheet: show the bet's current value instead of "Expected loss $0.00" (chip) | ev-math |  |
| 6 | I047 | S | todo |  | E2E guard: no horizontal overflow and no console errors on every route/state | infra |  |
| 7 | I021 | S | held |  | Bet sheet type switcher shows each option's edge (Place 4 6.67% vs Buy 4 1.67%) | ev-math |  |
| 8 | I006 | S | todo |  | Auto-roll: stop-win / stop-loss controls (engine support already exists) | strategy |  |
| 9 | I007 | S | todo |  | Auto-roll: histogram of session results across 100 sessions | strategy |  |
| 10 | I022 | S | held |  | Sandbox nudge: "Odds available — 0% edge" after a point is set | ux |  |
| 11 | I056 | S | todo |  | Single structured live announcement per roll | a11y |  |
| 12 | I018 | S | todo |  | Richer step conditions: bet on a number, bet resolved, equity, luck | scenes |  |
| 13 | I014 | M | held |  | Scene step type: predict-before-roll / in-sim question | scenes |  |
| 14 | I033 | M | held |  | Custom table rules editor (odds, field, vig timing/rounding, put bets, payout unit, working on come-out) | sim-engine |  |
| 15 | I050 | S | held |  | Scroll opened Auto-roll / Session panels into view | ux |  |
| 16 | I038 | S | todo |  | Explain working/off: show "OFF" reason and EV effect when toggling | ux |  |
| 17 | I023 | S | todo |  | Session panel "Where your expected loss came from" + one suggestion | ux |  |
| 18 | I004 | S | todo |  | Bet sheet: "Typical swing" (standard deviation) line next to the expected loss | ev-math |  |
| 19 | I005 | M | held |  | Luck band: is my result normal? (z-score in Session panel and auto-roll summary) | ev-math |  |
| 20 | I009 | M | in-progress | sonnet-1 | Odds-multiple sweep: edge vs swing vs chance of finishing ahead | strategy |  |
| 21 | I025 | L | in-progress | opus-2 | Practice hub: drill framework (route, scoring, streaks, spaced review) | content |  |
| 22 | I028 | M | todo |  | Drill: "Call the bet" — which bets win, lose or stay (chip) | content |  |
| 23 | I030 | M | todo |  | Challenge mode: 300-roll scored session (lowest edge per dollar, no sucker bets) | content |  |
| 24 | I019 | M | in-progress | sonnet-2 | "Why?" 36-dice grid: see winning, losing and neutral combinations for any bet | ev-math |  |
| 25 | I062 | M | held |  | Overlay toasts that never push layout or fall off-screen | ui |  |
| 26 | I082 | M | todo |  | Visual regression tests and scripted screenshots | infra |  |
| 27 | I083 | M | in-progress | sonnet-3 | E2E coverage for sandbox flows | infra |  |
| 28 | I069 | M | held |  | Watch mode: replay an auto-roll run on the table (chip) | ux |  |
| 29 | I071 | M | held |  | Shareable sandbox link (rules, seed, bets, bankroll) | infra |  |
| 30 | I011 | M | held |  | Session plan panel: bankroll, unit, strategy, length → expected loss, bust risk, suggested stop-loss (chip) | strategy |  |
| 31 | I016 | M | held |  | Scene "demo" steps: scripted actions played with narration (watch the dealer) | scenes |  |
| 32 | I015 | M | held |  | Scene callouts: labelled pointers on table regions and chip stacks | scenes |  |
| 33 | I040 | M | todo |  | Analytic strategy comparison table (all presets × lens metrics) in sandbox and lesson 20 | strategy |  |
| 34 | I012 | M | todo |  | More strategy presets: don't-side Molly, buy 4/10, lay 4/10, place-and-press, inside regression, hedge-the-pass | strategy |  |
| 35 | I010 | M | todo |  | Law-of-large-numbers chart: your edge per dollar converging to the house edge | ev-math |  |
| 36 | I020 | M | todo |  | "Why?" probability tree for line and come bets | ev-math |  |
| 37 | I029 | M | todo |  | Drill: "Best move" puzzles graded by EV | content |  |
| 38 | I027 | M | todo |  | Drill: dealer payout math ("$12 on the 6 hits — what do you get?") | content |  |
| 39 | I026 | S | todo |  | Drill: ways and probability flashcards (dice totals, hard vs easy) | content |  |
| 40 | I017 | S | held |  | Live values in step text: {{ev:pass-line}}, {{bankroll}}, {{point}} | scenes |  |
| 41 | I057 | S | todo |  | Bankroll vs bet size warning in auto-roll and sandbox | ev-math |  |
| 42 | I043 | S | held |  | Per-roll vs per-hour vs per-decision toggle on the Roll button cost and sheet | ev-math |  |
| 43 | I034 | S | todo |  | Put bets: EV preview and suggestion when the table allows them | ev-math |  |
| 44 | I044 | S | todo |  | Exact risk of ruin for flat even-money betting (gambler's ruin formula) as a check on the simulation | ev-math |  |
| 45 | I008 | S | todo |  | Auto-roll: shooter hand-length distribution and "points made per hand" | strategy |  |
| 46 | I041 | S | held |  | Bets reference pages: "Try it" opens the sandbox with that bet's sheet | content |  |
| 47 | I042 | S | held |  | Sandbox "Load a situation" presets for practice | scenes |  |
| 48 | I048 | S | todo |  | Stop Roll button height jump when 'Expected cost' appears | ux |  |
| 49 | I052 | S | todo |  | Move focus to page heading on route change | a11y |  |
| 50 | I054 | S | held |  | Keyboard shortcuts and skip-to-Roll in the simulator | a11y |  |
| 51 | I075 | S | held |  | Undo last bet and Clear bets before rolling | ux |  |
| 52 | I073 | S | todo |  | Remember Auto-roll panel choices | infra |  |
| 53 | I060 | S | todo |  | Outcome glyphs for all history pills (color-blind safety) | a11y |  |
| 54 | I059 | S | todo |  | Remove duplicated last-roll display in the status bar | ui |  |
| 55 | I066 | M | todo |  | Animated chip movement: payouts, sweeps and come-bet travel | ui |  |
| 56 | I064 | M | held |  | Bottom sheet for Session / Auto-roll / Menu panels | ux |  |
| 57 | I063 | M | todo |  | Immersive landscape play mode | ux |  |
| 58 | I039 | M | held |  | After a place/buy win: Press / Same / Collect / Take down prompt with EV per choice | ux |  |
| 59 | I032 | M | todo |  | Gambler's-fallacy lab: what happens after a streak? | content |  |
| 60 | I031 | M | todo |  | Generated EV quiz questions from the math engine (endless review) | content |  |
| 61 | I024 | M | held |  | Habits report: track learner decisions in the sandbox and show improvement | ux |  |
| 62 | I061 | M | todo |  | Color-blind and high-contrast table theme | a11y |  |
| 63 | I085 | M | held |  | Screen-reader table summary and bet list view | a11y |  |
| 64 | I084 | S | todo |  | Axe scans of open simulator states | a11y |  |
| 65 | I035 | L | in-progress | opus-3 | Hop bets (easy hop 15:1, hard hop 30:1) with a dice-pair picker (chip) | sim-engine |  |
| 66 | I013 | L | todo |  | Custom strategy builder ("my system") with rule blocks | strategy |  |
| 67 | I065 | M | todo |  | Touch gestures: double-tap to bet, long-press to manage, swipe to dismiss sheet | ux |  |
| 68 | I070 | M | held |  | Hold-to-fast-roll on the table | ux |  |
| 69 | I072 | M | todo |  | Export auto-roll results (CSV/JSON) and copy summary | infra |  |
| 70 | I076 | S | held |  | Starting bankroll choice and rebuy when busted | ux |  |
| 71 | I079 | S | todo |  | Compact bet sheet for repeat bettors | ui |  |
| 72 | I058 | S | held |  | Optional haptics via navigator.vibrate | ux |  |
| 73 | I080 | S | todo |  | Screen Wake Lock during auto-roll/Watch | perf |  |
| 74 | I068 | S | todo |  | Felt texture, rail and table lighting | ui |  |
| 75 | I086 | S | todo |  | Performance budget test for simulation and rendering | perf |  |
| 76 | I074 | M | todo |  | Local session journal | infra |  |
| 77 | I087 | M | held |  | First-visit sandbox coach marks | ux |  |
| 78 | I067 | M | todo |  | Dice throw with deterministic physics-like path | ui |  |
| 79 | I077 | M | todo |  | Sound effects with Web Audio (chip) | ux |  |
| 80 | I078 | S | todo |  | Lesson 20 comparison table as stacked cards on narrow phones (chip) | content |  |
| 81 | I088 | L | todo |  | Realistic layout fidelity: come points, odds and lay positions | ui |  |
| 82 | I036 | L | held |  | PROPOSAL: crapless craps rules variant (2, 3, 11, 12 become points) | sim-engine |  |
| 83 | I037 | L | held |  | PROPOSAL (changes a decision): simulate Fire Bet and All/Tall/Small side bets | sim-engine |  |
| 84 | I046 | L | dropped |  | Refactor Simulator.tsx (1061 lines) into hooks/modules: game+scene state, sheet controller, animation queue, settings/persist | infra |  |
| 85 | I049 | M | dropped |  | Auto-roll Watch mode: replay a short run on the table, roll by roll (chip) | ui |  |
| 86 | I051 | S | dropped |  | Optional Web Audio sound effects (dice, chips), off by default (chip) | ui |  |
| 87 | I053 | S | dropped |  | Lesson 20 comparison table: stacked cards on narrow phones (chip) | content |  |
| 88 | I055 | M | dropped |  | Shareable scene/sandbox state links (seed + rules + bets in the URL) | scenes |  |

## Details

### 1. [I081] Refactor Simulator.tsx into hooks and subcomponents (L)

Simulator.tsx is 1061 lines with ~20 useState/useEffect, menu, controls, sheet model, animation player, scene feed and URL parsing mixed together. Extract: useGameCore (core/feed/doAction), useAnimationPlayer, useSheetModel, useUrlBoot (readUrlParams/parseDice/buildCore), SimControls, SimMenu, SimPanels; keep public API and behavior identical. Accept: Simulator.tsx < 350 lines, no file > 300 new lines, all existing unit + e2e tests pass unchanged, bundle size not larger. Do first: many ideas touch this file. Can split into parallel subtasks per hook.

- 2026-10-21 04:32 claimed by opus-1

### 2. [I045] Fix horizontal page overflow after auto-roll (S)

BUG (observed at 390x844): after any auto-roll the document scrollWidth becomes 551px because BankrollChart's visually-hidden summary <table> uses an inline 'hidden' style (width:1px) that tables ignore. Fix: wrap the table in a div with the .sim-sr class (src/sim/ui/BankrollChart.tsx ~L37 & L370) or apply sr-only to a wrapper. Accept: no horizontal scroll at 390 and 844 widths with chart shown. Tests: e2e asserts document.documentElement.scrollWidth <= clientWidth after auto-roll (sandbox.spec.ts).

- 2026-10-21 04:32 claimed by haiku-1

### 3. [I001] Exact variance / standard deviation per bet in the math module (S)

WHAT: add `betVariance(bet, ctx): Fraction` (cents^2) and `betStdDev(bet, ctx): number` to src/sim/math/ev.ts, computed from the same `distributionFor` rows as betEV (Var = Σ p·net² − EV²), plus `perRollVariance` for one-roll bets. Export from src/sim/math/index.ts and src/sim/index.ts. WHY: the app teaches edge but never variance; every 'luck', 'swing' and 'odds raise variance, not edge' idea needs this number. Prerequisite for luck band, SD line in the sheet and odds sweep. ACCEPTANCE: exact values in a new table in src/sim/math/targets.test.ts: pass-line $1 from come-out Var ≈ 0.9998 (σ≈1.0); field $1 (2x/2x) Var = 1 + ... computed by a reference Fraction loop over 36 outcomes; any-7 $1 4:1 → EV −1/6, Var = (1/6·16 + 5/6·1) − 1/36 = 3.4722…; place-6 $6 conditional on resolution; odds on 4 $1 (2:1) Var = 2 (1/3·4 + 2/3·1 − 0). Monte-Carlo cross-check in the existing MC test style (sample variance within 5%). No UI changes. Pure, no engine changes.

- 2026-10-21 04:32 claimed by haiku-2

### 4. [I003] Fix combined edge when two Come bets are on the table (chip) (S)

WHAT (docs/chips.md 'Combined edge with two Come bets'): `combinedEdge` in src/sim/ui/text.ts (~L134) uses `state.bets.find(b => b.type === flatType)` so with a set-amount on the 2nd Come bet, or odds on Come #2, it uses Come #1's point/amount. Use the managed bet (action.betId for set-amount, action.parentId for odds place-bet) everywhere, including the `parentBet` lookup and `own` filter. WHY: the combined Pass/Come+odds figure is the key 'perfect strategy' number; it must be right for 3-point Molly practice. ACCEPTANCE: new text.test.ts cases: come $10 on 4 and come $10 on 6, adding $50 odds to the 6 → combined edge uses maxOdds[6]=5 (full odds → 0.374%-style figure for 6), not the 4's 3x. set-amount on the 2nd come bet's odds likewise. Move chip to Done.

- 2026-10-21 04:32 claimed by haiku-3

### 5. [I002] Contract-bet sheet: show the bet's current value instead of "Expected loss $0.00" (chip) (S)

WHAT (docs/chips.md 'Contract-bet sheet wording'): when the BetSheet manages a Pass/Come flat bet already on a point (contract bet), replace the EV lines with its current expected value from `betEV({type, amount, point}, {phase:'point', point, rules})`: e.g. 'Pass line on 4: worth -$3.33 right now (wins 1 in 3). It can't come down, so the best move is to add odds (0% edge).' Mirror for DP/DC on a point: 'worth +$3.33; taking it down gives this up'. WHERE: src/sim/ui/BetSheet.tsx (contract branch ~L76-L304), src/sim/ui/text.ts buildEvFacts (skip 'Expected loss on this bet' when contract), Simulator.tsx only to pass the value. WHY: learners see the point-phase value swing (−1/3 on 4/10, −1/5 on 5/9, −1/11 on 6/8) that lesson 11/18 teach. ACCEPTANCE: components.test.tsx: pass $10 on point 4 manage sheet contains 'worth -$3.33'; on 6 '-$0.91'; DP $10 on 4 shows '+$3.33'. No '$0.00' expected-loss line for contract bets. Move the chip to Done in docs/chips.md.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 6. [I047] E2E guard: no horizontal overflow and no console errors on every route/state (S)

Add a shared Playwright helper (tests/e2e/helpers.ts) asserting scrollWidth<=clientWidth and zero console errors; call it in smoke/sandbox/lessons specs for initial, sheet-open, center, auto-roll-done and landscape states. Why: overflow bug above went unnoticed. Accept: helper used in >=5 states x mobile+phone-landscape projects; CI green.

### 7. [I021] Bet sheet type switcher shows each option's edge (Place 4 6.67% vs Buy 4 1.67%) (S)

WHAT: the segmented control in BetSheet over region.betTypes shows a small tier-coloured edge under each option (computed with betEdge for the current amount/ctx), e.g. 'Place 6.67% · Buy 1.67% · Lay 1.67%'. WHERE: Simulator.tsx builds TypeOption (add `edgeText`, `tier`), BetSheet.tsx renders it; text.ts helper. WHY: comparison is how learners internalize 'buy the 4, place the 6'; today you must tap each option to see it. ACCEPTANCE: component test: box-4 sheet shows 6.67% and 1.67% labels; tiers have text labels; disabled options still show edge; no layout overflow at 390px (each label ≤ 6 chars).

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 8. [I006] Auto-roll: stop-win / stop-loss controls (engine support already exists) (S)

WHAT: SessionConfig.stopWin/stopLoss are implemented in src/sim/strategy/simulate.ts but AutoRollPanel has no inputs. Add an optional 'Stop when ahead by $__ / behind by $__' row (chips: none, $50, $100, $250). Summary shows endedBy ('Stopped: up $100 at roll 37'). With 100 sessions show the share that hit each stop and mean final vs expected. WHY: lesson 15/16 myth 'stop-loss/quit while ahead beats the house'. Learners can see stops change the distribution shape but not expected loss per roll played. ACCEPTANCE: AutoRollPanel.test.tsx: setting stop-win $50 passes stopWin 5000 to simulate; summary shows the endedBy text; many-session summary includes '% ended by stop-win'. Scene `autoRoll` gains optional `stopWin`/`stopLoss` defaults (types.ts + validate.ts + validate test).

### 9. [I007] Auto-roll: histogram of session results across 100 sessions (S)

WHAT: ManyResult.finals (Int32Array) is computed but never charted. Add `ui/ResultsHistogram.tsx` (hand-rolled SVG like TotalsHistogram) bucketing final equity − start into ~15 bins, marking 0 (break-even) and the expected result, with caption '62 of 100 sessions ended behind; 4 busted'. Show under the band chart when sessions > 1. WHY: the p10–p90 band hides the shape; a histogram shows the long left tail of Martingale and the skew of props, central to lessons 15, 16, 20. ACCEPTANCE: component test with a fixed finals array renders the right bar counts, axis labels and aria summary; compare mode overlays up to 3 strategies as grouped/outlined bars with the existing COLORS; a11y: role=img with aria-label summary. Files: AutoRollPanel.tsx, new ResultsHistogram.tsx(+test).

### 10. [I022] Sandbox nudge: "Odds available — 0% edge" after a point is set (S)

WHAT: when a pass/come/DP/DC flat has odds room > 0 after the roll and the learner hasn't added odds in the last 2 point cycles, show a dismissible hint toast and a subtle pulse on the odds chip spot; 'Don't show again' stored in sim settings. Off in scenes unless `ui.hints: true`. WHERE: Simulator.tsx (after roll events), Toasts.tsx, settings.ts (`hints` setting), sim.css pulse (static outline under reduced motion). WHY: suggestAlternative only fires when placing another bet; most learners never discover odds in free play, the single biggest edge lever. ACCEPTANCE: Simulator.test.tsx: pass $10, roll forced 6 → hint appears once; after adding odds no hint; disabled setting suppresses it; scene default off.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 11. [I056] Single structured live announcement per roll (S)

Two live regions announce each roll (Toasts role=status and StatusBar .sim-last aria-live with a Dice role=img), causing duplicate/racy SR output. Replace with one dedicated visually-hidden live region fed by describeRoll (text.ts): 'Rolled 5 and 6, eleven. Pass line wins $5. Bankroll $505. Point is off.' Announce after animation (or immediately when instant). Accept: exactly one announcement per roll. Test: Simulator.test.tsx asserts live region text; remove aria-live from .sim-last.

### 12. [I018] Richer step conditions: bet on a number, bet resolved, equity, luck (S)

WHAT: extend Condition with `{ betOnTable: { type, minAmount?, point? } }` (come bet on 6), `{ betResolved: { type, result?: 'won'|'lost'|'pushed' } }` sugar over events, `{ equityAtLeast/AtMost }`, and `{ not: Condition }`. WHERE: src/sim/scene/types.ts, runner.ts evaluate(), validate.ts, runner.test.ts. WHY: authors currently can't say 'wait until your come bet travels to a number and then wins'. Small, enabling. ACCEPTANCE: one runner test per new condition kind incl. nesting with all/any/not; validate tests; authoring.md updated.

### 13. [I014] Scene step type: predict-before-roll / in-sim question (M)

WHAT: SceneStep gains `ask?: { q: string; options: string[]; answer: number; explain: string; mode?: 'before-roll'|'any' }`. StepPanel renders options as buttons; roll is locked (rollLock) until answered when mode 'before-roll'. Correct/incorrect feedback with `explain`, then the forced dice resolve so the learner checks their prediction. New Condition `{ answered: true | 'correct' }`. Emit SimulatorEvent `step-answered` so the app can store it like quiz progress. WHERE: src/sim/scene/types.ts, validate.ts, runner.ts (SceneInput kind 'answered', rollLock), src/sim/ui/StepPanel.tsx, Simulator.tsx, src/app/components/LessonScene.tsx (persist). WHY: active recall at the exact moment of the roll ('Your come bet is on 6 and a 7 rolls — what happens?') is far stronger than passive steps; makes the cut 'call the bet' idea available inside lessons. ACCEPTANCE: runner tests for lock/unlock, both condition values, wrong answer shows explain and allows retry; validate rejects answer out of range; StepPanel test (keyboard accessible buttons, aria-live feedback); add one example to lesson 07 (come bets) and keep lessons.test green.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 14. [I033] Custom table rules editor (odds, field, vig timing/rounding, put bets, payout unit, working on come-out) (M)

WHAT: beyond the 4 presets, a 'Custom…' option in the sandbox Rules menu and AutoRollPanel opening a form for TableRules fields the engine already supports: maxOdds (3-4-5x, 2x, 5x, 10x, 20x, 100x), fieldPays[12] 2/3, vig.timing on-win/upfront, vig.rounding, payoutUnit ($1 exact / 50¢ / $1 floor), placeBetsWorkOnComeOut, hardwaysWorkOnComeOut, comeOddsWorkOnComeOut, allowPutBets, tableMin/max. Live summary 'Pass + max odds: 0.37%, Field 5.56%…'. WHERE: new src/sim/ui/RulesEditor.tsx, Simulator.tsx (rules state, persist via persist.ts), AutoRollPanel rules select; resolveRules already merges Partial<TableRules>. Changing rules mid-session follows the existing preset-change behaviour. WHY: lessons 10 (vig upfront 4.76%), 12 (field 3x), 18 (odds multiples) quote numbers learners can't reproduce; real casinos vary and learners should read a table's rules card. ACCEPTANCE: component tests for each field mapping to TableRules; persisted and restored; upfront vig shows buy-4 4.76% in sheet; put bet allowed only when enabled (engine already validates); e2e: switch to upfront vig and see buy-4 edge change.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 15. [I050] Scroll opened Auto-roll / Session panels into view (S)

On a 390x844 phone, tapping Auto-roll or Session renders the panel below the fold (under the bottom nav), so nothing visibly happens. On open, scrollIntoView({block:'nearest'}) the panel and move focus to its heading (Simulator.tsx panel toggles). Respect reduced motion (behavior:'auto'). Accept: panel heading visible in viewport after tap; focus moved. Test: e2e checks heading inViewport.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 16. [I038] Explain working/off: show "OFF" reason and EV effect when toggling (S)

WHAT: when a bet is off (come-out place/buy/hard, come odds), the chip stack shows an OFF marker and the manage sheet explains 'Off on the come-out by table convention; turning it ON costs about $0.07 per come-out roll and risks the 7 that's 6 of 36'. The set-working preview already computes ±amount × perRoll; surface it with copy. WHERE: src/sim/ui/BetSheet.tsx (working toggle area ~L212), text.ts, ChipStack.tsx (OFF marker if missing). WHY: 'why didn't my place bet lose on the 7?' is a top beginner confusion (lessons 3, 9). ACCEPTANCE: component test: place-6 $12 on come-out manage sheet shows the off reason and the per-roll cost for ON; toggling updates text; ChipStack test for OFF marker with text, not colour only.

### 17. [I023] Session panel "Where your expected loss came from" + one suggestion (S)

WHAT: add a share column to the per-bet breakdown (expected loss of type ÷ total expected loss) and a sentence: 'Field bets were 9% of your action but 41% of your expected loss. Pass Line with odds would have cost about $X instead.' Uses stats.byType expected and suggestAlternative's mapping. WHERE: src/sim/ui/SessionPanel.tsx, small pure helper in text.ts (+test). WHY: converts curriculum §6.4 numbers into a personal takeaway. ACCEPTANCE: test with synthetic stats (pass + field) renders the right shares and sentence; no sentence when all bets are good/free tier; numbers sum to 100% ±1.

### 18. [I004] Bet sheet: "Typical swing" (standard deviation) line next to the expected loss (S)

WHAT: in the EV block of BetSheet add one line: 'Typical swing per decision: ±$X (the edge is $Y)'. For odds: 'No edge, but it adds ±$X of swing'. Uses betStdDev from I001. Shown only when evDetail is 'full'. WHERE: src/sim/ui/text.ts buildEvFacts (new `swing` field), BetSheet.tsx EvLines. WHY: the single most common misconception after lesson 6 is 'odds make me safer'. Seeing $0 edge but ±$60 swing on $30 odds on the 4 makes variance concrete. ACCEPTANCE: pass $10 sheet shows '±$10.00'; pass-odds $30 on 4 shows '±$42.43' (σ = 30·√2); any-7 $5 shows swing and edge; text.test.ts covers formatting; hidden with evDetail 'basic'. Depends on I001.

### 19. [I005] Luck band: is my result normal? (z-score in Session panel and auto-roll summary) (M)

WHAT: track variance of resolved bets in engine stats and show 'Luck: −$29.90 — within the normal range (about 0.8 typical swings)' with a small bar from −2σ to +2σ. Engine: add `stats.variance` (cents², float) accumulated at resolution via an injected `varianceFn(bet, state)` like the existing expectedLossFn pattern in applyAction opts (keeps engine ← nothing import rule). Math provides the fn using I001 (fresh-situation variance per resolution). UI: src/sim/ui/SessionPanel.tsx and AutoRollPanel summary rows ('Luck in typical swings'). WHY: curriculum §6.4 wants learners to see short-run results are mostly luck; a z-score makes 'mostly luck' measurable and stops learners reading a +$80 night as skill. ACCEPTANCE: unit test that after 10k random pass-line resolutions, mean z ≈ 0 and SD ≈ 1 (±0.1); SessionPanel test renders 'within the normal range' for |z|<2 and 'unusually lucky/unlucky' otherwise; persisted sandbox state migrates (missing variance → 0). Depends on I001. Touches engine/types.ts SessionStats (EXTENSION comment) and Simulator.tsx wiring.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 20. [I009] Odds-multiple sweep: edge vs swing vs chance of finishing ahead (M)

WHAT: a scene/auto-roll mode that runs pass-max-odds at oddsMultiple 0,1,2,3-4-5x,10x,100x (same seeds) and shows a small table/chart: edge on action (analytic, strategyMetrics), expected $ loss per 100 rolls (constant!), SD of session result, P(ahead), bust rate. WHERE: new `simulateSweep` in src/sim/strategy/simulate.ts (reuses simulateMany with chunking + AbortSignal), new ui/SweepPanel.tsx, scene schema `autoRoll.sweep: { strategy: StrategyId, oddsMultiples: number[] }` (scene/types.ts, validate.ts). WHY: lesson 6/18's key insight — odds lower the edge per dollar but not the dollars expected lost, and they increase variance — in one picture. ACCEPTANCE: expected-loss-per-100 column equal across multiples within 1¢ (analytic); edge column 1.41%, …, 0.374%, 0.184%, 0.021%; P(ahead) increases with odds over 100 rolls at fixed seed set; UI test; lessons.test still passes; perf: 6×100×100 rolls < 2s in strategy benchmark test. Optional: use I001 for the analytic SD column.

- 2026-10-21 04:32 claimed by test
- 2026-10-21 04:32 test claim reverted by orchestrator
- 2026-10-21 04:32 claimed by sonnet-1

### 21. [I025] Practice hub: drill framework (route, scoring, streaks, spaced review) (L)

WHAT: new route #/practice listing drills; a shared drill framework `src/app/practice/` with Drill interface {id, title, generate(rng, level) → Item, check(item, answer) → {ok, explain}}, seeded RNG from src/sim/engine/rng.ts, 10-item rounds, per-drill best score/streak in the store, and simple spaced review (missed items re-queued). Item rendering uses existing sim components (Dice.tsx, ChipStack, mini Table). WHY: lessons teach once; fluency (ways, payouts, which bets win) needs repetition. Hosts the drills below. ACCEPTANCE: routes test; store migration test; framework unit tests (deterministic generation by seed, scoring, re-queue); e2e: open hub, finish a 10-item demo drill. Subtasks can parallelize: (a) framework+route+store, (b..) individual drills. Not tied to lesson gating (decisions: all lessons open).

- 2026-10-21 04:32 claimed by opus-2

### 22. [I028] Drill: "Call the bet" — which bets win, lose or stay (chip) (M)

WHAT (docs/chips.md): show a random but legal layout (built via createGame BetInit) and a dice result; learner taps each chip stack as Win / Lose / Stays / Travels / Off. Then the engine resolves and the table animates, marking each call right/wrong. Levels: line only → +come/odds → +place/hard/props. WHERE: src/app/practice/drills/callTheBet.tsx using Table.tsx in a read-only mode (new prop `annotate`), engine resolveRoll for truth. Depends on I025; reuses I014's feedback styling if available. WHY: dealer-style fluency; builds the mental model of what each roll does to the whole layout (lessons 3–13). ACCEPTANCE: generator produces only valid states (validate via createGame); answer key derived from resolveRoll events (bet-won/lost/pushed/travelled/returned/none) with unit tests on tricky cases: come-odds off on come-out 7, DP 12 bar push, come travelling while old come on same number wins. Move chip to Done.

### 23. [I030] Challenge mode: 300-roll scored session (lowest edge per dollar, no sucker bets) (M)

WHAT: the curriculum's cut Challenge mode (curriculum.md final exam text): a sandbox variant with a fixed seed of the day or random seed, $500 bankroll, 300 rolls. Score = edge per $ actually chosen (stats.expectedLoss / totalWagered) with penalties for red-tier bets and no-odds point cycles; shows rank bands (e.g. ≤0.40% 'Perfect strategy'). Best scores persisted. Available to everyone (decisions: no unlocks); the Perfect Strategy badge just links to it. WHERE: scene preset in src/sim/ui (or src/app/screens/Play.tsx with a 'Challenge' button) using SceneConfig with a `challenge` block {rolls, scoring}; runner condition {rolls:300}; result screen component; store for best score. WHY: gives the strategy chapters a goal and replay value focused on decision quality rather than winnings (results depend on luck; score doesn't). ACCEPTANCE: scoring is independent of dice luck (test: same decisions, different seeds → same score); red bet penalty test; e2e: complete a 300-roll challenge in instant speed via a script; copy never implies winning money.

### 24. [I019] "Why?" 36-dice grid: see winning, losing and neutral combinations for any bet (M)

WHAT: in the Why? expander, a 6×6 grid of dice pairs coloured (with text/pattern, not colour alone) win / lose / push / no decision for the bet in its current situation (one-roll: final; multi-roll: this roll's effect). Hard ways show the single pair. Caption: 'Wins on 4 of 36, loses on 6 of 36, 26 rolls change nothing'. WHERE: new src/sim/ui/DiceGrid.tsx; math helper `rollEffectGrid(bet, ctx): ('win'|'lose'|'push'|'none'|'travel')[36]` in src/sim/math/outcomes.ts using registry resolve(); BetSheet Why? section; also reusable on the Bets reference pages (src/app/screens/Bets.tsx). WHY: lesson 1's 36-combination idea applied to every bet; makes field ('7 numbers but only 16 of 36') and hardways intuitive. ACCEPTANCE: unit test: field grid has 16 win cells; hard-6 has 1 win, 10 lose (6 sevens + 4 easy sixes); place-6 on come-out (off) shows all 'none' with note; component test for legend + aria table semantics (role=grid with labelled cells or an accessible summary).

- 2026-10-21 04:32 claimed by sonnet-2

### 25. [I062] Overlay toasts that never push layout or fall off-screen (M)

Toasts render in document flow below controls: they shift panels in portrait and are off-screen in landscape (844x390 they sit below the fold). Render them as a fixed/absolute overlay anchored above the controls (portrait) or over the felt top-right (landscape), max 2 visible, swipe to dismiss. Files: Toasts.tsx, sim.css, Simulator.tsx. Accept: toast visible in both orientations without changing layout height. Tests: e2e inViewport + bounding box of controls unchanged.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 26. [I082] Visual regression tests and scripted screenshots (M)

Add Playwright toHaveScreenshot specs (tests/e2e/visual.spec.ts) for deterministic states (seed + speed=instant): portrait/landscape table, sheet per tier, center, auto-roll chart, lesson scene, dark mode. Add npm script 'screenshots' that regenerates docs/screenshots from the same fixtures. Pin fonts/animations off. Accept: CI job runs visual project on chromium only with threshold; update docs on refreshing baselines.

### 27. [I083] E2E coverage for sandbox flows (M)

Add specs for: come bet travel + odds, sucker-bet double confirm, rebet after one-roll bets, rules change reset, persistence across reload, URL params (seed/dice/rules), landscape sheet panel, compare auto-roll, tap-to-skip animation. Files: tests/e2e/sandbox.spec.ts (+ helpers with data-testid). Accept: each flow asserts bankroll/state text; runs on mobile + phone-landscape.

- 2026-10-21 04:32 claimed by sonnet-3

### 28. [I069] Watch mode: replay an auto-roll run on the table (chip) (M)

Implements docs/chips.md 'Auto-roll Watch mode'. Make simulateSession optionally record per-roll dice/bets (strategy/simulate.ts), then add a 'Watch on table' button in AutoRollPanel that replays rolls through the normal animation pipeline with controls: play/pause, 1x/4x/16x, step, scrub, exit. Files: simulate.ts, AutoRollPanel.tsx, Simulator.tsx, new WatchControls.tsx. Accept: replay final bankroll equals run result; same seed reproduces. Tests: simulate.test for recorded log; Simulator.test for replay state; e2e smoke.

- 2026-10-21 04:31 merged from I049 (alpha): share the playback queue with I016 (scene demo steps)
- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 29. [I071] Shareable sandbox link (rules, seed, bets, bankroll) (M)

Extend the existing ?seed/dice/rules/speed params (readUrlParams in Simulator.tsx) with bankroll and a compact 'bets' param (e.g. pass:500,box-6:600) and add a Share button in Menu using navigator.share with clipboard fallback. Validate each bet via validateAction on load and toast skipped ones. Accept: opening the link reproduces layout + next rolls; malformed params ignored safely. Tests: unit test parse/serialize round-trip; e2e opens link.

- 2026-10-21 04:31 merged from I055 (alpha): also offer 'Copy as scene YAML' that passes validateScene, and coordinate the param parser with I041's ?bet= param
- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 30. [I011] Session plan panel: bankroll, unit, strategy, length → expected loss, bust risk, suggested stop-loss (chip) (M)

WHAT (docs/chips.md 'Session plan panel'): a 'Plan' tab in AutoRollPanel (or a separate panel) with inputs bankroll, unit, strategy, hours (× Settings rolls/hour). Shows instantly: expected loss (analytic strategyMetrics × rolls), then runs simulateMany (500 sessions, chunked) for P(bust), P(ahead), p10/p90 result, and suggests a bankroll for <5% bust ('With $300 and $10 pass + max odds, about 23% of 4-hour sessions go broke; $800 gets that under 5%'). WHERE: new src/sim/ui/PlanPanel.tsx, src/sim/strategy/plan.ts (bankroll search by bisection over simulateMany with fixed seeds), Simulator.tsx tab wiring, Play screen. WHY: turns lessons 15/19 into a personal tool; reinforces 'budget the expected loss as the price of entertainment'. No real-money promotion: copy frames it as cost. ACCEPTANCE: plan.ts tests: bust probability monotone non-increasing in bankroll; deterministic for fixed seed; suggested bankroll gives bust ≤ 5% ± MC tolerance; component test; abortable when inputs change. Move chip to Done.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 31. [I016] Scene "demo" steps: scripted actions played with narration (watch the dealer) (M)

WHAT: SceneStep `play?: { action: Action; say?: string; pauseMs?: number }[]` — the runner dispatches these actions (bets, rolls with forced dice) one at a time with toasts/captions, then hands control back. Learner can tap 'Replay'. WHERE: scene/types.ts, validate.ts (each action validated against the simulated state at that point via replay), runner.ts (queue), Simulator.tsx (timer loop respecting speed/reduced motion and tap-to-skip). WHY: complex flows (come bet travelling while an older come bet wins; come odds off on come-out) are hard to set up by hand; a narrated replay teaches before the learner tries. ACCEPTANCE: runner test plays a 4-action script deterministically to an expected GameState; validate rejects illegal scripted actions with step id in the error; instant speed completes synchronously; skip jumps to end state; e2e on lesson 07. Coordinate with beta's Watch mode item (shared playback queue).

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 32. [I015] Scene callouts: labelled pointers on table regions and chip stacks (M)

WHAT: SceneStep/SceneConfig `callouts?: { target: RegionId | { betType: BetTypeId }; text: string; placement?: 'above'|'below' }[]` rendered as an SVG/HTML overlay bubble with a leader line to the region rect (from the active layout incl. Center panel), in addition to the existing pulsing highlight. WHERE: scene/types.ts + validate.ts (RegionId list from layouts/types.ts), new ui/Callouts.tsx positioned via layout rects + Table viewBox scaling, Simulator.tsx/Table.tsx. WHY: the table tour (lesson 2), buy/lay chip positions (lesson 10) and odds 'behind the line' (lesson 6) need 'this spot here' annotations; highlight alone doesn't say why. ACCEPTANCE: renders within the viewport at 390×844 and 844×390 (layout test computes bubble rect inside viewBox); screen readers get the text via the region's aria-describedby; validate rejects unknown targets; lesson 02 updated to use 2-3 callouts.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 33. [I040] Analytic strategy comparison table (all presets × lens metrics) in sandbox and lesson 20 (M)

WHAT: a sortable table of every preset at a chosen unit/rules: edge on action, expected loss per roll and per hour (Settings rolls/hour), rolls per $1, money on the table on average (steady state). Rows link to 'Run it' in auto-roll. Lesson 20's static table can be replaced by a scene block `autoRoll.table: true`. WHERE: src/sim/strategy/metrics.ts (add avgAction), new ui/StrategyTable.tsx, AutoRollPanel tab, scene types/validate. WHY: the three strategy chapters compare lenses numerically; an interactive table makes the lens trade-off (edge% vs $/hour vs fun) explicit and fixes docs/chips.md narrow-table problem by being responsive (stack to cards < 480px). ACCEPTANCE: metrics tests: pass $10 0.0419 $/roll, place 6+8 $6 0.0556, iron cross $5 7/18 point-roll; table sort test; renders as cards at 390px.

### 34. [I012] More strategy presets: don't-side Molly, buy 4/10, lay 4/10, place-and-press, inside regression, hedge-the-pass (M)

WHAT: add StrategyIds `dont-come-molly` (DP + 2 DC, max lay), `buy-4-10` ($20 buys), `lay-4-10` ($40 lays), `place-6-8-press` (press after each hit to cap), `inside-regress` (place 5/6/8/9 $22 then regress to $12 6/8 after first hit), `pass-hedge-any-craps` (myths: pass + any craps on come-out). Each with lens + description; metrics in strategyMetrics. WHERE: src/sim/strategy/types.ts, presets.ts, metrics.ts (steady-state may need special-casing for progressions → mark metrics 'approximate (simulated)'), AutoRollPanel grouping, scene validate allowlist. WHY: lessons 9, 10, 11, 16, 19 discuss these but learners cannot simulate them; hedging/regression myths need a demo that the edge is unchanged or worse. ACCEPTANCE: existing 'decide returns only legal actions over 10k random rolls' test covers all new ids; analytic expected loss per roll for buy-4-10 = 2×$20×1/60 per resolution scaled; hedge strategy edge on action > pass alone; UI lists them under the right lens.

### 35. [I010] Law-of-large-numbers chart: your edge per dollar converging to the house edge (M)

WHAT: for a single auto-roll session, plot running (actual result ÷ total wagered) against rolls on a log x-axis, with the house edge as a horizontal line and a shrinking ±2σ/√n funnel (from I001). Toggle on BankrollChart: 'Show as % of money bet'. WHERE: SessionResult gains `wagered: Float64Array` cumulative per roll (simulate.ts), BankrollChart.tsx new mode, AutoRollPanel toggle; scene `autoRoll.chart: 'bankroll'|'edge'` default for lesson 14/15. WHY: shows why the casino always wins over millions of rolls while individuals swing — the core of lessons 5, 14 and 15. ACCEPTANCE: 10,000-roll pass-line session ends within the funnel at a fixed seed; chart has axis labels and an aria summary; test of the cumulative arrays; validate.ts accepts the new scene field. Depends on I001 for the funnel (can ship without funnel first).

### 36. [I020] "Why?" probability tree for line and come bets (M)

WHAT: for pass/DP/come/DC from the come-out, render a compact two-level tree: come-out (natural 8/36, craps 4/36, point 24/36) → each point N: P(N first)·P(N before 7) with money, summing to 244/495. Replaces the long flat outcome table on phones (current Why? table is 13 rows and scrolls). WHERE: src/sim/math/explain.ts (structured `tree` alongside rows), new ui/OddsTree.tsx, BetSheet.tsx. WHY: lesson 3–4's come-out/point logic is a tree; seeing 244/495 assembled is the 'Show the math' moment. ACCEPTANCE: explain test: tree leaves' probabilities sum to 1 and EV equals betEV exactly (Fraction); renders at 390px without horizontal scroll; collapsible per point; screen-reader list semantics.

### 37. [I029] Drill: "Best move" puzzles graded by EV (M)

WHAT: present a table situation and 3–4 candidate actions (add odds, place 6, take down DP, field, buy 4 at $10 vs $20 …); learner picks the lowest-cost/most-EV choice; feedback shows each option's EV via previewAction ('Taking down DP on 4 gives up $3.33'). Situations generated from templates with random points/amounts. WHERE: src/app/practice/drills/bestMove.ts; uses previewAction/suggestAlternative from src/sim/math. Depends on I025. WHY: practises the decision rules lessons 6–13 and 18 teach, with immediate numeric feedback. ACCEPTANCE: for every generated item the marked answer has the max EV per $ among options (asserted in test over 500 seeds); ties excluded by the generator; explanations use the same headline strings as the sheet.

### 38. [I027] Drill: dealer payout math ("$12 on the 6 hits — what do you get?") (M)

WHAT: given a bet, amount and roll, enter the payout (numeric keypad UI) — place, buy/lay with vig rounding, odds at each point, field 2/12, props, horn/world mixed pays, short pays (place 6 at $5 → $5.83 or $5 by payoutUnit). Answers come from engine `resolve` via applyAction on a built state, never hard-coded. WHERE: src/app/practice/drills/payouts.ts + PayoutPad.tsx. Depends on I025. WHY: knowing payouts lets learners catch dealer mistakes and spot short pays (lessons 6, 9, 10). ACCEPTANCE: generator test cross-checks 1,000 random items against golden table in simulator.md §2.3; keypad accessible; explanation shows the formula ('7 to 6 → $12 × 7/6 = $14').

### 39. [I026] Drill: ways and probability flashcards (dice totals, hard vs easy) (S)

WHAT: drill on the practice hub: 'How many ways to roll 9?', 'Chance of a 7 before a 6?' (5 of 11), 'Which is a hard 8?' with dice pictures; levels 1–3. Generated from src/sim/math/dice.ts. WHERE: src/app/practice/drills/ways.ts (+test). Depends on I025. WHY: the 'ways' column is the foundation of every later lesson (curriculum lesson 1). ACCEPTANCE: generator covers totals 2–12 and points; answers verified against WAYS/pointWinProb in tests; explain text names the combos.

### 40. [I017] Live values in step text: {{ev:pass-line}}, {{bankroll}}, {{point}} (S)

WHAT: StepPanel's renderLite supports a few tokens evaluated against the current GameState: {{bankroll}}, {{point}}, {{onTable}}, {{ev:<betType>}} (EV of the player's bet of that type in its current situation), {{edge:<betType>}}, {{session}}. Unknown token → validate error. WHERE: src/sim/ui/StepPanel.tsx (renderLite + new prop state), src/sim/scene/validate.ts token check, Simulator.tsx passes game. WHY: lets authors write 'Your Don't Pass is now worth {{ev:dont-pass}}' so the math explanation matches what's on the learner's table after random rolls. ACCEPTANCE: text.test/StepPanel tests for each token, formatting via fmtMoney; validate test rejects {{ev:nope}}; docs/authoring.md documents tokens.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 41. [I057] Bankroll vs bet size warning in auto-roll and sandbox (S)

WHAT: when a strategy's max exposure per decision (flat + max odds, or the full layout) exceeds ~10% of bankroll, show 'Your bankroll covers about N decisions at this size; expect a high bust rate' (e.g. $100 unit + 5x odds on $500 busts in ~11 rolls, observed in exploration). WHERE: AutoRollPanel.tsx (before run, from strategyMetrics/steady-state exposure), SessionPanel for the sandbox. ACCEPTANCE: test: pass-max-odds $100 unit, $500 bankroll shows the warning; $10 unit does not; copy follows curriculum §6.5 wording.

### 42. [I043] Per-roll vs per-hour vs per-decision toggle on the Roll button cost and sheet (S)

WHAT: tapping the Roll button's 'Expected cost: $0.42' cycles units: per roll → per hour (× Settings rolls/hour) → per $100 bet. Same toggle in the sheet detail line. Choice persisted in sim settings. WHERE: src/sim/ui/RollButton.tsx (costText becomes a small button), Simulator.tsx, settings.ts. WHY: lesson 14's 'edge per roll' insight: a $5 field costs more per hour than a $25 pass line; seeing the hourly figure on the button while playing drives it home. ACCEPTANCE: component test cycles three formats with correct values for a pass $10 + place-6 $12 layout; aria-label states the unit; persisted.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 43. [I034] Put bets: EV preview and suggestion when the table allows them (S)

WHAT: with rules.allowPutBets, placing Pass Line during the point phase is legal (engine), but the sheet should price it in the point situation (pass on 4 = −33.3% flat!) and suggest 'Place the 6 (1.52%)' or 'Put with ≥5x odds' with the combined figure. Add 'put' to ALTERNATIVES logic in preview.ts and a short-pay-like warning 'Put bets without big odds are worse than place bets'. WHERE: src/sim/math/preview.ts (newBet uses state.point for pass-line in point phase), text.ts combinedEdge, preview.test.ts. Depends on I033 for UI exposure (works in scenes immediately via rules override). WHY: put betting is a classic trap with a great math lesson (put 6 + 5x odds ≈ place 6 + …). ACCEPTANCE: preview of pass-line $10 at point 4 under allowPutBets gives EV −$3.33 and edge 33.33%; with $50 odds combined edge shown; alternative suggests place-6/buy-4; tests.

### 44. [I044] Exact risk of ruin for flat even-money betting (gambler's ruin formula) as a check on the simulation (S)

WHAT: math helper `ruinProbability(p, bankrollUnits, targetUnits)` (classic formula with q/p) and `ruinBeforeN` via DP for flat pass/DP betting; shown in the auto-roll summary for flat pass/DP runs ('Exact: 23.4% chance to lose $200 before winning $200; simulated 22.9%'). WHERE: src/sim/math/ruin.ts (+test), AutoRollPanel summary when strategy is pass-max-odds with oddsMultiple 0 or dont-pass flat. WHY: shows the simulation agrees with exact math — the course's trust-building theme — and gives lesson 15 an exact bust number. ACCEPTANCE: ruin.ts tests against known values (p=244/495, 10 units to double); simulated vs exact within MC tolerance in a seeded test.

### 45. [I008] Auto-roll: shooter hand-length distribution and "points made per hand" (S)

WHAT: record each hand length (come-out to seven-out) in simulateSession (`hands: Int32Array` or a capped histogram array) and show a small histogram with the exact mean 1671/196 ≈ 8.53 rolls marked, plus 'Longest hand: 23 rolls'. WHERE: src/sim/strategy/simulate.ts + types.ts (SessionResult.handLengths histogram), AutoRollPanel.tsx, reuse ResultsHistogram/TotalsHistogram SVG style. WHY: hot-shooter myths (lesson 16) and 'how long is a roll' intuition; shows long hands are rare but happen. ACCEPTANCE: strategy.test.ts: over 200k rolls the mean hand length is within 2% of 1671/196; pointsMade/sevenOuts consistent with histogram totals; UI test renders mean marker.

### 46. [I041] Bets reference pages: "Try it" opens the sandbox with that bet's sheet (S)

WHAT: on #/bets/:betId add 'Try it on the table' linking to #/play?bet=<id> (and ?point=N when the bet needs a point, e.g. odds). The sandbox reads `bet` param and opens the sheet for that region/type after load. WHERE: src/app/screens/Bets.tsx, src/sim/ui/Simulator.tsx readUrlParams (bet, point), Play.tsx. Coordinate with beta's URL/deep-link item (same param parser). WHY: closes the loop from reading a bet's math to seeing the live EV preview. ACCEPTANCE: e2e: open bets/place-6 → Try it → sheet for Place 6 visible; odds bet with point sets up a pass line at that point; invalid id ignored.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 47. [I042] Sandbox "Load a situation" presets for practice (S)

WHAT: a Menu item listing ~8 curated table situations (SceneConfig fragments without steps): 'Point 4 with DP and lay room', 'Two come bets travelled', 'Come-out with place bets off', 'Iron Cross on point 6', 'Bankroll down to $40'. Loading replaces the sandbox state. WHERE: src/sim/ui/situations.ts (data; validated by validateScene in a test), Simulator.tsx Menu. WHY: lets learners rehearse lesson situations without waiting for dice to set them up. ACCEPTANCE: every situation passes validateScene; Simulator.test loads one and asserts phase/point/bets; persisted sandbox updates.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 48. [I048] Stop Roll button height jump when 'Expected cost' appears (S)

Roll button grows when the 'Expected cost: $x' subline appears after the first bet, shifting controls (CLS). Reserve the subline space (min-height or always render a placeholder line) in src/sim/ui/RollButton.tsx/sim.css. Accept: Roll button bounding box identical before/after placing a bet (portrait and landscape). Test: components.test or e2e bounding-box comparison.

### 49. [I052] Move focus to page heading on route change (S)

After hash navigation focus stays on stale elements from the previous screen (observed: first Tab after going to #/play landed on 'Session results'). In src/app/App.tsx/router, on route change focus the main <h1> (tabindex=-1) and announce the page title. Accept: first Tab after navigation goes to skip-link/header; SR announces new page. Test: tests/app/app.test.tsx + e2e.

### 50. [I054] Keyboard shortcuts and skip-to-Roll in the simulator (S)

Tab order passes 13 table regions before reaching chips/Roll. Add shortcuts scoped to the simulator root: R/Enter=roll, C=toggle Center, 1-5=select chip, Esc=close sheet/skip animation, plus a visually-hidden 'Skip to controls' link. Show a '?' shortcut help list in Menu. Files: Simulator.tsx onKeyDown, ChipRack.tsx. Accept: all shortcuts work, ignored while typing in inputs. Tests: Simulator.test.tsx keyboard events.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 51. [I075] Undo last bet and Clear bets before rolling (S)

Add Undo (removes the most recent placement since the last roll) and 'Take down all' (removes all removable bets; contract bets stay) to controls/Menu. Uses existing remove-bet action through doAction. Files: Simulator.tsx, simHelpers.ts. Accept: undo stack clears on roll; disabled when nothing to undo. Tests: Simulator.test.tsx.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 52. [I073] Remember Auto-roll panel choices (S)

AutoRollPanel resets strategy/unit/odds/rolls/sessions every open. Persist last choices per persistKey in localStorage (guarded like persist.ts) for sandbox only; scenes keep authored defaults. Files: AutoRollPanel.tsx, persist.ts. Accept: reopen/reload keeps choices. Tests: AutoRollPanel.test.tsx with mocked storage.

### 53. [I060] Outcome glyphs for all history pills (color-blind safety) (S)

History pills use colour only for natural/craps (GLYPH is empty for those). Add distinct glyphs/letters (e.g. N, C, ✓, ×) and a legend in the history aria/tooltip. File: HistoryStrip.tsx, sim.css. Accept: every non-'none' outcome distinguishable in greyscale. Test: components.test.tsx snapshot of glyphs.

### 54. [I059] Remove duplicated last-roll display in the status bar (S)

Status bar shows the last roll twice (large dice + first history pill). Show the big dice only and start the strip at the previous roll, or highlight the newest pill instead of the big dice in compact mode. Files: StatusBar.tsx, HistoryStrip.tsx. Accept: last roll appears once; SR label kept. Tests: components.test.tsx.

### 55. [I066] Animated chip movement: payouts, sweeps and come-bet travel (M)

Real-table feel: losing chips slide to the house, winnings slide from the dealer to the bet, come/don't-come chips travel to the number box (bet-travelled event exists in engine/types.ts). Use transform-only transitions in Table.tsx/ChipStack.tsx driven by the existing animation timeline (animation.ts add a 'travel' step). Respect speed/skip/reduced motion. Accept: each event kind animates within ~1s total; tap skips. Tests: animation.test.ts for new step ordering; components test for classes.

### 56. [I064] Bottom sheet for Session / Auto-roll / Menu panels (M)

Panels currently stack inline under the table (Session + Auto-roll together make a ~2600px page). Put them in one bottom sheet with tabs (Session | Auto-roll | Menu), drag handle, swipe-down to dismiss, Roll still reachable; landscape uses the side panel like BetSheet. Files: new src/sim/ui/PanelSheet.tsx, Simulator.tsx, sim.css. Accept: only one panel open at a time; focus trapped & restored; Esc closes. Tests: Simulator.test.tsx + e2e. Easier after Simulator.tsx refactor.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 57. [I063] Immersive landscape play mode (M)

In landscape the app header uses ~65 of 390px. On #/play (and lesson scenes when focused) hide the app header/nav in landscape behind a small menu button, honour safe-area insets (notch) left/right, and size the felt to the full height. Files: src/app/App.tsx, app.css, simulator.css. Accept: felt height >= 330px at 844x390; nav reachable; no overlap with notch insets. Tests: e2e phone-landscape project measures felt box.

### 58. [I039] After a place/buy win: Press / Same / Collect / Take down prompt with EV per choice (M)

WHAT: when a stays-up bet wins in the sandbox, an inline prompt next to the toast offers 'Press (+$12 to $24)', 'Same bet', 'Regress to $6', 'Take down'. Each shows the change in expected loss per roll. Choices dispatch set-amount/remove-bet. Optional, off in scenes unless enabled, and remembered as 'Always same bet'. WHERE: Simulator.tsx (after roll events with bet-won staysUp), new ui/WinPrompt.tsx, settings.ts. WHY: lesson 9 mentions pressing; it makes the hidden decision real tables ask ('same bet?') explicit and shows that pressing raises cost per roll, not the edge. ACCEPTANCE: Simulator.test: forced 6 with place-6 $12 → prompt shows 4 options with per-roll deltas (+$0.06/roll for press to $24); choosing Press results in $24 bet and bankroll −$12 relative to collect; dismissed on next roll; keyboard accessible.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 59. [I032] Gambler's-fallacy lab: what happens after a streak? (M)

WHAT: a scene/auto-roll tool: run 100k no-bet rolls; learner picks a condition ('after 3 sevens in a row', 'after no 6 for 15 rolls', 'after 5 points made') and sees the frequency of 7 / 6 / point made on the NEXT roll vs the exact probability, with sample size. WHERE: src/sim/strategy/streaks.ts (pure, chunked scan of a seeded roll stream), ui/StreakLab.tsx, scene `autoRoll.lab: 'streaks'` (types/validate), lesson 16 scene. WHY: lesson 16 states 'dice have no memory'; letting learners hunt for a pattern and fail is far more convincing. ACCEPTANCE: streaks.ts tests: conditional frequencies within 4σ of unconditional probabilities at fixed seed; counts sample size; UI shows CI text; runs 100k rolls < 500ms.

### 60. [I031] Generated EV quiz questions from the math engine (endless review) (M)

WHAT: parametric question templates whose answers are computed by src/sim/math (edge of X under preset Y, expected loss per hour of layout Z at N rolls/hour, combined pass + Nx odds edge, which of two bets is cheaper per roll). Used as a practice drill and optionally as 'More practice' under a lesson quiz. WHERE: src/app/practice/drills/evQuiz.ts, Quiz.tsx reuse. Depends on I025. WHY: lessons 5, 13, 14 are number-heavy; endless correct-by-construction questions build intuition without authoring cost. ACCEPTANCE: every template has a test asserting answer == math function; distractors are distinct and plausible (no duplicate options); formatting matches curriculum §6.5 wording rules (two decimals, 'expected loss').

### 61. [I024] Habits report: track learner decisions in the sandbox and show improvement (M)

WHAT: count, per sandbox session and lifetime, decisions graded by the math: flats without odds at the point, red-tier bets confirmed, short-pay amounts, DP/DC taken down on a point (gives-up-ev), buy/lay below vig-efficient amounts, accepted 'Use this' alternatives. Show as a 'Your table habits' card on the Play screen with trend over the last 5 sessions. WHERE: Simulator emits SimulatorEvent 'decision-graded' {kind, evCost} from preview/warnings in Simulator.tsx; app store (src/app/store.ts) aggregates; Play.tsx card; settings to reset. WHY: feedback loop between lessons and free play — the 'feedback to the learner' gap. ACCEPTANCE: unit tests for grading from preview warnings; store persistence + export code includes it; component test of the card; zero personal data beyond counts.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 62. [I061] Color-blind and high-contrast table theme (M)

Add a 'High contrast' sim theme and forced-colors support: tier badges get icon+pattern (not only red/green), felt/regions use stronger borders, chips get denomination text always, puck readable; @media (forced-colors: active) CSS so SVG fills don't vanish. Files: sim.css, ChipStack.tsx, BetSheet.tsx tier badge, app Settings. Accept: axe contrast passes in HC; manual check with Chrome vision-deficiency emulation documented. Tests: e2e axe run with theme on; screenshot in docs/screenshots.

### 63. [I085] Screen-reader table summary and bet list view (M)

Add an 'Announce table' button and an optional list view of the layout: each bet with amount, working/off, odds, and point; actions (manage/remove) per row. Provides a non-spatial alternative to the SVG layout. Files: new src/sim/ui/BetList.tsx, Simulator.tsx, text.ts. Accept: all betting possible via list with keyboard/SR. Tests: components.test.tsx + axe.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 64. [I084] Axe scans of open simulator states (S)

a11y.spec.ts only scans initial pages. Extend to bet sheet (each tier), center view, menu, session panel, auto-roll results, landscape and dark theme. Accept: no serious/critical violations; failing states fixed or ticketed. File: tests/e2e/a11y.spec.ts.

### 65. [I035] Hop bets (easy hop 15:1, hard hop 30:1) with a dice-pair picker (chip) (L)

WHAT (docs/chips.md 'Hop bets'; decisions.md lists hops as a chip): new BetTypeId `hop` with `bet.dice: [Die, Die]` parameter (normalized low-high). Engine: types.ts Bet gains optional `hop?: Dice`, bets.ts registry resolve (pair→30:1, non-pair→15:1 paid on either order), validate (propMin, merging per combo), Action place-bet gains `hop?: Dice`. Math: outcomes/edge (easy hop 1/18·16 − 17/18 = 11.11%, hard hop 13.89%), tier avoid, alternatives. UI: Center panel 'Hop' region opening a 6×6 / 21-cell pair picker in the BetSheet; ChipStack shows the pair. Scenes: BetInit + ActionMatcher support `hop`. WHY: lesson 13 mentions hops; learners see them called at real tables; completes the props lesson. ACCEPTANCE: resolution matrix test extended for all 21 hops × 36 outcomes; exact edges in targets.test.ts; MC test; golden payouts ($1 hard hop 3-3 → +$30; $2 easy hop 2-4 on 4-2 → +$30); replay determinism; layout tap-target test for the new region; persisted states without hop still load. Split: engine+math (Opus), UI picker (Sonnet).

- 2026-10-21 04:32 claimed by opus-3

### 66. [I013] Custom strategy builder ("my system") with rule blocks (L)

WHAT: a small declarative StrategySpec `custom` with blocks: line bet (pass/DP, unit, odds multiple), up to N come/DC bets with odds, place/buy set (numbers, amounts, when: after point), progression on win (press x, regress to y, collect), progression on loss (martingale-capped, none), stop-win/stop-loss. Built in a form in AutoRollPanel, serialized in the scene/URL. Interpreter `decide()` turns blocks into legal Actions. WHERE: src/sim/strategy/custom.ts (+test), types.ts (StrategySpec.custom), presets.ts registry, ui/StrategyBuilder.tsx, AutoRollPanel, scene validate (custom spec schema). WHY: lesson 16 'every system has the same edge' becomes testable on the learner's own system — the strongest myth-busting experience the app can offer. ACCEPTANCE: each preset (pass-max-odds, three-point-molly, place-6-8, iron-cross, martingale) is re-expressible as a custom spec and produces identical SessionResult for the same seed (golden equivalence tests); fuzz test: random valid specs × 5k rolls never produce rejected actions; analytic edge on action shown when progression=none, 'simulated' otherwise. Split: (a) interpreter + tests, (b) builder UI, (c) scene/URL serialization. Depends on I012 for press/regress semantics.

### 67. [I065] Touch gestures: double-tap to bet, long-press to manage, swipe to dismiss sheet (M)

Double-tap a region places the selected chip directly (skipping sheet, still red-tier confirm), long-press a chip stack opens manage/remove, swipe down on BetSheet dismisses. Pointer events only, no conflicts with tap-to-skip. Files: Table.tsx, CenterPanel.tsx, BetSheet.tsx. Does not revive the cut drag-to-preview. Accept: gestures work on touch emulation; keyboard equivalents exist. Tests: e2e with hasTouch; unit tests for gesture detector.

### 68. [I070] Hold-to-fast-roll on the table (M)

Long-press Roll keeps rolling at fast/instant speed with the current layout auto-rebet (uses 'my-layout' semantics) until released or a stop condition (point resolved, bankroll < table min). Batches state updates with requestAnimationFrame so 100+ rolls stay smooth. Files: RollButton.tsx, Simulator.tsx. Accept: release stops within one roll; screen reader users get a 'Roll 10' button alternative. Tests: Simulator.test with fake timers.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 69. [I072] Export auto-roll results (CSV/JSON) and copy summary (M)

Add 'Download CSV', 'Download JSON' and 'Copy summary' to AutoRollPanel results: per-session finals, bust rate, percentiles, config (strategy, rules, seed). Blob + a[download] works in the offline single-file build. Files: AutoRollPanel.tsx, new src/sim/ui/exportResults.ts. Accept: CSV opens in spreadsheets; re-running with exported seed reproduces. Tests: unit tests for serializer.

### 70. [I076] Starting bankroll choice and rebuy when busted (S)

Menu gets a bankroll selector ($100/$200/$500/$1000/$5000) and a 'Rebuy' prompt when equity < table min, so learners aren't stuck. Files: Simulator.tsx (resetGame with bankroll), persist.ts. Accept: persisted sandbox keyed by bankroll (startBankroll check already exists). Tests: Simulator.test.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 71. [I079] Compact bet sheet for repeat bettors (S)

The sucker-bet sheet fills ~95% of a 390x844 screen. Collapse the EV detail lines behind 'Details' after the user has opened that bet type's sheet 3+ times (persisted), keeping tier badge, EV line and alternative visible. Files: BetSheet.tsx, persist.ts. Accept: Confirm reachable without scrolling at 390x667. Tests: components.test.tsx.

### 72. [I058] Optional haptics via navigator.vibrate (S)

Add a 'Vibration' setting (default on where supported; feature-detected, no-op on iOS) and a tiny haptics.ts: 10ms tick on chip select/bet placed, 30ms on win, [40,40,40] on seven-out. Skip when speed is instant or reduced motion. Files: src/sim/ui/haptics.ts, settings.ts, Simulator.tsx event handling, app Settings screen. Accept: patterns fire per event; toggle persisted. Tests: unit test with mocked navigator.vibrate.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 73. [I080] Screen Wake Lock during auto-roll/Watch (S)

Request navigator.wakeLock while an auto-roll run or Watch playback is active, release on finish/visibilitychange. Feature-detected. File: AutoRollPanel.tsx (+ Watch mode). Accept: no errors when unsupported. Tests: unit with mocked wakeLock.

### 74. [I068] Felt texture, rail and table lighting (S)

Add subtle felt noise (SVG feTurbulence or CSS gradient), a padded rail edge and soft vignette to the table SVG; dark-mode variant. Files: Table.tsx/regionArt.tsx, sim.css. Keep cost low (single filter, no images; single-file build size +<2KB). Accept: screenshots updated; no contrast regressions (axe). Test: visual regression snapshot.

### 75. [I086] Performance budget test for simulation and rendering (S)

Add a vitest bench/regression test: simulateMany 1000 rolls x 100 sessions under a generous time limit, and 200 instant rolls in Simulator under N ms (happy-dom); CI asserts single-file gzip size below a budget. Measured today: 10000x100 auto-roll ~0.8s with 76ms max long task; 200 instant UI rolls ~10s via Playwright. Files: src/sim/strategy/perf.test.ts, tests/build. Accept: thresholds documented; flaky-safe margins.

### 76. [I074] Local session journal (M)

When the sandbox is reset (or after N rolls idle) save a session summary (date, rules, rolls, start/end, expected vs actual, luck) to localStorage, list the last 20 in a Journal view under Play with clear/export. Files: src/app/storage.ts, new src/app/screens/Journal.tsx, Simulator onEvent. Accept: entries survive reload, capped size, clear works. Tests: storage tests + app test. Not gambling promotion: shows expected loss prominently.

### 77. [I087] First-visit sandbox coach marks (M)

Dismissible 3-step overlay on first sandbox visit: pick a chip, tap Pass Line, roll; persisted 'seen'. Reuses region highlight from scene runner (highlightedFor). Files: Simulator.tsx/new CoachMarks.tsx, persist. Accept: never shows again after dismiss; skippable via keyboard; reduced-motion safe. Tests: Simulator.test.

- 2026-10-21 04:32 held until I081 (Simulator.tsx refactor) merges, to avoid conflicts

### 78. [I067] Dice throw with deterministic physics-like path (M)

Replace the 2D tumble with a throw from the shooter end that bounces off the back wall and settles in a free area (not covering box text, which happens now over COME). Pure function diceTrajectory(seed,layout)->keyframes in animation.ts, CSS custom props in Dice.tsx; dice remain on felt until next roll, faded. Accept: dice never overlap number labels at rest in portrait/landscape; <=1s normal, <=0.4s fast, none in instant. Tests: unit tests on trajectory bounds per layout.

### 79. [I077] Sound effects with Web Audio (chip) (M)

Implements docs/chips.md: synthesized dice rattle/land and chip clack via Web Audio (no files), off by default, Settings toggle, muted in instant mode. Files: new src/sim/ui/sound.ts, settings, Simulator event hooks. Accept: no AudioContext created until first user gesture with sound on; single-file size +<3KB. Tests: unit test with mocked AudioContext.

### 80. [I078] Lesson 20 comparison table as stacked cards on narrow phones (chip) (S)

Implements docs/chips.md item: at <=420px render the 4-column comparison as stacked cards (CSS only via data-labels, or a responsive table component in the content renderer). Files: src/app/styles/app.css, content compile if needed. Accept: no wrapped headers at 390px; table semantics kept for SR. Tests: e2e screenshot/overflow check on lesson 20.

### 81. [I088] Realistic layout fidelity: come points, odds and lay positions (L)

Place chips where a dealer would: come-bet chips in the come-point area of each box, don't-come/lay on the top bar, odds offset on the flat bet, buy/lay buttons on chips, working/off buttons as mini pucks; add Don't Pass odds area. Touches layouts/portrait.ts, landscape.ts, Table.tsx, ChipStack.tsx, regionArt.tsx. Accept: each bet type renders at a documented spot in both layouts; layouts.test.ts covers positions; screenshots updated.

### 82. [I036] PROPOSAL: crapless craps rules variant (2, 3, 11, 12 become points) (L)

PROPOSAL (new variant, extends the rules model; does not conflict with decisions but expands PointNumber): `rules.variant: 'standard'|'crapless'`. Come-out: only 7 wins; 2,3,4,5,6,8,9,10,11,12 become points; odds on 2/12 pay 6:1, 3/11 3:1; place 2/12 11:2, 3/11 11:4. Pass edge rises to 5.38%. WHERE: engine types (PointNumber widening — touches many maps: maxOdds, layouts boxes), rules.ts, bets.ts, resolve.ts, math outcomes/expectedRolls, layouts (extra boxes for 2/3/11/12 in a crapless layout), lessons optional. WHY: a striking 'looks better, is worse' lesson for the sucker-bets/myths chapter: no craps loss but a much bigger edge. ACCEPTANCE: exact pass edge 5.38% (= 0.053805…) in targets test; resolution matrix extended; all existing standard tests unchanged; Markov cross-check passes for the variant. Large blast radius — do after I033.

- 2026-10-21 04:32 PROPOSAL: needs product-owner sign-off

### 83. [I037] PROPOSAL (changes a decision): simulate Fire Bet and All/Tall/Small side bets (L)

PROPOSAL to change decisions.md ('Bonus side bets: mentioned only, not simulated in v1'). Multi-hand bets whose state spans the shooter's hand: Fire (distinct points made: 4/5/6 → 24/249/999 paytable), All/Tall/Small (hit every 2-6 / 8-12 before a 7). Engine needs bet-level memory (`bet.progress: number[]`), resolve on seven-out, math via Markov over subsets (exact rational, curriculum §7 numbers 20.76%, ~7.5–7.8%). UI: small side-bet rail. WHY: lesson 13 quotes these figures but learners can't experience how rarely they hit; the long-shot appeal is a key sucker-bet lesson. ACCEPTANCE: exact EV by subset-Markov equals curriculum numbers (tests); MC within 4σ; decisions.md updated with owner approval first. Only start after product owner agrees.

- 2026-10-21 04:32 PROPOSAL: needs product-owner sign-off

### 84. [I046] Refactor Simulator.tsx (1061 lines) into hooks/modules: game+scene state, sheet controller, animation queue, settings/persist (L)

WHAT: split src/sim/ui/Simulator.tsx into useSimGame (engine + scene runner + log), useBetSheet (sheet state, type options, quick actions), useAnimationQueue, useSandboxSettings (url params, persist), plus thin presentational composition. Public API (Simulator, mountSimulator, SimulatorEvent) unchanged. WHY: almost every learning feature (I005, I014-I016, I022, I030, I033, I039, I042) touches Simulator.tsx; parallel work will conflict without this. ACCEPTANCE: no behaviour change: all existing vitest + Playwright e2e pass unmodified; each hook has a focused unit test; Simulator.tsx < 300 lines. Do first among M/L items that touch Simulator.tsx (beta lane; added by alpha under deadline).

- 2026-10-21 04:31 duplicate of I081 (merged; keep I081)

### 85. [I049] Auto-roll Watch mode: replay a short run on the table, roll by roll (chip) (M)

WHAT (docs/chips.md): for 1 session ≤100 rolls, a Watch button replays the SessionResult on the table at fast speed via the animation queue (strategy decide() actions + rolls re-applied with the same seed), pausable, tap to skip. WHERE: AutoRollPanel.tsx, Simulator.tsx, animation.ts; share playback with I016 demo steps. WHY: connects abstract bankroll chart to concrete table events. ACCEPTANCE: replay reaches the identical final equity as the simulation (test); respects reduced motion/instant; e2e watch 10 rolls. Move chip to Done.

- 2026-10-21 04:31 duplicate of I069 (merged; keep I069)

### 86. [I051] Optional Web Audio sound effects (dice, chips), off by default (chip) (S)

WHAT (docs/chips.md 'Sound effects'): generated with Web Audio (no files), toggle in Settings persisted with sim settings, silent in instant speed. WHERE: new src/sim/ui/sound.ts, settings.ts, Simulator.tsx hooks on dice-rolled/bet-won/lost. ACCEPTANCE: unit test that no AudioContext is created when off; settings persistence test; single-file build size increase < 3 kB. Move chip to Done.

- 2026-10-21 04:31 duplicate of I077 (merged; keep I077)

### 87. [I053] Lesson 20 comparison table: stacked cards on narrow phones (chip) (S)

WHAT (docs/chips.md): at <480px render the four-column comparison table in content/lessons/20-strategy-fun-per-dollar.md as stacked cards via CSS (src/app/styles) or a responsive table class in the markdown pipeline. ACCEPTANCE: Playwright screenshot at 390px shows no wrapped headers and no horizontal scroll; desktop unchanged. If I040 lands, the static table may be replaced by the interactive one.

- 2026-10-21 04:31 duplicate of I078 (merged; keep I078)

### 88. [I055] Shareable scene/sandbox state links (seed + rules + bets in the URL) (M)

WHAT: encode the current sandbox (rules overrides, seed, phase/point, bets) as a compact URL param (#/play?s=<base64url JSON>) with a Share button; Simulator readUrlParams decodes and validates via validateScene before applying. WHY: learners/teachers can share a situation ('what should I do here?'); authors can prototype scenes in the sandbox and copy them as scene YAML. ACCEPTANCE: round-trip test encode→decode equals state; invalid/oversized payload ignored with a toast; 'Copy as scene YAML' produces YAML that passes validateScene. Coordinate with I041's ?bet param.

- 2026-10-21 04:31 duplicate of I071 (merged; keep I071)

