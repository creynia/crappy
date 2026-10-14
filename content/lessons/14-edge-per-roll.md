---
id: edge-per-roll
title: Edge per bet vs edge per roll, and the cost of an hour
chapter: math-that-matters
summary: Why a one-roll bet that "only" costs 5.56% is far more expensive per hour than a Pass Line bet.
minutes: 6
---

So far, every house edge has been **per bet resolved**: what you lose on average each time a bet finally wins or loses. But bets take different amounts of time. A Field bet is over in one roll. A Pass bet lasts about **3.4 rolls** on average. A Place 4 waits until a 4 or a 7 shows, about 4 rolls.

If you leave a bet up all session, what you actually pay depends on how many decisions it has. That's the **per-roll edge**: the average loss per roll, per dollar on the table.

| Bet | Edge per bet | Edge per roll |
|---|---|---|
| Pass / Come | 1.41% | **0.42%** |
| Don't Pass / Don't Come | 1.36% | **0.40%** |
| Odds (either side) | 0% | 0% |
| Place 6/8 | 1.52% | 0.46% |
| Buy 4/10 or Lay 4/10 | 1.67% | 0.42% |
| Place 5/9 | 4.00% | 1.11% |
| Place 4/10 | 6.67% | 1.67% |
| Hardways (any) | 9.09–11.11% | 2.78% |
| Big 6/8 | 9.09% | 2.78% |
| Field | 5.56% | **5.56%** |
| Any 7 | 16.67% | **16.67%** |

Two surprises. **Place 6/8 is nearly as cheap per roll as the Pass Line.** And **every one-roll bet keeps its full edge per roll**, so a Field bet costs more than **13 times** as much per roll as a Pass bet of the same size.

**The cost of an hour.** A busy table runs about 100 rolls an hour, and a quiet one more (a crowded one fewer). You can change the pace in Settings, and every per-hour figure in the simulator scales with it. Expected cost ≈ **bet × per-roll edge × rolls the bet is working**:

| Your play (about 100 rolls/hour) | Expected cost per hour |
|---|---|
| $10 Pass Line, every round | **$4.19** |
| $10 Pass Line + max odds | **$4.19**, the same: odds cost nothing |
| $10 Don't Pass + 6× lay odds | $4.04 |
| $6 Place 6 + $6 Place 8 (off on come-outs) | $3.91 |
| $5 Field, every roll | **$27.78** |
| $1 Any 7, every roll | $16.67 |
| $4 Horn, every roll | $50.00 |

Don't Pass with full lay odds is only **$0.15 an hour** cheaper than Pass with full odds ($4.19 vs $4.04). A $5 Field bettor pays almost **7×** what a $10 Pass Line bettor pays, while betting half as much.

:::math Per-roll edge and hourly cost
Average rolls per Pass decision: 1 + Σ P(point) × 1/P(point or 7 per roll) = 557/165 ≈ 3.376. Per-roll edge = 1.414% ÷ 3.376 = **0.419%**.
Place 6: it resolves on any 6 or 7, 11/36 of rolls. Per-roll edge = (1/66) × (11/36) = **0.463%**. Place 4: (1/15) × (9/36) = 1.667%. Hard 8: (1/11) × (11/36) = 1/36 = 2.778%; Hard 4: (1/9) × (9/36) = 1/36 too.
Share of rolls that are in the point phase: 1 − 165/557 = 392/557 ≈ 70.4%. Bets that are off on come-outs only work on those rolls.
$10 Pass, 100 rolls: 100/3.376 ≈ 29.6 decisions × $10 × 1.414% = **$4.19**. Place 6 + 8: $12 × 0.463% × 70.4 = **$3.91**. Field: $5 × 5.556% × 100 = **$27.78**.
Don't Pass: $10 × 0.404% × 100 = **$4.04**; the gap to Pass is $4.19 − $4.04 = $0.15.
:::

```scene
id: l14-s1
version: 1
title: Pass vs Field, one hour
rules: standard-vegas
bankroll: 100000
allowedBets: [pass-line, field]
showEV: true
autoRoll:
  enabled: true
  strategies: [pass-max-odds, field-every-roll]
  defaultStrategy: { id: pass-max-odds, unit: 500, oddsMultiple: 0 }
  rollOptions: [100]
  sessions: [1, 5]
  compareMode: true
steps:
  - id: preview
    text: "Tap the **Pass Line**, then the **Field**. Compare the \"per hour\" lines on their cards."
    completeWhen:
      all:
        - { previewed: pass-line }
        - { previewed: field }
  - id: compare
    text: "Open auto-roll in **compare** mode: **Pass Line (no odds)** against **Field every roll**, $5 each, **100 rolls** (about an hour). Both play the same dice."
    completeWhen: { autoRollCompleted: { minRolls: 100 } }
  - id: repeat
    text: "Run it again with 5 sessions. The Field's expected-cost line is far steeper."
    advance: button
    completeWhen: { acknowledged: true }
```

```quiz
- q: Per roll in action, which bet has the lower edge?
  options: ["Pass Line (0.42%)", "Place 6 (0.46%)", "Field (5.56%)", "Hard 6 (2.78%)"]
  answer: 0
  explain: "Pass is the cheapest per roll, with Place 6 very close behind. One-roll bets and hardways are far more expensive."
- q: Roughly what does $10 Pass + max odds cost per 100 rolls?
  options: ["$0", "$4", "$14", "$40"]
  answer: 1
  explain: "About $4.19, exactly what $10 Pass alone costs. Odds add swings, not cost."
- q: Why does the Field cost so much per hour?
  options: ["It has the highest edge on the table", "It's decided on every roll, so its 5.56% edge is paid every roll", "Dealers charge a fee", "It loses on 7"]
  answer: 1
  explain: "One-roll bets pay their full edge each roll; multi-roll bets spread it over several."
```
