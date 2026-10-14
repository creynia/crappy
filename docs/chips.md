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

## Done

_(nothing yet)_
