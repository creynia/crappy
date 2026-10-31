---
id: buy-and-lay
title: "Buy and Lay bets: paying commission"
chapter: more-bets
summary: Buy bets pay true odds minus a commission, and Lay bets are the Don't-side version. Learn when Buy beats Place.
minutes: 7
sources:
  - woo-craps-appendix-1
---

**Buy bets** are like place bets, except the casino pays **true odds** (2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8) and charges a **5% commission**, called the **vig**. In this app, as at many Las Vegas casinos, the vig is **5% of your bet, rounded down to whole dollars (minimum $1), and taken only when you win**.

That rounding is why you should **buy for $20 or more**. At $20 to $39 the vig is $1, so the $1 vig is exactly 5% of a $20 buy. Buy for less and the $1 minimum takes a bigger bite: a $10 buy on the 4 costs 3.33% instead of 1.67%. Buy a bit more than $20 and the vig stays at $1: a $25 buy on the 4 costs just 1.33%.

| Buy (for $20) | House edge (vig on win) | Compare Place |
|---|---|---|
| 4 / 10 | **1.67%** | 6.67% → **buy these instead** |
| 5 / 9 | 2.00% | 4.00% → buying is cheaper, if you buy $20 or more |
| 6 / 8 | 2.27% | **1.52% → place these instead** |

So the rule of thumb is: **place the 6 and 8, buy the 4 and 10** (and buy the 5 and 9 if you really want them). A Buy 4 wins +$40 less the $1 vig, so you collect $39; a Buy 5 or 9 for $20 wins $30 less $1 = $29; a Buy 6 or 8 for $20 wins $24 less $1 = $23. For 5/9 and 6/8, full-pay units are $2 and $5, so $20 works everywhere.

Some casinos take the vig **up front**, when you make the bet. The edge is then measured against your bet **plus** the vig, and every buy bet costs **4.76%**: still better than placing the 4/10, but no longer cheap.[^1]

**Lay bets** are the reverse: you bet that **7 comes before** the number. 7 is more likely, so you have to risk more than you win. You pay true odds the other way (lay $2 to win $1 against 4/10, $3 to win $2 against 5/9, $6 to win $5 against 6/8), and the vig is **5% of what you win**, rounded down to whole dollars with a $1 minimum.[^1] To make that $1 vig worth it, lay in the efficient amounts: **$40** against the 4 or 10, **$30** against the 5 or 9, and **$24** against the 6 or 8. Each of those wins $20, less a $1 vig, so you collect $19.

| Lay | House edge (vig on win) | Vig paid up front |
|---|---|---|
| 4 / 10 (lay $40) | **1.67%** | 2.44% |
| 5 / 9 (lay $30) | 2.00% | 3.23% |
| 6 / 8 (lay $24) | 2.27% | 4.00% |

Lay bets are **always working**, including on the come-out, and you can take them down at any time. Taking a bet down doesn't cost any vig.

If you want to bet against numbers, a **Don't Come bet with lay odds** is cheaper still (lesson 11).

:::math Buy and Lay edges
Vig is 5% of the bet on a win, rounded down to whole dollars (minimum $1).
Buy 4, $20: win (1/3) pays 40 − 1 = 39; lose (2/3) −20. EV = 13 − 13.33 = −0.333 → −0.333/20 = **1.667%** (1/60).
Buy 5, $20: (2/5)(30 − 1) − (3/5)(20) = 11.6 − 12 = −0.4 → **2.00%** (1/50). Buy 6, $20: (5/11)(24 − 1) − (6/11)(20) = −5/11 → **2.27%** (1/44).
Buy 4, $25: (1/3)(50 − 1) − (2/3)(25) = −1/3 → 0.333/25 = **1.33%**. Buy 4, $10: (1/3)(20 − 1) − (2/3)(10) = −1/3 → **3.33%**.
Vig up front: you risk $20 + $1 = $21 on an otherwise fair bet and expect to lose the $1 vig: 1/21 = **4.76%**.

