---
id: final-exam
title: "Final exam"
chapter: perfect-strategy
summary: Twelve questions from the whole course, plus one practice session.
minutes: 12
---

Twelve questions drawn from the whole course. Score 80% or more (10 of 12) to earn the **Perfect Strategy** badge. Nothing is locked behind it: every lesson stays open, and you can retake the exam whenever you like.

Before you start, play one practice session. Use your cheat sheet from lesson 20.

```scene
id: l21-s1
version: 1
title: The perfect session
rules: standard-vegas
bankroll: 100000
phase: come-out
showEV: true
steps:
  - id: session
    text: "Play 30 rolls with any bets you like. Aim for an edge per dollar under 0.5% in the session panel, with no Sucker bets."
    completeWhen: { rolls: 30 }
```

```quiz
- q: The point is 5. You have $10 Pass + $40 odds. A 5 rolls. Total win?
  options: ["$50", "$70", "$60", "$40"]
  answer: 1
  explain: "The $10 flat bet pays $10 and the $40 odds pay 3:2, which is $60: $70 in all."
- q: Which is the cheapest way to bet the 4?
  options: ["Place 4", "Buy 4 for $20 (vig on win)", "Hard 4", "Field"]
  answer: 1
  explain: "1.67% vs 6.67% (place), 11.11% (hard 4) and 5.56% (Field)."
- q: "Don't Pass on the come-out: which roll pushes?"
  options: ["2", "3", "11", "12"]
  answer: 3
  explain: "Bar 12."
- q: Edge per roll of a Field bet vs a Pass bet?
  options: ["About equal", "Field ~13× higher", "Pass higher", "Field ~2× higher"]
  answer: 1
  explain: "5.56% vs 0.42% per roll."
- q: Which statement about odds is false?
  options: ["They pay true odds", "They lower your edge per dollar", "They lower your expected dollar loss per round", "They increase swings"]
  answer: 2
  explain: "Expected dollar loss comes from the flat bet; odds add 0."
- q: Hard 8 pays 9:1. Its house edge is...
  options: ["1.52%", "5.56%", "9.09%", "16.67%"]
  answer: 2
  explain: "(9 × 1 − 10)/11 = −1/11."
- q: The mathematically lowest-edge standard play at a 3-4-5x table is...
  options: ["Pass + max odds", "Don't Pass + max lay odds", "Place 6/8", "Iron Cross"]
  answer: 1
  explain: "0.27% vs 0.37%."
- q: A $6 Place 6 wins. You're paid...
  options: ["$6", "$7", "$7.20", "$5"]
  answer: 1
  explain: "7:6."
- q: After a run of 7s, the chance of a 7 next roll is...
  options: ["Lower", "Higher", "1/6", "1/36"]
  answer: 2
  explain: "Dice have no memory."
- q: Roughly what does $10 Pass + max odds cost per 100 rolls?
  options: ["$0.37", "$4", "$14", "$37"]
  answer: 1
  explain: "≈ 29.6 decisions × $10 × 1.414% ≈ $4.19."
- q: Lay $40 against the 10 wins. Your net win is (vig 5% of win)...
  options: ["$20", "$19", "$40", "$38"]
  answer: 1
  explain: "Lay 2 to win 1: $20, less a $1 vig."
- q: Which is the best description of "perfect strategy" in craps?
  options: ["A system that beats the house", "Paying the smallest edge for the action you want, with a bankroll that fits the swings", "Only betting when the table is hot", "Never betting the Don't"]
  answer: 1
  explain: "No strategy wins long-term; you minimise the cost and manage the variance."
```
