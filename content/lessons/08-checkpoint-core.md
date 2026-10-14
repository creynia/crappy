---
id: checkpoint-core
title: "Checkpoint: the core game"
chapter: core-game
summary: A cumulative quiz and a practice scene covering lessons 1 to 7.
minutes: 8
---

Time to check what you've learned from lessons 1 to 7: phases, Pass and Come, odds and the house edge. Aim for 75% or better, and if you miss some, revisit the lesson the question came from. You can retake it as often as you like.

Then play a short practice session using only Pass, Come and Odds.

```scene
id: l08-s1
version: 1
title: Play it right
bankroll: 30000
phase: come-out
allowedBets: [pass-line, pass-odds, come, come-odds]
showEV: true
evDetail: basic
ui:
  compact: true
  chips: [500, 1000, 2500]
  defaultChip: 1000
steps:
  - id: play
    text: "Play about 30 rolls using only Pass, Come and Odds. Take full odds when you can."
    completeWhen: { rolls: 30 }
  - id: panel
    text: "Open the session panel. Your edge per dollar should land well under 0.5%."
    completeWhen: { acknowledged: true }
    advance: button
```

```quiz
- q: The puck is OFF. Which bet can you make right now?
  options: ["Pass Line", "Pass Odds", "Come Odds", "None"]
  answer: 0
  explain: "With the puck OFF it's a come-out: the time to bet the Pass Line. Odds need a point."
- q: The point is 10, and you have $5 on Pass with $15 odds. 10 rolls. You win...
  options: ["$20", "$35", "$45", "$15"]
  answer: 1
  explain: "$5 even money + $15 at 2:1 ($30) = $35."
- q: Which has the lowest house edge per dollar bet?
  options: ["Pass alone", "Pass + 1× odds", "Pass + 3-4-5× odds", "Come alone"]
  answer: 2
  explain: "1.41% → 0.85% → 0.37%. More money at 0% lowers the blend."
- q: What's the chance of making a point of 8?
  options: ["5/36", "5/11", "1/2", "6/11"]
  answer: 1
  explain: "5 ways to roll 8 against 6 ways to roll 7: 5/(5+6)."
- q: On the come-out, a natural is how many times as likely as craps?
  options: ["Same", "1.5×", "2×", "3×"]
  answer: 2
  explain: "8 ways (7, 11) vs 4 ways (2, 3, 12)."
- q: Which bet can you remove at any time?
  options: ["Pass after a point", "Come after it moved to a number", "Odds", "None"]
  answer: 2
  explain: "Pass and Come flat bets are contracts once a point is set; odds can always come down."
```
