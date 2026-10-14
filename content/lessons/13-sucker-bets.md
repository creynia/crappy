---
id: sucker-bets
title: Hardways, props and the middle of the table
chapter: more-ways-to-bet
summary: The loud bets in the center of the table, what they pay, and why they cost so much.
minutes: 7
---

The center of the table is bright, loud and paid at long odds. It's also where craps makes most of its money.

**Hardways** (multi-roll): bet that a number rolls **as a pair** before it rolls easy or a 7.

| Bet | Pays | Wins | House edge |
|---|---|---|---|
| Hard 6 / Hard 8 | 9:1 | 1 way vs 10 losing ways | **9.09%** |
| Hard 4 / Hard 10 | 7:1 | 1 way vs 8 losing ways | **11.11%** |

Hardways are off on the come-out by default and can be taken down. They use the smaller "prop" minimum.

**One-roll ("proposition") bets** win or lose on the very next roll:

| Bet | Wins on | Pays | House edge |
|---|---|---|---|
| Any 7 | 7 | 4:1 | **16.67%** (the worst bet on the table) |
| Any Craps | 2, 3, 12 | 7:1 | 11.11% |
| Aces (2) / Boxcars (12) | that total | 30:1 | 13.89% |
| Ace-Deuce (3) / Yo (11) | that total | 15:1 | 11.11% |
| Horn | 2, 3, 11 or 12 (4 units, one on each) | the winning unit at its own odds, the other three lose | 12.50% |
| C&E | Any Craps or 11 (2 units) | craps 3:1, 11 7:1 on the whole bet | 11.11% |
| World ("Whirl") | Horn + Any 7 (5 units) | 7 is a push; 2/3/11/12 as Horn | 13.33% |

You will also hear about **hop bets**: a bet that the very next roll is one exact pair, such as 2-4. An easy hop (two different dice, either way round) pays 15:1 and costs 11.11%; a hard hop (a pair such as 3-3) pays 30:1 and costs 13.89%. Hop bets are not in this simulator, but the math is the same as the other props.

Every one of these is a **Sucker bet** in the simulator's colour code (red, 9% or more). You can still place them in the sandbox, but it asks you to tap a second time first.

**Watch the word "for".** Some layouts print "30 **for** 1" instead of "30 **to** 1". "For" includes your original bet, so 30 for 1 is really 29 to 1, an even worse deal. This app's tables pay "to".

**Bonus side bets** you'll see in casinos (not in this simulator):

- **Fire Bet**: pays if the shooter makes 4, 5 or 6 *different* points. With the common 24:1 / 249:1 / 999:1 paytable the edge is about **20.8%**.
- **All / Tall / Small**: pays if every number from 2 to 6 (Small), from 8 to 12 (Tall), or both (All) rolls before a 7. With 34:1 / 34:1 / 175:1 the edge is about **7.5–7.8%**, and much higher with 30:1 / 150:1.

They're fun lottery tickets, but think of them as a fee for the thrill, not as a strategy.

:::math Prop-bet edges
For a one-roll bet that wins on w of 36 ways and pays k:1: EV = (w × k − (36 − w))/36.
Any 7: (6 × 4 − 30)/36 = −6/36 = −16.67%. Any Craps: (4 × 7 − 32)/36 = −4/36 = −11.11%.
Aces: (30 − 35)/36 = −13.89%. Yo: (2 × 15 − 34)/36 = −11.11%.
Horn ($4): 2 or 12 → +27 (1/36 each), 3 or 11 → +12 (2/36 each), else −4 (30/36). EV = (54 + 48 − 120)/36 = −0.5 per $4 = **−12.5%**.
C&E ($2): craps → +6 (4/36), 11 → +14 (2/36), else −2 (30/36). EV = (24 + 28 − 60)/36 = −8/36 per $2 = **−11.11%**.
World ($5): 2/12 → +26, 3/11 → +11, 7 → 0, else (24 ways) −5. EV = (52 + 44 − 120)/36 = −24/36 per $5 = **−13.33%**.
Hard 8: wins on 4-4 (1 way), loses on 7 (6) or easy 8 (4). EV = (9 − 10)/11 = **−9.09%**. Hard 4: (7 − 8)/9 = **−11.11%**.
Fire Bet: P(4 points) ≈ 0.880%, P(5) ≈ 0.164%, P(6) ≈ 0.0162% → EV ≈ −20.76%.
:::

```scene
id: l13-s1
version: 1
title: The red zone
rules: standard-vegas
bankroll: 50000
phase: point
point: 8
allowedBets: all
highlightedBets: [any-7, horn, hard-8, world]
showEV: true
steps:
  - id: preview
    text: "Tap **Any 7**, **Horn**, **World** and **Hard 8** in turn to open each card. Each one shows a red **Sucker bet** tier and suggests a cheaper bet."
    completeWhen:
      all:
        - { previewed: any-7 }
        - { previewed: horn }
        - { previewed: world }
        - { previewed: hard-8 }
  - id: place
    text: "Place $1 on Any 7 and $1 on Hard 8 anyway (the second tap says \"Place anyway\")."
    completeWhen:
      all:
        - { betOnTable: { type: any-7, minAmount: 100 } }
        - { betOnTable: { type: hard-8, minAmount: 100 } }
  - id: roll
    text: "Roll a few times and watch the session panel."
    completeWhen: { rolls: 5 }
```

```scene
id: l13-s2
version: 1
title: 1,000 Any 7 bets
rules: standard-vegas
bankroll: 100000
allowedBets: [any-7]
showEV: true
autoRoll:
  enabled: true
  strategies: [any-7-every-roll]
  defaultStrategy: { id: any-7-every-roll, unit: 100 }
  rollOptions: [1000]
  sessions: [1]
steps:
  - id: auto
    text: "Open auto-roll: **Any 7 every roll**, $1, **1,000 rolls**."
    completeWhen: { autoRollCompleted: { minRolls: 1000 } }
  - id: compare
    text: "Expected loss: 1,000 × $1 × 16.67% ≈ $167. How close did you get?"
    advance: button
    completeWhen: { acknowledged: true }
```

```quiz
- q: Which bet has the highest house edge?
  options: ["Hard 4", "Any Craps", "Any 7", "Field"]
  answer: 2
  explain: "Any 7 at 16.67%. It pays 4:1 on a 5-to-1 shot."
- q: Hard 6 pays 9:1. How many ways does it lose?
  options: ["6", "9", "10", "35"]
  answer: 2
  explain: "Six ways to roll 7 plus four easy-6 combinations = 10, against 1 winning way."
- q: A layout says "Yo 15 for 1". How much profit does $1 make on a win?
  options: ["$16", "$15", "$14", "$1"]
  answer: 2
  explain: "'For' includes your stake: you get $15 back, of which $14 is profit."
- q: A $4 Horn bet hits a 12. What's your net result (paying "to")?
  options: ["+$30", "+$27", "+$12", "−$4"]
  answer: 1
  explain: "The $1 on 12 wins $30 and the other three $1 units lose: +$27."
```
