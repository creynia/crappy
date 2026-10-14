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

### Hop bets
One-roll bets on a specific dice combination (hard hop 30:1, easy hop 15:1).
Needs a dice-pair picker in the center panel and a `dice` parameter on the bet.

### "Call the bet" practice mode
A drill where the app names a dice result and the learner calls out which bets
win, lose or stay (dealer-style). Builds table fluency.

### Session plan panel
A small planner: pick bankroll, unit, strategy and session length, and see
expected loss, risk of ruin and a suggested stop-loss before you play.

### Combined edge with two Come bets
`combinedEdge` in `src/sim/ui/text.ts` falls back to the first Come bet when the
sheet manages a Come bet via `set-amount`; use the bet being managed so the max
odds multiple comes from the right point.

### Contract-bet sheet wording
For a Pass/Come bet already on a point, the sheet shows "Expected loss: $0.00".
Show the bet's current (positive) value instead, or hide the loss line.

### Auto-roll "Watch" mode
Replay a short auto-roll run on the table itself, roll by roll.

### Lesson 20 summary table on narrow phones
At 390px the four-column comparison table wraps its headers; consider a
stacked card layout.

## Done

_(nothing yet)_
