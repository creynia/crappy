# Chips: future work

"Chips" are small, self-contained ideas we've deliberately deferred. Each one
should be pick-up-able by a new contributor. When you start a chip, open an
issue/PR and link it here; when it ships, move it to **Done**.

## Open

### Sound effects
Optional dice-rattle, dice-land and chip-clack sounds in the simulator.
- Off by default; toggle in Settings (persisted with other settings).
- Respect the existing animation speed / fast mode (no sound in instant mode).
- Generate sounds with the Web Audio API (no audio files) so the single-file
  offline build stays small.

### Contract-bet sheet wording
For a Pass/Come bet already on a point, the sheet shows "Expected loss: $0.00".
Show the bet's current (positive) value instead, or hide the loss line.

### Auto-roll "Watch" mode
Replay a short auto-roll run on the table itself, roll by roll.

### Lesson 20 summary table on narrow phones
At 390px the four-column comparison table wraps its headers; consider a
stacked card layout.

## Done

- Session plan panel (I011): a Plan tab in Auto-roll with bankroll, unit, strategy and hours. It shows the analytic expected loss at once, then simulated bust and ahead rates (500 seeded sessions), a suggested stop-loss and the bankroll that keeps bust under 5% (`strategy/plan.ts`).
- Combined edge with two Come bets (PR #18): `combinedEdge` uses the managed bet (`betId` / `parentId`) for every lookup, so set-amount and odds on the second Come bet no longer fall back to the first.
- Hop bets (I035): one-roll bets on a specific dice pair (hard hop 30:1, easy hop 15:1), with a 21-pair picker in the center panel.
- "Call the bet" practice mode (I028): a drill at `#/practice/call-the-bet` with a legal layout and a roll; the learner calls every stack Wins / Loses / Pushes / Travels / Off / Stays, answered from the engine's own resolution, in three levels (line bets; come and odds; place, hardways and props).
