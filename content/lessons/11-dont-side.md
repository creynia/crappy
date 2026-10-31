---
id: dont-side
title: The Don't side
chapter: more-bets
summary: Bet against the shooter. Don't Pass, Don't Come and lay odds, and how the two sides compare.
minutes: 6
sources:
  - woo-craps-appendix-1
---

The flat bets have a mirror image. **Don't Pass** (and **Don't Come**, its any-time version) bets that the shooter will **lose**:

- Come-out **2 or 3**: **win**.
- Come-out **12**: **push** (a tie, your bet stays). This is the "**bar 12**" printed on the layout. Without it, the Don't would beat the house.
- Come-out **7 or 11**: **lose**.
- A point is set: you **win if 7 comes before the point**, and lose if the point comes first.

On the come-out the Don't is the underdog (3 ways to win vs 8 ways to lose). But **once a point is set, the Don't is the favourite**. A Don't Pass on a 4 wins 2 times out of 3. Because of that, Don't bets **can** be taken down after a point is set, but you **shouldn't**: you'd be giving up the good part of the bet.

**House edge: 1.36%**, a little lower than the Pass Line's 1.41%.[^1]

**Laying odds.** Behind a Don't bet you can **lay odds**: risk more to win less, at true odds, **0% edge**. At a 3-4-5x table you may lay up to **6×** your flat bet on any point (that wins 3×, 4× or 5×). Don't Pass + 6× lay odds has a combined edge of **0.27%** per dollar, the lowest of any standard bet combination at this table.[^1] Lay odds are **always working**, even on the come-out for Don't Come bets.

The two sides are mirror images only for the flat bets. Pass + odds and Don't Pass + lay odds are **not** mirrors of each other: lay odds put more of your money in action for the same flat bet, so the edge per dollar looks much better than the cost per hour. In real money the gap is small: about **$0.15 an hour** on a $10 flat bet ($4.19 for Pass + odds vs $4.04 for Don't Pass + 6× lay).

Why does almost everyone bet "right" anyway?

- **The swings feel different.** Don't players win small and often, and lose big when a point is made. A hot shooter can wipe out a Don't player while the rest of the table cheers.
- **It's social.** Betting Don't means betting against the shooter and the table. It's perfectly legal and polite, just quieter. ("Darksiders" usually celebrate silently.)
- **The math is nearly a tie.** 1.36% vs 1.41%, or 0.27% vs 0.37% with full odds, and about 15¢ an hour apart. The choice is mostly about feel, not money.

:::math Don't Pass numbers
Win on the come-out (2 or 3) = 3/36. Win after a point (7 first) = Σ P(pt) × 6/(ways + 6) = 2 × [3/36 × 2/3 + 4/36 × 3/5 + 5/36 × 6/11] = 251/495 − 4/36 (that's the Pass Line's "point then seven-out" losses).
Total **win = 3/36 + 251/495 − 4/36 = 251/495 − 1/36 = 949/1980 ≈ 47.93%**.
Lose = 244/495 = 976/1980 ≈ 49.29%. Push (12) = 1/36 = 55/1980 ≈ 2.78%.
EV = (949 − 976)/1980 = −27/1980 = −3/220 ≈ **−1.364%** per bet made. Counting only bets that win or lose (ignoring pushes): 27/1925 ≈ 1.403%.

Lay odds of 6× on every point: expected lay = 6 × 24/36 = 4 units per flat unit. Combined = (3/220)/(1 + 4) = **0.273%**.
With lay odds that win N× the flat: expected lay = N × Σ P(pt) × true odds = N × 1. Combined = (3/220)/(1 + N): N = 1: 0.682%; 2: 0.455%; 10: 0.124%; 100: 0.0135%.
:::

```scene
id: l11-s1
version: 1
title: Going dark
rules: standard-vegas
bankroll: 50000
allowedBets: [dont-pass, dont-pass-odds]
highlightedBets: [dont-pass]
showEV: true
steps:
  - id: dp
    text: "Bet **$10** on **Don't Pass**. Tap it to see its card: 1.36%."
    expect:
      - { type: place-bet, betType: dont-pass, amount: 1000 }
    completeWhen: { betOnTable: { type: dont-pass, minAmount: 1000 } }
  - id: point
    text: "Roll: 4 is the point. Your Don't Pass now wins 2 times in 3."
    forcedDice: [[2, 2]]
    allowedActions: [roll]
    completeWhen: { point: 4 }
  - id: lay-odds
    text: "Lay **$60** odds (6×) behind it. It wins $30 if a 7 comes first. The card says a **Free bet**: 0.00%."
    expect:
      - { type: place-bet, betType: dont-pass-odds, oddsMax: true }
    completeWhen:
      action: { type: place-bet, betType: dont-pass-odds, oddsMax: true }
  - id: seven
    text: "Roll: 7! Seven-out. You win $10 + $30. The table groans; you smile quietly."
    forcedDice: [[3, 4]]
    allowedActions: [roll]
    completeWhen: { event: seven-out }
```

```scene
id: l11-s2
version: 1
title: The bar 12
rules: standard-vegas
bankroll: 50000
bets:
  - { type: dont-pass, amount: 1000 }
allowedBets: []
steps:
  - id: roll-12
    text: "Roll. 12 on the come-out: Pass loses, but your Don't Pass **pushes**. It stays on the table."
    forcedDice: [[6, 6]]
    allowedActions: [roll]
    completeWhen: { event: bet-pushed, betType: dont-pass }
```

```quiz
- q: On the come-out, which roll is a push for Don't Pass?
  options: ["2", "3", "12", "11"]
  answer: 2
  explain: "12 is barred: Pass loses, Don't Pass ties."
- q: The point is 10. Which is more likely to win right now?
  options: ["Pass", "Don't Pass", "Equal", "Depends on the shooter"]
  answer: 1
  explain: "7 (6 ways) beats 10 (3 ways), so Don't Pass wins 2 times in 3 from here."
- q: Why shouldn't you take down a Don't Pass bet after the point is set?
  options: ["It's not allowed", "It's now the favourite, so you'd give up your edge", "The dealer charges a fee", "You lose the bar 12"]
  answer: 1
  explain: "Removing it is allowed, but it throws away a bet that's now favourable to you."
- q: Point 6. You lay $30 odds behind a Don't Pass. A 7 rolls. The odds win...
  options: ["$36", "$30", "$25", "$15"]
  answer: 2
  explain: "Laying against 6 pays 5:6, so $30 wins $25."
```
