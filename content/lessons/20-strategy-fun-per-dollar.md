---
id: strategy-fun-per-dollar
title: "Perfect strategy III: the most fun per dollar"
chapter: perfect-strategy
summary: The fun lens. Compare popular action strategies by expected cost per hour and swing per dollar, then keep a one-page cheat sheet.
minutes: 10
---

Some people come for the math, most come for the thrill. If fun is the goal, the question is: **how much excitement do I get for each dollar I expect to lose?**

Here are some popular ways to play a $10-ish table, priced honestly (about 100 rolls an hour):

| Strategy | What it is | Expected cost/hour | Hourly swing | Fun per $ (swing ÷ cost) |
|---|---|---|---|---|
| **Pass + max odds** | $10 Pass, 3-4-5× odds | $4.19 | ±$265 | **63** |
| **3-point Molly** | $10 Pass + up to two $10 Come bets, all with max odds | ~$10.10 | ±$470 | **46** |
| **Place 6 & 8** | $6 each, after the point | $3.91 | ±$50 | 13 |
| Flat Pass | $10 Pass, no odds | $4.19 | ±$55 | 13 |
| $1 Hard 6 & Hard 8 | kept up after the point | $3.91 | ±$20 | 5 |
| **Iron Cross** | $5 Field + $5 Place 5 + $6 Place 6 + $6 Place 8, after the point | $27.37 | ±$80 | 3 |
| Field every roll | $5 | $27.78 | ±$55 | 2 |
| Horn every roll | $4 | $50.00 | — | — |

What this shows:

* **Odds are the cheapest thrill in the casino.** Pass + odds and the 3-point Molly give the biggest swings per dollar of cost, because odds add excitement at 0% edge.
* **The 3-point Molly** is the classic "lots of numbers working" plan that stays mathematically clean. It costs about 2.4× the single Pass bet, because there are more flat bets in action, and it carries about 0.40% per dollar bet, odds included, close to Pass + odds. It's slightly higher because come odds are off, and returned, on come-out 7s.
* **Iron Cross** wins on every roll except 7 (83% of rolls!). That feels great, but it costs about **6.5×** as much per hour as Pass + odds. The steady trickle of small wins is the price you're paying.
* **Small hardway bets** are cheap in dollars per hour ($1 units), but they're 9% bets. Enjoy them as a garnish, not a meal.
* **Props every roll** are the most expensive fun on the table.

