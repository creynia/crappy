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

### Session plan panel
A small planner: pick bankroll, unit, strategy and session length, and see
expected loss, risk of ruin and a suggested stop-loss before you play.

### Auto-roll "Watch" mode
Replay a short auto-roll run on the table itself, roll by roll.

### Lesson 20 summary table on narrow phones
At 390px the four-column comparison table wraps its headers; consider a
stacked card layout.

## Done

- Combined edge with two Come bets (PR #18): `combinedEdge` uses the managed bet (`betId` / `parentId`) for every lookup, so set-amount and odds on the second Come bet no longer fall back to the first.
- Contract-bet sheet wording: a Pass/Come bet already on a point shows its current value (for example "Pass line on 4: worth -$3.33 right now") instead of "Expected loss $0.00" (I002).
- Hop bets (I035): one-roll bets on a specific dice pair (hard hop 30:1, easy hop 15:1), with a 21-pair picker in the center panel.
- "Call the bet" practice mode (I028): a drill at `#/practice/call-the-bet` with a legal layout and a roll; the learner calls every stack Wins / Loses / Pushes / Travels / Off / Stays, answered from the engine's own resolution, in three levels (line bets; come and odds; place, hardways and props).
