---
id: field-and-big-6-8
title: Field and Big 6/8
chapter: more-bets
summary: Why seven numbers beat four only on paper, and why Big 6/8 is just a worse Place 6/8.
minutes: 5
sources:
  - woo-craps-appendix-1
---

**The Field** is a one-roll bet. Win if the next roll is 2, 3, 4, 9, 10, 11 or 12; lose on 5, 6, 7 or 8. Most winners pay even money, but 2 and 12 pay extra.[^1]

It looks generous: seven winning numbers against only four losing ones! But count **ways**, not numbers. The four losers (5, 6, 7, 8) are the four most common totals: **20 ways out of 36**. The winners have only 16.

| Field variant | 2 pays | 12 pays | House edge |
|---|---|---|---|
| This app's default | 2:1 | 2:1 | **5.56%** |
| Better tables | 2:1 | 3:1 | 2.78% |

Because it settles on every roll, the Field's cost piles up fast. That idea gets its own lesson (14).

**Big 6 / Big 8** sits in the corner. It wins if the 6 (or 8) rolls before a 7, the **exact same thing as Place 6/8**, but it pays only **even money** instead of 7:6. That pushes the edge from 1.52% to **9.09%**, which the simulator labels a **Sucker bet**. There's never a reason to bet Big 6/8; place the number instead. (Atlantic City removed it altogether.)[^1]

:::math Field and Big 6/8
Field (2:1 on 2 and 12): EV = [1 × (2+3+4+3+2) + 2 × 1 + 2 × 1 − 20]/36 = (14 + 4 − 20)/36 = −2/36 = **−5.556%**.
With 3:1 on 12: (14 + 2 + 3 − 20)/36 = −1/36 = **−2.778%**.

Big 6: P(win) = 5/11, pays 1:1. EV = 5/11 − 6/11 = −1/11 = **−9.09%**.
:::

```scene
id: l12-s1
version: 1
title: Seven numbers, four numbers
rules: standard-vegas
bankroll: 50000
allowedBets: [field]
highlightedBets: [field]
showEV: true
autoRoll:
  enabled: true
  strategies: [field-every-roll]
  defaultStrategy: { id: field-every-roll, unit: 500 }
  rollOptions: [200]
  sessions: [1]
steps:
  - id: preview-field
    text: "Tap the **Field**. Edge 5.56%, tier orange, **Costly**, and it suggests the Pass Line (1.41%)."
    completeWhen: { previewed: field }
  - id: auto
    text: "Open auto-roll: **Field every roll**, $5, **200 rolls**. Compare the result with the expected loss of 200 × $5 × 5.56% ≈ $56."
    completeWhen: { autoRollCompleted: { minRolls: 200 } }
```

```scene
id: l12-s2
version: 1
title: Big 6 vs Place 6
rules: standard-vegas
bankroll: 50000
phase: point
point: 9
allowedBets: [big-6, place-6]
highlightedBets: [big-6, place-6]
showEV: true
steps:
  - id: place-both
    text: "Put $6 on **Big 6** and $6 on **Place 6**."
    allowedActions: [place-bet, set-amount, remove-bet]
    completeWhen:
      all:
        - { betOnTable: { type: big-6, minAmount: 600 } }
        - { betOnTable: { type: place-6, minAmount: 600 } }
  - id: roll
    text: "Roll: 6. Both win, but Big 6 pays $6 and Place 6 pays $7. Same bet, worse price."
    forcedDice: [[2, 4]]
    allowedActions: [roll]
    completeWhen: { event: bet-won, betType: big-6 }
```

```quiz
- q: How many of the 36 combinations win a Field bet?
  options: ["7", "16", "20", "18"]
  answer: 1
  explain: "2 (1) + 3 (2) + 4 (3) + 9 (4) + 10 (3) + 11 (2) + 12 (1) = 16."
- q: Big 8 and Place 8 both win when...
  options: ["8 rolls before 7", "8 rolls next", "8 rolls as a pair", "Any even number"]
  answer: 0
  explain: "It's the same event; only the payout differs (1:1 vs 7:6)."
- q: Which has the higher edge?
  options: ["Field paying 3:1 on 12", "Field paying 2:1 on 12", "Equal", "Place 8"]
  answer: 1
  explain: "2:1 on 12 → 5.56%; 3:1 on 12 → 2.78%; Place 8 → 1.52%."
```
