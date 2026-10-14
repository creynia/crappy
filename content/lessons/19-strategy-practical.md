---
id: strategy-practical
title: "Perfect strategy II: low edge, real life"
chapter: perfect-strategy
summary: The practical lens. A near-minimum-edge plan that fits your bankroll, your temperament and the table.
minutes: 9
---

Pure math says Don't + max odds. Real life adds budget, nerves and a table full of people. Here's the **practical perfect strategy**: still near the minimum edge, and built for an actual evening.

**The core plan (right side)**

1. **Pass Line at the table minimum.**
2. **Take odds**: the maximum if your bankroll allows, otherwise 2× (0.61%) or 1× (0.85%). Prefer smaller flat bets with more odds over bigger flat bets with less odds.
3. Want more numbers working? Add **one or two Come bets** with odds. Or, as the **acceptable alternative**, **place the 6 and 8** in $6 units (1.52%, and quick, with no waiting for a bet to travel).
4. Want the 4 or 10? **Buy** them for **$20 or more** (1.67% with vig on win). Never place them (6.67%).
5. **Skip** the Field, Big 6/8, hardways and every center bet.

**Do or Don't?**

| | Right (Pass/Come) | Dark (Don't Pass/Don't Come) |
|---|---|---|
| Edge with full odds | 0.37% | 0.27% |
| Feel | Win with the table; big cheers on hot rolls | Win against the table; quiet celebrations |
| How results come | Many small losses, occasional big wins | Many small wins, occasional big losses |
| Money needed for full odds | Smaller (odds ≤ 5× the flat bet) | Larger (lay 6× the flat bet) |

The difference is **0.1% of action**. In dollars it's about **$0.15 an hour** at $10 ($4.19 for Pass vs $4.04 for Don't Pass). Choose the side you'll enjoy and stick to it calmly.

**Session planning, at a $10 table (about 100 rolls an hour)**

| Plan | Edge per $ bet | Expected cost/hour | Typical hourly swing | Bankroll for ~1 hour |
|---|---|---|---|---|
| $10 Pass, no odds | 1.41% | $4.19 | ±$55 | $100–150 |
| $10 Pass + 2× odds | 0.61% | $4.19 | ±$155 | $300–400 |
| $10 Pass + 3-4-5× | 0.37% | $4.19 | ±$265 | $500–800 |
| $10 Don't + 6× lay | 0.27% | $4.04 | ±$265 | $500–800 |
| $6 Place 6 + $6 Place 8 | 1.52% | $3.91 | ±$50 | $100–150 |

Plan rules that work:

* **Decide your bankroll before you sit down**, and make your odds level fit it.
* Set a **loss limit** (for example, the whole session bankroll) and a **time limit**.
* A **win goal** ("I'll stop if I'm up $200") doesn't change EV, but it makes good nights end as good nights.
* **Comps**: casinos rate your play by bet size and time, usually at an average edge, and often without counting odds. A small flat bet with big odds gets you cheap action and decent ratings.

:::math Behind the planning table
Expected cost/hour = $10 × 1.414% × 29.6 decisions ≈ $4.19 for every Pass plan (odds add 0); Don't = $10 × 1.364% × 29.6 ≈ $4.04, so the hourly gap is $4.19 − $4.04 = $0.15; Place 6 + 8 = $12 × 0.463% × 70.4 rolls ≈ $3.91.
Swings and bankrolls come from 40,000 simulated 100-roll hours (see lesson 15). "Bankroll for ~1 hour" ≈ the 7%-to-under-1% risk of ruin range.
:::

Start with a side-by-side: three practical plans on the same dice.

```scene
id: l19-s1
version: 1
title: Three plans, same dice
rules: standard-vegas
bankroll: 50000
phase: come-out
showEV: true
autoRoll:
  enabled: true
  compareMode: true
  strategies: [pass-2x-odds, pass-max-odds, place-6-8]
  defaultStrategy: { id: pass-2x-odds, unit: 1000 }
  rollOptions: [100]
  sessions: [1, 100]
steps:
  - id: compare
    text: "Run 100 rolls of each plan on the **same dice**. Compare the expected loss with the swings."
    completeWhen: { autoRollCompleted: { minRolls: 100 } }
```

Then build the plan by hand: Pass, max odds, Place 6 and 8, and a buy for the 4.

```scene
id: l19-s2
version: 1
title: Build the practical layout
rules: standard-vegas
bankroll: 50000
phase: come-out
allowedBets: [pass-line, pass-odds, place-6, place-8, buy-4, place-4]
showEV: true
steps:
  - id: pass
    text: "Bet $10 on the **Pass Line**."
    highlightedBets: [pass-line]
    completeWhen: { action: { type: place-bet, betType: pass-line, amount: 1000 } }
  - id: point
    text: "Roll. The dice are loaded: the point is 5."
    forcedDice: [[3, 2]]
    allowedActions: [roll]
    completeWhen: { point: 5 }
  - id: odds
    text: "Take the **maximum odds**."
    highlightedBets: [pass-odds]
    completeWhen: { action: { type: place-bet, betType: pass-odds, oddsMax: true } }
  - id: place-6
    text: "Place the 6 in a **$6** unit."
    highlightedBets: [place-6]
    completeWhen: { action: { type: place-bet, betType: place-6, amount: 600 } }
  - id: place-8
    text: "Place the 8 in a **$6** unit."
    highlightedBets: [place-8]
    completeWhen: { action: { type: place-bet, betType: place-8, amount: 600 } }
  - id: compare-4
    text: "Tap **Place 4** and read its edge. Don't place it."
    highlightedBets: [place-4]
    completeWhen: { previewed: place-4 }
  - id: buy-4
    text: "Buy the 4 for **$20** instead."
    highlightedBets: [buy-4]
    completeWhen: { action: { type: place-bet, betType: buy-4, minAmount: 2000 } }
```

```quiz
- q: You can afford $10 Pass with 2× odds, or $20 Pass with no odds. Which has the lower expected cost?
  options: ["$20 Pass, no odds", "$10 Pass + 2× odds", "Equal", "Can't tell"]
  answer: 1
  explain: "Expected cost comes from the flat bet: $10 costs half of $20, and odds are free."
- q: You want action on the 6 and 8 right away. The best practical choice is...
  options: ["Big 6 and Big 8", "Place 6 and 8 in $6 units", "Hard 6 and Hard 8", "Buy 6 and 8"]
  answer: 1
  explain: "Place 6/8 at 1.52% beats Buy 6/8 (2.27%), Big 6/8 (9.09%) and hardways (9.09%)."
- q: The main cost of choosing Pass over Don't Pass (both with full odds) is...
  options: ["Huge, avoid Pass", "About 0.1% of action, around 15¢ an hour at $10", "Nothing, they're equal", "Pass is cheaper"]
  answer: 1
  explain: "0.37% vs 0.27% per dollar bet; in dollars, $4.19 vs $4.04 an hour. A small price for many players' preference."
```
