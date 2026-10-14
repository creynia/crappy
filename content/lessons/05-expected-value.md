---
id: expected-value
title: EV and house edge, in plain English
chapter: core-game
summary: Turn "the house has an edge" into a number you can read off the EV panel.
minutes: 8
---

A single bet is luck. A thousand bets are math.

**Expected value (EV)** is what a bet is worth *on average* if you could make it over and over. You find it by multiplying each result by its chance and adding up.

Try the Pass Line with $1. You win $1 244 times out of 495 and lose $1 251 times out of 495:

> EV = (244 × $1 − 251 × $1) / 495 = −$7/495 ≈ **−$0.0141**

So the average Pass bet loses about 1.4 cents per dollar. That number turned into a percentage is the **house edge: 1.41%**. Bet $10 on the Pass Line a hundred times and you should expect to be down about **$14**. That's not a promise. You might be up $80 or down $120. But the average sits at −$14, and the more you play, the more firmly your results crowd around it.

Three facts to keep in mind for the rest of the course:

1. **Nearly every bet has a negative EV.** The casino sets payouts a little below "fair". The one exception is in the next lesson.
2. **Payout odds don't tell you the edge.** A bet that pays 30:1 can be far worse than one that pays 1:1. You have to compare the payout with the true odds.
3. **The house edge is the price of playing.** You can't make it positive, but you can make it very small. That's what "perfect strategy" means in this course.

From now on, tap any bet and the simulator shows an **EV panel**. It lists the house edge, your expected loss in dollars, and a colour tier from blue "Free bet" through green "Good bet", yellow "Fair" and orange "Costly" to red "Sucker bet".

:::math EV of the Pass Line
EV = Σ (probability × net result) = (244/495)(+1) + (251/495)(−1) = −7/495 = −0.014141…

House edge = −EV per $1 wagered = **1.414%**.

Expected loss on a bet of size B = B × house edge. For B = $10: $0.141 per bet, so $14.14 per 100 bets.
:::

```scene
id: l05-s1
version: 1
title: Meet the EV panel
bankroll: 50000
phase: come-out
allowedBets: [pass-line]
highlightedBets: [pass-line]
showEV: true
evDetail: basic
ui:
  compact: true
  chips: [500, 1000, 2500]
  defaultChip: 1000
steps:
  - id: preview
    text: "Tap the **Pass Line**. The EV panel opens."
    completeWhen: { previewed: pass-line }
  - id: read
    text: "Read it: house edge 1.41%, expected loss about 14¢ on a $10 bet. Tier: Good bet."
    completeWhen: { acknowledged: true }
    advance: button
  - id: place
    text: "Place a **$10** Pass Line bet."
    completeWhen: { action: { type: place-bet, betType: pass-line, amount: 1000 } }
  - id: resolve
    text: "Now **Roll** until the bet wins or loses."
    completeWhen:
      any:
        - { event: bet-won, betType: pass-line }
        - { event: bet-lost, betType: pass-line }
```

```quiz
- q: The Pass Line's house edge is 1.41%. If you make 1,000 $5 Pass bets, about how much do you expect to lose?
  options: ["$1.41", "$14.14", "$70.71", "$141.41"]
  answer: 2
  explain: "$5 × 1,000 = $5,000 wagered; 1.414% of $5,000 ≈ $70.71."
- q: Which statement about EV is true?
  options: ["It tells you what will happen on your next bet", "It's the long-run average result per bet", "A bigger payout always means a better EV", "A negative EV means you'll lose every time"]
  answer: 1
  explain: "EV is an average. Individual bets still win or lose."
- q: A bet wins $30 with probability 1/36 and loses $1 otherwise. What is its EV per $1?
  options: ["+$0.83", "−$0.03", "−$0.14", "$0"]
  answer: 2
  explain: "(1 × 30 − 35 × 1) / 36 = −5/36 ≈ −$0.139. A 13.9% house edge, even though it pays 30:1."
```
