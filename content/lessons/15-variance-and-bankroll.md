---
id: variance-and-bankroll
title: Variance, swings and bankroll
chapter: math-that-matters
summary: Why short sessions are mostly luck, what odds do to your swings, and how much to bring.
minutes: 7
---

The house edge is the **average**. Real sessions bounce around it, often wildly. That spread is called **variance**, and its usual measure is the **standard deviation (SD)**: about two sessions in three land within one SD of the average.

For one hour (about 100 rolls) at a $10 table, simulated:

| Strategy | Expected result | SD (typical swing) | Hours you finish ahead |
|---|---|---|---|
| $10 Pass, no odds | −$4 | ±$55 | about 43% |
| $10 Pass + 2× odds | −$4 | ±$155 | about 49% |
| $10 Pass + 3-4-5× odds | −$4 | ±$265 | about 48% |
| $10 Don't Pass + 6× odds | −$4 | ±$265 | about 49% |

Look at that: the expected cost barely moves, but the swing **grows five times** with full odds. Odds don't make you lose more on average. They make **each hour more of a coin flip**, with bigger wins and bigger losses.

**When does the edge win?** With flat Pass bets the average loss only matches one typical swing after about **5,000 bets, roughly 170 hours** of play. In one evening you're far more likely to see luck than math. The casino sees millions of bets, so for them the math is certain.

**Bankroll.** Bring enough that a normal bad run doesn't knock you out. Simulating one hour at a $10 table:

| Strategy | Chance of going broke in an hour, with bankroll of… |
|---|---|
| $10 Pass, no odds | $50: ~38% · **$100: ~7%** · $150: <1% |
| $10 Pass + 3-4-5× odds | $300: ~29% · **$500: ~7%** · $800: <1% |

Rules of thumb for one hour: about **10–15 flat bets** for flat play, and about **50–80 flat bets** if you take full odds. If that's more than you're comfortable with, **lower the odds multiple, not the line bet's quality**. 2× odds is still a very good 0.61%.

Set a **loss limit** and a **time limit** before you start. They don't change the math, but they decide how a bad night ends.

:::math Where these numbers come from
SD per Pass decision (flat $1): ≈ 1.00. With 3-4-5x odds: ≈ 4.92 flat units. Don't Pass with 6× lay: ≈ 4.91.
About 29.6 decisions per 100 rolls → hourly SD ≈ √29.6 × SD. Flat $10: ≈ $54; full odds: ≈ $268.
Edge equals one SD after N decisions when N × 0.01414 = √N → N = 1/0.01414² ≈ 5,000 decisions ≈ 16,900 rolls.
The broke-in-an-hour figures come from 20,000 simulated 100-roll sessions, betting only when the bankroll can cover the bet plus full odds. The simulator's multi-session auto-roll reproduces them.
:::

```scene
id: l15-s1
version: 1
title: Same cost, bigger swings
rules: standard-vegas
bankroll: 100000
allowedBets: [pass-line, pass-odds]
showEV: true
autoRoll:
  enabled: true
  strategies: [pass-max-odds]
  defaultStrategy: { id: pass-max-odds, unit: 1000, oddsMultiple: 0 }
  rollOptions: [100]
  sessions: [20]
steps:
  - id: flat
    text: "Strategy A: $10 Pass, **no odds** (odds 0×). Run **20 sessions** of 100 rolls. Each dot on the chart is one hour."
    completeWhen: { autoRollCompleted: { minRolls: 100 } }
  - id: odds
    text: "Strategy B: $10 Pass + **max odds**. Run 20 sessions again."
    completeWhen: { autoRollCompleted: { minRolls: 100 } }
  - id: compare
    text: "Same average, much wider spread. Which spread are you comfortable with?"
    advance: button
    completeWhen: { acknowledged: true }
```

```scene
id: l15-s2
version: 1
title: Bankroll test
rules: standard-vegas
bankroll: 10000
allowedBets: [pass-line, pass-odds]
autoRoll:
  enabled: true
  strategies: [pass-max-odds]
  defaultStrategy: { id: pass-max-odds, unit: 1000, oddsMultiple: 0 }
  rollOptions: [100]
  sessions: [50]
steps:
  - id: flat-100
    text: "Start with $100 and play $10 Pass, no odds, for an hour, 50 times over. How many runs go broke? (About 7%.)"
    completeWhen: { autoRollCompleted: {} }
  - id: odds-100
    text: "Now add **max odds** with the same $100. Watch the survival chart: most runs can't afford the bets."
    completeWhen: { autoRollCompleted: {} }
  - id: odds-500
    text: "Give yourself $500 and run max odds again. About 7% go broke."
    setup: { bankroll: 50000 }
    completeWhen: { autoRollCompleted: {} }
```

```quiz
- q: Taking full odds instead of no odds mostly changes...
  options: ["Your expected loss per hour", "Your swings", "The chance of a 7", "Nothing"]
  answer: 1
  explain: "Expected cost stays about $4/hour at $10; the hourly swing goes from about ±$55 to about ±$265."
- q: You played 2 hours and you're up $300. What does that tell you about your strategy?
  options: ["It beats the house", "Almost nothing; 2 hours is mostly luck", "You should bet more", "The dice are hot"]
  answer: 1
  explain: "A swing like that is normal with odds. Edges only show up over thousands of bets."
- q: A sensible one-hour bankroll for $10 Pass + 3-4-5× odds is around...
  options: ["$50", "$100", "$500", "$5,000"]
  answer: 2
  explain: "About a 7% chance of going broke in an hour with $500; under 1% with $800."
```
