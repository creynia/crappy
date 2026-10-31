---
id: place-bets
title: Place bets
chapter: more-bets
summary: Bet a number directly, without waiting for a Come bet to travel, and learn which numbers are cheap.
minutes: 6
sources:
  - woo-craps-appendix-1
---

A **Place bet** lets you pick a number and bet it will roll **before a 7**. No come-out, no travelling. You hand the dealer chips and say "place the 6". The bet stays up after each win until a 7 takes it, or until you take it down.

The catch is that place bets pay **slightly less than true odds**. That shortfall is the house edge:

| Place | True odds | Pays | Bet in multiples of | House edge |
|---|---|---|---|---|
| 6 or 8 | 6:5 | **7:6** | $6 | **1.52%** |
| 5 or 9 | 3:2 | **7:5** | $5 | 4.00% |
| 4 or 10 | 2:1 | **9:5** | $5 | 6.67% |

**Place 6 and 8 are good bets**, nearly as cheap as the Pass Line (1.52% vs 1.41%).[^1] The 5/9 is meh, and 4/10 is expensive. The next lesson shows a cheaper way to bet the 4 and 10.

Rules to know:

- Place bets are **off on the come-out roll** unless you say "working". A come-out 7 doesn't take them, and a come-out 6 doesn't pay them.
- You can **take them down**, **turn them off** for a while, or **press** them (add winnings to make the bet bigger) between rolls.
- Use the right multiples. $6 on the 6 wins $7, but $5 on the 6 only wins $5 at most casinos, because the payout is rounded down. That raises your edge. The simulator warns you when your amount isn't a full-pay unit, and tells you what the bet would actually pay.

:::math Place-bet edges
Place 6: wins with P = 5/11 and pays 7/6. EV = (5/11)(7/6) − (6/11)(1) = (35/66 − 36/66) = −1/66 ≈ **−1.515%**.
Place 5: P(win) = 4/10, pays 7/5. EV = (2/5)(7/5) − 3/5 = 14/25 − 15/25 = −1/25 = **−4.00%**.
Place 4: P(win) = 3/9, pays 9/5. EV = (1/3)(9/5) − 2/3 = 9/15 − 10/15 = −1/15 ≈ **−6.67%**.
:::

:::tip
At a real table, say "place the 6" (or "place the 8") and put your chips down in the Come area. The dealer puts them on the right number for you. Don't toss chips at numbers yourself.
:::

```scene
id: l09-s1
version: 1
title: Place the 6 and 8
rules: standard-vegas
bankroll: 50000
phase: point
point: 5
bets:
  - { type: pass-line, amount: 1000 }
allowedBets: [place-6, place-8]
highlightedBets: [place-6, place-8]
showEV: true
steps:
  - id: preview-6
    text: "Tap **Place 6** to open its card. Edge 1.52%, about 9¢ on a $6 bet. Tier: green, **Good bet**."
    completeWhen: { previewed: place-6 }
  - id: place-both
    text: "Place **$6** on the 6 and **$6** on the 8."
    allowedActions: [place-bet, set-amount, remove-bet]
    completeWhen:
      all:
        - { betOnTable: { type: place-6, minAmount: 600 } }
        - { betOnTable: { type: place-8, minAmount: 600 } }
  - id: roll-6
    text: "Roll: 6. You win $7. The bet stays up."
    forcedDice: [[3, 3]]
    allowedActions: [roll]
    completeWhen: { event: bet-won, betType: place-6 }
  - id: roll-8
    text: "Roll: 8. Another $7."
    forcedDice: [[6, 2]]
    allowedActions: [roll]
    completeWhen: { event: bet-won, betType: place-8 }
  - id: roll-7
    text: "Roll: 7. Seven-out. Your Pass bet and both place bets lose."
    forcedDice: [[4, 3]]
    allowedActions: [roll]
    completeWhen: { event: seven-out }
```

```scene
id: l09-s2
version: 1
title: The 4 costs more than you think
rules: standard-vegas
bankroll: 50000
phase: point
point: 6
allowedBets: [place-4, place-5, place-6]
showEV: true
steps:
  - id: preview-4
    text: "Tap **Place 4** and read its card: 6.67% edge, tier orange, **Costly**. It suggests **Buy 4** (1.67%) instead."
    completeWhen: { previewed: place-4 }
  - id: preview-6
    text: "Now tap **Place 6** and compare. Which would you choose?"
    completeWhen: { previewed: place-6 }
```

```quiz
- q: What does a $12 Place bet on the 8 win?
  options: ["$12", "$14", "$10", "$7"]
  answer: 1
  explain: "7:6 means $7 for every $6: $12 wins $14."
- q: Which Place bet has the lowest house edge?
  options: ["4", "5", "6", "10"]
  answer: 2
  explain: "6 and 8: 1.52%. Then 5/9 at 4%, then 4/10 at 6.67%."
- q: By default, what happens to your Place 6 if a 7 rolls on the come-out?
  options: ["It loses", "It wins", "Nothing, it's off", "It's moved"]
  answer: 2
  explain: "Place bets are off on the come-out unless you call them working."
- q: Why bet $6 rather than $5 on Place 6?
  options: ["Table minimum", "$5 gets paid even money, a higher edge", "No reason", "To get 2:1"]
  answer: 1
  explain: "7:6 needs $6 units. A $5 bet is usually paid $5, and the edge jumps to about 9.1%."
```
