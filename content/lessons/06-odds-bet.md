---
id: odds-bet
title: "Odds: the best bet in the house"
chapter: core-game
summary: The one bet with no house edge, and how it shrinks the cost of your Pass bet.
minutes: 9
---

Once a point is set and you have a Pass bet, you may add a second bet **behind** it, called **taking the odds**. It wins if the point is made and loses on a 7, exactly like your Pass bet. The difference is how it's paid: at **true odds**, the exact ratio of losing to winning chances.

| Point | Ways to make it vs 7 | Odds pay | Max at 3-4-5x (on a $10 Pass bet) |
|---|---|---|---|
| 4 or 10 | 3 vs 6 | **2 : 1** | $30 (wins $60) |
| 5 or 9 | 4 vs 6 | **3 : 2** | $40 (wins $60) |
| 6 or 8 | 5 vs 6 | **6 : 5** | $50 (wins $60) |

Because the payout matches the true chance exactly, **the Odds bet has a house edge of zero**. It's the only bet in the casino with no edge, and it's why the casino doesn't print it on the layout. You just have to know it exists.

The maximums at a "3-4-5x" table are set so a winning odds bet always pays 6× your flat bet. Some casinos allow 10× or even 100×.

Why it matters: your Pass bet still costs 1.41% of the flat bet, but now more of your money is riding at 0%. Averaged over everything you bet, the edge drops:

| Odds taken | Edge per dollar bet (Pass + Odds) |
|---|---|
| None | 1.41% |
| 1× | 0.85% |
| 2× | 0.61% |
| **3-4-5×** | **0.37%** |
| 10× | 0.18% |
| 100× | 0.02% |

One honest caveat. Odds lowers the edge **per dollar bet**, but it doesn't cut the dollars you expect to lose, which are still 1.41% of your flat bet. What it changes is that you get far more action for the same expected cost, and bigger swings. In practice, "perfect" craps means a small flat bet with as much odds as you're comfortable with.

Odds bets **can be taken down or reduced at any time**, though there's never a math reason to. Bet sizes matter. Use multiples of $2 on 5/9 and $5 on 6/8, because real casinos don't pay out fractions of a dollar.

:::math Why Odds has zero edge, and the 0.374% figure
Odds on 4: win 1/3 of the time, paid 2:1. EV = (1/3)(2) − (2/3)(1) = 0. Similarly 5: (2/5)(3/2) − 3/5 = 0, and 6: (5/11)(6/5) − 6/11 = 0.

Combined edge = expected loss ÷ expected total wagered. Per $1 of Pass:
expected odds wagered = P(4 or 10) × 3 + P(5 or 9) × 4 + P(6 or 8) × 5 = (6/36)3 + (8/36)4 + (10/36)5 = 100/36 ≈ 2.778.
Combined edge = (7/495) / (1 + 100/36) = **0.374%**.

With flat N× odds: (7/495) / (1 + N × 24/36). N = 1: 0.848%; 2: 0.606%; 10: 0.184%; 100: 0.0209%.
:::

:::tip
To take odds, set the chips just behind your Pass bet, off the line, or hand them to the dealer and say "odds, please."
:::

```scene
id: l06-s1
version: 1
title: Taking odds
bankroll: 50000
phase: point
point: 5
bets:
  - { ref: p, type: pass-line, amount: 1000 }
forcedDice: [[6, 2], [4, 1]]
allowedBets: [pass-odds]
highlightedBets: [pass-odds]
showEV: true
evDetail: basic
ui:
  compact: true
steps:
  - id: add-odds
    text: "The point is 5 and you have $10 on the Pass Line. Tap your Pass bet to add **Odds**. The max here is $40 (4×). Place $40."
    completeWhen: { action: { type: place-bet, betType: pass-odds, amount: 4000 } }
  - id: read-ev
    text: "Tap your Odds bet. The EV panel shows 0.00% edge and a $0.00 expected loss. Tier: Free bet."
    completeWhen: { previewed: pass-odds }
  - id: roll
    text: "Roll twice. You made the 5: the Pass pays $10 and the Odds pays $60."
    completeWhen: { event: point-made }
```

```scene
id: l06-s2
version: 1
title: Same flat bet, more action
bankroll: 100000
phase: come-out
allowedBets: [pass-line, pass-odds]
highlightedBets: [pass-odds]
showEV: true
evDetail: basic
ui:
  compact: true
  chips: [500, 1000, 2500]
  defaultChip: 1000
steps:
  - id: play
    text: "Bet $10 on the Pass Line and take maximum odds on every point. Roll 40 times."
    completeWhen: { rolls: 40 }
  - id: panel
    text: "Open the session panel: total bet climbs much faster than expected loss. Your edge per dollar is about 0.37%."
    completeWhen: { acknowledged: true }
    advance: button
```

```quiz
- q: The point is 4. You have $10 on Pass and $30 in Odds. The shooter rolls a 4. How much do you win in total?
  options: ["$40", "$55", "$70", "$90"]
  answer: 2
  explain: "Pass pays even money ($10); Odds on 4 pays 2:1 ($60). Total $70."
- q: What is the house edge on the Odds bet?
  options: ["1.41%", "0.37%", "0%", "It depends on the point"]
  answer: 2
  explain: "It pays exactly true odds, so its EV is zero for every point."
- q: The point is 6. Which odds amount gets paid in full at a real table, with no rounding down?
  options: ["$12", "$22", "$25", "$33"]
  answer: 2
  explain: "6:5 needs a multiple of $5. $25 pays exactly $30. On the others the casino rounds the payout down, so you'd be giving away part of that 0% edge."
- q: Taking odds lowers which of these?
  options: ["Your expected dollar loss per round", "The house edge per dollar you bet", "Your swings", "The chance the shooter sevens out"]
  answer: 1
  explain: "Expected dollar loss is unchanged (it comes from the flat bet). Edge per dollar falls and swings get bigger."
```
