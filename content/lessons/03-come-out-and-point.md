---
id: come-out-and-point
title: Come-out, point, seven-out
chapter: foundations
summary: The two phases of every round, and the flip that makes 7 a friend and then an enemy.
minutes: 8
---

A round of craps has two phases.

**1. The come-out roll** (puck **OFF**). The shooter rolls, and one of three things happens:

* **7 or 11**, a **natural**. Pass Line bets win at once. The next roll is a new come-out.
* **2, 3 or 12**, **craps**. Pass Line bets lose at once. Next roll is a new come-out. (The shooter keeps the dice.)
* **4, 5, 6, 8, 9 or 10**: that number becomes **the point**. The dealer flips the puck to **ON** and sets it on that number.

**2. The point phase** (puck **ON**). The shooter keeps rolling until one of two things happens:

* **The point is rolled again**: the shooter **made the point**. Pass Line wins, the puck goes OFF, and a new come-out begins with the same shooter.
* **A 7 is rolled**: **seven-out**. Pass Line loses, the dice pass to the next shooter, and a new come-out begins.

During the point phase **every other total (including 2, 3, 11 and 12) doesn't matter for the Pass Line**. They just mean "roll again". Other bets may win or lose on them.

So a 7 is your friend on the come-out and your enemy once a point is set. That flip is the heart of craps.

On the come-out, a natural (8 ways) is twice as likely as craps (4 ways). That edge for the shooter is what makes the Pass Line feel friendly. Once a point is set, though, 7 is more likely than any point number, so the Pass Line is now the underdog. The two effects almost cancel. Lesson 5 shows exactly how close it comes.

:::math Come-out roll probabilities
Natural (7 or 11): 6 + 2 = 8 ways → 8/36 ≈ 22.2%.
Craps (2, 3, 12): 1 + 2 + 1 = 4 ways → 4/36 ≈ 11.1%.
Point (4, 5, 6, 8, 9, 10): 3 + 4 + 5 + 5 + 4 + 3 = 24 ways → 24/36 ≈ 66.7%.

Making a point, once set: only the point and 7 matter, so P(make point) = ways(point) / (ways(point) + 6).
4 or 10: 3/9 = 1/3 · 5 or 9: 4/10 = 2/5 · 6 or 8: 5/11.
:::

We've loaded the dice for these scenes so you see each case.

```scene
id: l03-s1
version: 1
title: Natural on the come-out
bankroll: 0
phase: come-out
forcedDice: [[5, 6]]
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
steps:
  - id: roll
    text: "The puck is OFF, so this is a come-out roll. Tap **Roll**."
    completeWhen: { event: natural }
  - id: see-natural
    text: "11! That's a natural. The puck stays OFF and the next roll is another come-out."
    completeWhen: { acknowledged: true }
    advance: button
```

```scene
id: l03-s2
version: 1
title: A full round
bankroll: 0
phase: come-out
forcedDice: [[2, 4], [3, 5], [1, 1], [5, 6], [4, 2]]
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
steps:
  - id: set-point
    text: "Tap **Roll**. A 6 on the come-out becomes the point. Watch the puck flip ON and move to 6."
    completeWhen: { point: 6 }
  - id: eight
    text: "Roll again: 8. Not the point and not 7, so nothing happens to the round."
    completeWhen: { rolls: 1 }
  - id: two
    text: "Roll: 2. On the come-out that would be craps. Now it's just another roll."
    completeWhen: { rolls: 1 }
  - id: eleven
    text: "Roll: 11. Again nothing for the round."
    completeWhen: { rolls: 1 }
  - id: made
    text: "Roll: 6! The shooter made the point. The puck goes OFF and we're back to a come-out."
    completeWhen: { event: point-made }
```

```scene
id: l03-s3
version: 1
title: Seven-out
bankroll: 0
phase: point
point: 9
forcedDice: [[3, 4]]
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
steps:
  - id: roll
    text: "The point is 9. Tap **Roll**."
    completeWhen: { event: seven-out }
  - id: see-seven-out
    text: "7: seven-out. The round ends, the puck goes OFF and the dice go to the next shooter."
    completeWhen: { acknowledged: true }
    advance: button
```

```quiz
- q: On the come-out roll, the shooter rolls 11. What happens?
  options: ["11 becomes the point", "It's a natural and Pass Line wins", "It's craps and Pass Line loses", "Nothing"]
  answer: 1
  explain: "7 and 11 are naturals on the come-out."
- q: The point is 5. The shooter rolls 12. What happens to the round?
  options: ["Pass Line loses", "Pass Line wins", "Nothing, roll again", "The point changes to 12"]
  answer: 2
  explain: "In the point phase only the point (5) or a 7 ends the round."
- q: What is a seven-out?
  options: ["Rolling 7 on the come-out", "Rolling 7 after a point is set", "Rolling seven times in a row", "A 7 on the Field"]
  answer: 1
  explain: "A 7 in the point phase ends the round with a loss for the Pass Line, and the dice move on."
- q: Which point is hardest to make?
  options: ["4", "6", "8", "9"]
  answer: 0
  explain: "4 (and 10) has only 3 ways against the 7's 6 ways, so it's made only 1 time in 3."
```
