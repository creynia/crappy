---
id: strategy-lowest-edge
title: "Perfect strategy I: the lowest possible edge"
chapter: perfect-strategy
summary: The pure-math lens. Which play costs the least per dollar bet, and what "perfect" can and can't promise.
minutes: 9
---

"Perfect strategy" comes in three flavours, and this chapter keeps them apart on purpose:

1. **Pure lowest edge** (this lesson): the least possible cost per dollar bet, with no concern for nerves or budget.
2. **Practical** (next lesson): near-minimum edge, built for a real evening.
3. **Fun per dollar** (lesson 20): the most excitement for each dollar you expect to lose.

They give different answers, and that's fine. Start with the math.

Here's the uncomfortable truth: **there is no way to win at craps in the long run**. Every bet except odds has a house edge, and odds can only be added to bets that have one. "Perfect strategy" therefore means **paying the smallest possible edge for every dollar you put in action**.

By that pure measure, the ranking at a 3-4-5x table is:

| Rank | Play | Edge per dollar bet |
|---|---|---|
| 1 | **Don't Pass / Don't Come + 6× lay odds** | **0.27%** |
| 2 | Pass / Come + 3-4-5× odds | 0.37% |
| 3 | Don't Pass / Don't Come, no odds | 1.36% |
| 4 | Pass / Come, no odds | 1.41% |
| 5 | Place 6 or 8 (in $6 units) | 1.52% |
| 6 | Buy 4/10, Lay 4/10 (vig on win, bought for $20+ and laid for $40+) | 1.67% |

Buy and lay bets only reach 1.67% at the right sizes. Casinos round the 5% commission down to whole dollars with a $1 minimum, so a $10 buy on the 4 pays $1 (10%) and costs 3.33%. Buy for **$20 or more**; lay the 4 or 10 for **$40 or more**.

So the **mathematically perfect recipe** is:

1. Bet the **table minimum on Don't Pass**.
2. When a point is set, **lay the maximum odds** (6× here).
3. For more action, add **Don't Come** bets and lay full odds on each.
4. **Never** take down a Don't bet once its point is set.
5. **Bet nothing else.**

The right side is a very close second. Pass + max odds is 0.37%, and some players prefer it for reasons covered in Perfect strategy II. **At higher-odds tables the gap all but vanishes**: with 10× odds it's 0.12% vs 0.18%, and at 100× it's 0.01% vs 0.02%.

**Are the two sides mirror images?** Only the flat bets are, and only almost: Don't Pass wins when Pass loses, except for the bar-12 push on the come-out. The odds are not mirror images. Taking odds on a 3-4-5x table puts about 2.78 extra units behind each flat unit on average; laying 6× puts about 4.00 behind it. Take odds win more than you risk but less often; lay odds win less than you risk but more often. Both are fair bets, so the only thing that differs is how much 0% money you get to dilute the flat edge with.

Two caveats keep this honest:

* **Edge per dollar isn't dollars per hour.** Your expected cost still comes from the flat bets: about $4 an hour at $10 ($4.19 for Pass, $4.04 for Don't Pass). The odds just let you bet much more at that same cost.
* **Lay odds risk big to win small.** You'll put up $60 behind a $10 bet to win $30–50. Make sure your bankroll (lesson 15) can carry it.

:::math Comparing the two sides at different odds
Combined edge = flat edge ÷ (1 + expected odds amount per flat unit).
Right side, 3-4-5x: (7/495)/(1 + 25/9) = 7/1870 = 0.374%. Don't side, 6× lay: (3/220)/(1 + 4) = 3/1100 = 0.273%.
Lay 6× means 6 units laid on every point (wins 3, 4 or 5 units). The Don't side gets more 0% money in action per flat unit (4.00 vs 2.78), as well as a slightly lower flat edge.
At N× (taking N×; laying to win N×): right (7/495)/(1 + 2N/3); don't (3/220)/(1 + N).
:::