A good **fun-per-dollar recipe**: Pass (or Don't) at the minimum, full odds, one or two Come bets with odds (or Place 6 & 8), plus, if you like, a $1 hardway now and then. Lots of action, lots of numbers, all for a few dollars an hour.

:::math How the table was computed
Expected cost/hour: bet × per-roll edge × rolls working (100 rolls; point-phase-only bets work on 392/557 ≈ 70.4 of them).
Iron Cross per point-phase roll: Field $5 × 5.556% + Place 5 $5 × 1.111% + Place 6/8 $12 × 0.463% = $0.3889; × 70.4 = **$27.37**. It wins on 30 of 36 dice combinations and loses $22 on the 6 ways to roll 7.
Field every roll: $5 × 5.556% × 100 = $27.78. Horn: $4 × 12.5% × 100 = $50.00. Hard 6 + Hard 8: $2 × 2.778% × 70.4 = $3.91.
3-point Molly: each flat bet costs 7/495 of its size; the Molly averages ≈ 0.715 flat bets resolving per roll, so 0.715 × $10 × 1.414% × 100 ≈ $10.11/hour.
Swings are from 40,000 simulated hours. "Fun per $" = hourly SD ÷ expected hourly cost: a rough measure of excitement per dollar paid. It isn't an official statistic, just an honest yardstick.
:::

Put the three most talked-about plans on **identical dice** and watch the cost climb. The Iron Cross uses its standard $22 layout, and the other two start from $10 and take max odds. Compare the expected-loss lines, not just the wins.

```scene
id: l20-s1
version: 1
title: Iron Cross vs Pass + odds vs Molly
rules: standard-vegas
bankroll: 200000
phase: come-out
showEV: true
autoRoll:
  enabled: true
  compareMode: true
  compare:
    - { id: iron-cross, unit: 500 }
    - { id: pass-max-odds, unit: 1000 }
    - { id: three-point-molly, unit: 1000 }
  rollOptions: [100]
  sessions: [20]
steps:
  - id: compare
    text: "Run 20 hours of each on the **same dice**. Iron Cross wins more rolls; check which one has the better average."
    completeWhen: { autoRollCompleted: { minRolls: 100 } }
```

Now run a 3-point Molly by hand, with the dice loaded so the numbers arrive on time.

```scene
id: l20-s2
version: 1
title: Run a 3-point Molly
rules: standard-vegas
bankroll: 100000
phase: come-out
allowedBets: [pass-line, pass-odds, come, come-odds]
showEV: true
steps:
  - id: pass
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Bet $10 on the **Pass Line**."
    highlightedBets: [pass-line]
    completeWhen: { action: { type: place-bet, betType: pass-line, amount: 1000 } }
  - id: point
    text: "Roll. The point is 8."
    forcedDice: [[5, 3]]
    allowedActions: [roll]
    completeWhen: { point: 8 }
  - id: odds
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Take the **maximum odds**."
    highlightedBets: [pass-odds]
    completeWhen: { action: { type: place-bet, betType: pass-odds, oddsMax: true } }
  - id: come-1
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Add a $10 **Come** bet."
    highlightedBets: [come]
    completeWhen: { action: { type: place-bet, betType: come, amount: 1000 } }
  - id: travel-1
    text: "Roll. The Come bet travels to the 5."
    forcedDice: [[3, 2]]
    allowedActions: [roll]
    completeWhen: { event: bet-travelled }
  - id: come-odds-1
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Put the maximum odds behind it."
    highlightedBets: [come-odds]
    completeWhen: { action: { type: place-bet, betType: come-odds, oddsMax: true } }
  - id: come-2
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Add a second $10 **Come** bet. Three numbers, then stop."
    highlightedBets: [come]
    completeWhen: { action: { type: place-bet, betType: come, amount: 1000 } }
  - id: travel-2
    text: "Roll. This one travels to the 9."
    forcedDice: [[5, 4]]
    allowedActions: [roll]
    completeWhen: { event: bet-travelled }
  - id: come-odds-2
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Maximum odds again. That's the Molly."
    highlightedBets: [come-odds]
    completeWhen: { action: { type: place-bet, betType: come-odds, oddsMax: true } }
  - id: play
    text: "Play 30 rolls. When a bet wins or loses, add another Come bet to stay at three numbers."
    allowedActions: [roll, place-bet]
    completeWhen: { rolls: 30 }
```

## Your perfect-strategy cheat sheet

| Lens | The play | Edge per $ bet | Cost/hour at $10 | Use it when |
|---|---|---|---|---|
| **Pure lowest edge** | Don't Pass / Don't Come + 6× lay odds. Never take a Don't bet down. | 0.27% | $4.04 | You want the mathematical minimum and can carry the bankroll |
| **Pure, right side** | Pass / Come + 3-4-5× odds | 0.37% | $4.19 | The same plan, riding with the table |
| **Practical** | Minimum Pass + the odds you can afford (max, 2× or 1×); right-sized flat bets | 0.37% / 0.61% / 0.85% | $4.19 | Most evenings: fix the bankroll first, add loss and time limits |
| **Practical extra numbers** | One or two Come bets with odds, or Place 6 and 8 in $6 units | 0.40% / 1.52% | up to ~$10 / $3.91 | You want more numbers working |
| **Cheap 4 and 10** | Buy for $20+ (never Place). Lay 4/10 for $40+. | 1.67% | n/a | A single number you must have |
| **Fun per dollar** | Pass + max odds, or 3-point Molly with max odds | 0.37% / 0.40% | $4.19 / ~$10 | You want swings and numbers for a few dollars an hour |
| **Skip** | Field, Big 6/8, hardways (garnish at $1), props, Horn, World, Iron Cross | 5.56% to 16.67% | $27+ for the big ones | Almost never |

Three rules sit under the whole table: **odds are free**, **flat bets set your hourly cost**, and **no plan wins in the long run**.

```quiz
- q: Which strategy costs the most per hour at roughly similar bet sizes?
  options: ["Pass + max odds", "3-point Molly", "Iron Cross", "Place 6 & 8"]
  answer: 2
  explain: "Iron Cross ≈ $27 an hour, mostly from the Field bet on every point-phase roll."
- q: Iron Cross wins on 30 of 36 combinations. Why is it still a poor deal?
  options: ["It doesn't win often", "The 7 takes the whole $22 at once, and the Field's 5.56% runs every roll", "Dealers dislike it", "It loses on 2 and 12"]
  answer: 1
  explain: "Winning often isn't the same as winning on average."
- q: What's the cheapest way to add excitement?
  options: ["Bigger prop bets", "More odds", "Field bets", "Big 6/8"]
  answer: 1
  explain: "Odds add swing at 0% edge."
```
