---
id: pass-line
title: The Pass Line
chapter: core-game
summary: Place your first bet, follow it through a full round and learn why it is a contract.
minutes: 6
---

The **Pass Line** is the classic craps bet, often called betting "with the shooter" or "right". You put chips on the Pass Line **before a come-out roll**, and lesson 3 told you what happens next:

* Come-out 7 or 11: **win**.
* Come-out 2, 3 or 12: **lose**.
* Come-out 4, 5, 6, 8, 9 or 10: that's the point. Then you **win** if the point comes again before a 7, and **lose** if 7 comes first.

A win pays **even money**: bet $10, win $10, and you keep your original $10.

Once a point is set, your Pass bet is locked in. It's a **contract bet**: you can't pick it up until it wins or loses. (That's because you already enjoyed the come-out, where you were the favourite.)

How good is it? Out of every 495 Pass bets, on average you win **244** and lose **251**. That's **49.3%** wins, a hair under a coin flip. The small gap is how the casino makes its money, and lesson 5 puts a number on it.

:::math Probability of winning a Pass bet
Win on the come-out: P(7 or 11) = 8/36.
Win by making a point: sum over points of P(point is set) × P(point before 7):

* 4: 3/36 × 3/9 = 1/36
* 5: 4/36 × 4/10 = 2/45
* 6: 5/36 × 5/11 = 25/396
* 8, 9, 10 mirror 6, 5, 4.

Total win = 8/36 + 2 × (1/36 + 2/45 + 25/396) = **244/495 ≈ 49.29%**. Lose = 251/495 ≈ 50.71%.
:::

```scene
id: l04-s1
version: 1
title: Your first bet
bankroll: 20000
phase: come-out
forcedDice: [[4, 4], [2, 3], [6, 2]]
allowedBets: [pass-line]
highlightedBets: [pass-line]
showEV: false
ui:
  compact: true
  chips: [500, 1000, 2500]
  defaultChip: 1000
steps:
  - id: place
    text: "Pick the **$10** chip and tap the **Pass Line**."
    completeWhen: { action: { type: place-bet, betType: pass-line, amount: 1000 } }
  - id: point
    text: "Tap **Roll**. 8 is the point. Notice your Pass bet now has a lock icon: it's a contract bet."
    completeWhen: { point: 8 }
  - id: five
    text: "Roll. A 5 does nothing to your bet."
    completeWhen: { rolls: 1 }
  - id: made
    text: "Roll. 8! You made the point. You win $10 and keep your $10 bet."
    completeWhen: { event: point-made }
```

```scene
id: l04-s2
version: 1
title: Play a few rounds
bankroll: 20000
phase: come-out
allowedBets: [pass-line]
highlightedBets: [pass-line]
showEV: false
ui:
  compact: true
  chips: [500, 1000, 2500]
  defaultChip: 1000
steps:
  - id: play
    text: "Bet the Pass Line and roll 20 times. Your bet stays up after a win, so you only re-bet after a loss."
    completeWhen: { rolls: 20 }
```

```quiz
- q: What does a $10 Pass Line bet win when the point is made?
  options: ["$5", "$10", "$20", "Depends on the point"]
  answer: 1
  explain: "The Pass Line always pays even money, whatever the point."
- q: Can you take your Pass bet down after the point is set?
  options: ["Yes, any time", "No, it's a contract bet", "Only if the point is 4 or 10", "Only after a 7"]
  answer: 1
  explain: "Once a point is set the Pass bet stays until it wins or loses."
- q: Roughly how often does a Pass bet win?
  options: ["About 33%", "About 49%", "About 55%", "Exactly 50%"]
  answer: 1
  explain: "244 out of 495, or 49.29%, a little below even."
```