Lay 4, $40, wins $20 with P = 2/3, vig $1 on the win: (2/3)(19) − (1/3)(40) = −2/3 → 0.667/40 = **1.667%** (1/60).
Lay 5, $30, wins $20 with P = 3/5: (3/5)(19) − (2/5)(30) = −0.6 → **2.00%** (1/50). Lay 6, $24, wins $20 with P = 6/11: (6/11)(19) − (5/11)(24) = −6/11 → **2.27%** (1/44).
Up front: the vig is $1 on top of the lay, so the edge is 1/(lay + vig) = 1/41 = 2.44% (4/10), 1/31 = 3.23% (5/9), 1/25 = 4.00% (6/8).
:::

```scene
id: l10-s1
version: 1
title: Buy the 10
rules: standard-vegas
bankroll: 50000
phase: point
point: 6
allowedBets: [buy-10, place-10]
highlightedBets: [buy-10]
showEV: true
steps:
  - id: compare
    text: "Tap **Place 10**: 6.67%, **Costly**. Now tap **Buy 10**: 1.67% at $20, a **Good bet**."
    completeWhen:
      all:
        - { previewed: place-10 }
        - { previewed: buy-10 }
  - id: buy
    text: "Buy the 10 for **$20**."
    expect:
      - { type: place-bet, betType: buy-10, amount: 2000 }
    completeWhen: { betOnTable: { type: buy-10, minAmount: 2000 } }
  - id: roll
    text: "Roll: 10! You win $40, less a $1 vig = $39."
    forcedDice: [[5, 5]]
    allowedActions: [roll]
    completeWhen: { event: bet-won, betType: buy-10 }
```

```scene
id: l10-s2
version: 1
title: Lay the 4
rules: standard-vegas
bankroll: 50000
allowedBets: [lay-4]
highlightedBets: [lay-4]
showEV: true
steps:
  - id: lay-1
    text: "Lay **$40** against the 4. It's working even on the come-out."
    expect:
      - { type: place-bet, betType: lay-4, amount: 4000 }
    completeWhen: { betOnTable: { type: lay-4, minAmount: 4000 } }
  - id: lose
    text: "Roll: hard 4. You lose $40. Ouch: laying means risking more to win less."
    forcedDice: [[2, 2]]
    allowedActions: [roll]
    completeWhen: { event: bet-lost, betType: lay-4 }
  - id: lay-2
    text: "Lay $40 against the 4 again."
    expect:
      - { type: place-bet, betType: lay-4, amount: 4000 }
    completeWhen: { betOnTable: { type: lay-4, minAmount: 4000 } }
  - id: win
    text: "Roll: 7. You win $20 less a $1 vig = $19."
    forcedDice: [[3, 4]]
    allowedActions: [roll]
    completeWhen: { event: bet-won, betType: lay-4 }
```

```quiz
- q: You want to bet on the 10. What's the cheapest way (vig on win, $20 bet)?
  options: ["Place 10 (6.67%)", "Buy 10 (1.67%)", "Hard 10", "Big 6"]
  answer: 1
  explain: "Buying the 4 and 10 cuts the edge from 6.67% to 1.67%."
- q: You want to bet on the 6. Which is cheaper?
  options: ["Place 6", "Buy 6", "They're equal", "Big 6"]
  answer: 0
  explain: "Place 6 is 1.52%; Buy 6 is 2.27%; Big 6 is 9.09%."
- q: Why buy for $20 or more?
  options: ["Table minimum", "The vig rounds down to whole dollars with a $1 minimum, so small buys pay a bigger share", "Buy bets pay more above $20", "The dealer asks for it"]
  answer: 1
  explain: "$20 x 5% = $1. At $10 the $1 minimum vig makes a Buy 4 cost 3.33% instead of 1.67%."
- q: A $30 Lay bet against the 9 wins. What do you collect (vig 5% of the win)?
  options: ["$20", "$19", "$30", "$45"]
  answer: 1
  explain: "Lay 3 to win 2: $30 wins $20, less a $1 vig = $19 (you also keep your $30)."
- q: If the vig on a Buy bet is paid up front, the edge on every number is...
  options: ["1.67%", "4.76%", "5%", "0%"]
  answer: 1
  explain: "You pay $1 on a $20 bet, so you risk $21 to lose $1 on average: 1/21 = 4.76%."
```
