---
id: dice-and-combinations
title: Two dice, 36 outcomes
chapter: foundations
summary: Count the 36 ways two dice can land and see why 7 rules the table.
minutes: 6
---

Craps is played with two ordinary six-sided dice. Each die is fair, so every face has the same chance.

Paint one die red and one blue. The red die can land 6 ways and the blue die 6 ways, which makes **6 × 6 = 36 combinations**, each just as likely as the others. A red 1 with a blue 6 is a different combination from a red 6 with a blue 1, even though both total 7.

What matters in craps is the **total**. Totals are not equally likely, because some have more combinations:

| Total | 2 | 3 | 4 | 5 | 6 | **7** | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ways | 1 | 2 | 3 | 4 | 5 | **6** | 5 | 4 | 3 | 2 | 1 |
| Chance | 2.8% | 5.6% | 8.3% | 11.1% | 13.9% | **16.7%** | 13.9% | 11.1% | 8.3% | 5.6% | 2.8% |

Notice the shape: the ways climb by one up to 7, then fall again. **7 is the most likely total, at 6 ways out of 36, or 1 in 6.** Nearly every bet in craps is a bet on whether some number shows up before a 7 does, so it pays to remember the column of "ways".

A trick for remembering: totals the same distance from 7 have the same number of ways. 6 and 8 both have 5 ways, 5 and 9 have 4, 4 and 10 have 3, 3 and 11 have 2, and 2 and 12 have 1.

Some totals can be rolled as a **pair** (both dice the same): 2-2 is a "hard 4", 3-3 a "hard 6", 4-4 a "hard 8" and 5-5 a "hard 10". Any other way to make those totals is "easy". Hard 6 is one combination; easy 6 is four (1-5, 5-1, 2-4, 4-2).

:::math Counting the 36 combinations
Each die shows 1 to 6 independently, so the outcomes are the ordered pairs (red, blue): 6 × 6 = 36, each with probability 1/36.

Ways to make total *t*: for *t* from 2 to 7 it is *t* − 1; for *t* from 7 to 12 it is 13 − *t*. Check: 1+2+3+4+5+6+5+4+3+2+1 = 36.

P(7) = 6/36 = 1/6 ≈ 16.67%. P(6) = 5/36 ≈ 13.89%.
:::

Try it yourself. No betting yet: just roll and watch the totals.

```scene
id: l01-s1
version: 1
title: Roll the dice
bankroll: 0
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
  showHistory: true
steps:
  - id: roll-a-few
    text: "No betting yet. Tap **Roll** a few times and watch the total."
    completeWhen: { rolls: 3 }
  - id: roll-ten
    text: "Keep going. Roll 10 times in all and see which totals show up most."
    completeWhen: { rolls: 7 }
```

Now let the computer do the rolling. Over a few hundred rolls the shape from the table appears on its own.

```scene
id: l01-s2
version: 1
title: 7 vs 2, 600 times
bankroll: 0
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
autoRoll:
  enabled: true
  strategies: [no-bet]
  defaultStrategy: { id: no-bet, unit: 100 }
  rollOptions: [600]
  sessions: [1]
steps:
  - id: auto-roll
    text: "Tap **Auto-roll 600**. The tally chart fills in."
    completeWhen: { autoRollCompleted: { minRolls: 600 } }
  - id: compare
    text: "Compare the 7 bar with the 2 and 12 bars. You should see about 100 sevens and about 17 of each of 2 and 12. Real results wobble, and that's normal."
    completeWhen: { acknowledged: true }
    advance: button
```

The tally chart is a histogram of the 11 totals, with the expected counts drawn as faint outlines.

```quiz
- q: How many equally likely combinations do two dice have?
  options: ["11", "12", "36", "21"]
  answer: 2
  explain: "6 faces × 6 faces = 36. The 11 totals are not equally likely."
- q: Which total is most likely?
  options: ["6", "7", "8", "They're all equal"]
  answer: 1
  explain: "7 can be made 6 ways (1-6, 2-5, 3-4, 4-3, 5-2, 6-1), more than any other total."
- q: How many ways can you roll a 9?
  options: ["3", "4", "5", "6"]
  answer: 1
  explain: "3-6, 4-5, 5-4, 6-3. Shortcut: 9 is two away from 7, so it has 6 − 2 = 4 ways."
- q: Which of these is a "hard 8"?
  options: ["2-6", "3-5", "4-4", "6-2"]
  answer: 2
  explain: "Hard means a pair. 4-4 is the only hard 8; the other four ways are easy 8s."
```