Try the optimum yourself, with the dice loaded for the first few rolls.

```scene
id: l18-s1
version: 1
title: The optimum, hands-on
rules: standard-vegas
bankroll: 100000
phase: come-out
allowedBets: [dont-pass, dont-pass-odds, dont-come, dont-come-odds]
showEV: true
evDetail: full
steps:
  - id: dont-pass
    text: "Bet the table minimum on **Don't Pass**."
    highlightedBets: [dont-pass]
    completeWhen: { action: { type: place-bet, betType: dont-pass, minAmount: 500 } }
  - id: point
    text: "Roll. We've loaded the dice for a point of 6."
    forcedDice: [[4, 2]]
    allowedActions: [roll]
    completeWhen: { point: 6 }
  - id: lay
    text: "Lay the **maximum odds** behind your Don't Pass. Tap it to see the free bet."
    highlightedBets: [dont-pass-odds]
    allowedBets: [dont-pass-odds]
    completeWhen: { action: { type: place-bet, betType: dont-pass-odds, oddsMax: true } }
  - id: dont-come
    text: "Add a **Don't Come** bet for more action."
    highlightedBets: [dont-come]
    allowedBets: [dont-come]
    completeWhen: { action: { type: place-bet, betType: dont-come, minAmount: 500 } }
  - id: travel
    text: "Roll. The dice are loaded: your Don't Come moves to the 5."
    forcedDice: [[3, 2]]
    allowedActions: [roll]
    completeWhen: { event: bet-travelled }
  - id: lay-come
    text: "Lay the maximum odds on the Don't Come too."
    highlightedBets: [dont-come-odds]
    allowedBets: [dont-come-odds]
    completeWhen: { action: { type: place-bet, betType: dont-come-odds, oddsMax: true } }
  - id: play
    text: "Roll 10 more times. Never take a Don't bet down. Then check the session panel: your edge per dollar heads toward **0.27%**."
    allowedBets: all
    completeWhen: { rolls: 10 }
```

Now put the two best plays head to head on **identical dice**.

```scene
id: l18-s2
version: 1
title: Optimum vs near-optimum, 10,000 rolls
rules: standard-vegas
bankroll: 100000
phase: come-out
showEV: true
autoRoll:
  enabled: true
  compareMode: true
  strategies: [pass-max-odds, dont-pass-max-lay]
  defaultStrategy: { id: dont-pass-max-lay, unit: 1000 }
  rollOptions: [1000, 10000]
  sessions: [1]
steps:
  - id: compare
    text: "Run both strategies on the **same dice** for 10,000 rolls. They aren't mirror images, so compare their paths and their expected-loss lines."
    completeWhen: { autoRollCompleted: { minRolls: 10000 } }
```

```quiz
- q: Which play has the lowest house edge per dollar at a 3-4-5x table?
  options: ["Pass + max odds", "Don't Pass + max lay odds", "Place 6 and 8", "Buy 4 and 10"]
  answer: 1
  explain: "0.27% vs 0.37% for Pass + odds."
- q: Can any strategy give a player a long-run edge at standard craps?
  options: ["Yes, with dice control", "Yes, with a progression", "No", "Only on the Don't side"]
  answer: 2
  explain: "Every combination is a sum of negative or zero EVs."
- q: You're on the Don't Pass with full lay odds. The point is 4. What should you do?
  options: ["Take your Don't Pass down", "Leave it: it's now the favourite", "Add a Hard 4 hedge", "Remove the odds"]
  answer: 1
  explain: "Never remove a Don't bet after the point; it now wins 2 times in 3. Removing odds costs nothing but gains nothing."
- q: Which statement is true?
  options: ["Pass + odds and Don't Pass + lay odds are exact mirror images", "Only the flat bets are (almost) mirror images", "Lay odds have a house edge", "Take odds have a house edge"]
  answer: 1
  explain: "The flat bets mirror each other apart from the bar-12 push. The odds bets are different sizes and pay differently, and both are fair."
```
