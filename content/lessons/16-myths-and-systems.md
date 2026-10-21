---
id: myths-and-systems
title: Myths, systems and dice control
chapter: math-that-matters
summary: No betting system changes the house edge. Spot the gambler's fallacy and weigh dice control honestly.
minutes: 5
---

Craps attracts more systems and superstitions than any other casino game. Here's the honest list.

**"Double up after a loss" (Martingale) and other progressions.** Every bet in a progression has the same negative EV, so their sum is negative too. A progression trades **many small wins for a rare huge loss**, which shows up when you hit the table maximum or your bankroll runs out. The average is unchanged.

**"The 7 is due" / "the 6 is hot."** Dice have no memory. After five 8s in a row, the next roll is still 5/36 for an 8 and 6/36 for a 7. Past rolls never change future chances.

**"Hedging protects you."** Adding Any Craps "to protect" your Pass bet on the come-out adds an 11.1% bet on top of a 1.41% one. You've paid twice. A hedge reduces swings at a price; it never improves EV.

**"Iron Cross can't lose."** It wins on every total except 7. But 7 is the most common total, and when it lands you lose everything at once. It costs about $27 an hour (see lesson 20).

**"Don't bettors cool the table."** The Don't player's bets have no effect on the dice. It's purely social.

**Dice control ("setting" the dice).** Some players set the dice in a pattern and try a soft, controlled throw. Rules require the dice to hit the textured back wall, which randomises them, and there is no independent, controlled study showing anyone can beat the dice reliably. Treat it as a ritual, not a strategy. The simulator's dice are fair random numbers.

**The bottom line:** in craps, **every combination of bets has an EV equal to the sum of the EVs of its parts.** You can't build a positive bet out of negative ones. "Perfect strategy" is about **paying as little as possible** for the game you want to play.

:::math Why systems can't work
EV is additive: EV(bet A + bet B + …) = EV(A) + EV(B) + …, whether the bets are made together or one after another, and however their sizes depend on past results. With every term ≤ 0, the total is ≤ 0.
Martingale example (Pass Line, base $10, table max $1,000): seven straight losses (P ≈ 0.507⁷ ≈ 0.86%) wipe out the $1,270 you've bet in that run, against a typical $10 gain. Overall EV stays at −1.41% of everything wagered.
:::

```scene
id: l16-s1
version: 1
title: Martingale vs flat
rules: standard-vegas
bankroll: 100000
allowedBets: [pass-line]
autoRoll:
  enabled: true
  strategies: [martingale-pass, pass-max-odds]
  defaultStrategy: { id: martingale-pass, unit: 1000 }
  compare:
    - { id: martingale-pass, unit: 1000 }
    - { id: pass-max-odds, unit: 1000, oddsMultiple: 0 }
  rollOptions: [100]
  sessions: [20]
  compareMode: true
steps:
  - id: martingale
    text: "Open auto-roll and run **Martingale pass** ($10, double after each loss) for **20 sessions** of 100 rolls. Most sessions end up a little; a few crash hard."
    completeWhen: { autoRollCompleted: {} }
  - id: flat
    text: "Now look at **flat $10 Pass** (no odds), run on the same dice. The Martingale wins small more often, but its average is just as negative."
    advance: button
    completeWhen: { acknowledged: true }
```

```scene
id: l16-s2
version: 1
title: Hunt for a pattern
rules: standard-vegas
bankroll: 50000
allowedBets: []
autoRoll:
  enabled: true
  lab: streaks
steps:
  - id: hunt
    text: "Open **Auto-roll**, pick a streak (try **3 sevens in a row**) and roll 100,000 dice. Did the next roll move away from its exact chance?"
    completeWhen: { autoRollCompleted: {} }
  - id: nomemory
    text: "The results hug the exact chances: **dice have no memory**. Try another streak or press New dice. You will not find a pattern."
    advance: button
    completeWhen: { acknowledged: true }
```

```quiz
- q: The last six rolls were all 6s. The chance the next roll is a 6 is...
  options: ["Lower: it's used up", "Higher: it's hot", "Still 5/36", "Zero"]
  answer: 2
  explain: "Each roll is independent."
- q: A betting progression can...
  options: ["Turn a negative edge positive", "Change how your results are spread out, but not the average", "Guarantee a win", "Lower the house edge"]
  answer: 1
  explain: "Progressions shape the swings; EV stays the sum of the bets' EVs."
- q: Adding a $1 Any Craps bet to a $10 Pass bet on the come-out does what to your expected loss?
  options: ["Lowers it", "Raises it by about 11¢", "Nothing", "Makes it positive"]
  answer: 1
  explain: "Any Craps costs 11.1% of $1; your Pass bet's 14¢ cost is unchanged."
```
