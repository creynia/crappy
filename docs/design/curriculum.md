# crappy: curriculum and craps reference

Status: design spike (content). Owner: curriculum spike.
This document is the **source of truth for all learner-facing text and all craps math** in the app.
The lesson prose here is final copy and is meant to ship as written.

Contents

1. [Conventions for the app](#1-conventions-for-the-app)
2. [House rules the app uses](#2-house-rules-the-app-uses)
3. [Course map](#3-course-map)
4. [Lessons](#4-lessons)
5. [Bet reference table](#5-bet-reference-table)
6. [How EV is shown in the simulator](#6-how-ev-is-shown-in-the-simulator)
7. [Verification notes and sources](#7-verification-notes-and-sources)

---

## 1. Conventions for the app

### 1.1 Content markup

Lesson bodies are Markdown, plus three custom fenced blocks:

| Block | Syntax | Rendering |
|---|---|---|
| Show the math | `:::math Title` … `:::` | A collapsible box, closed by default, with the summary "Show the math: Title". It holds derivations. The lesson must read fine with every box closed. |
| Tip | `:::tip` … `:::` | A small callout for etiquette or practical advice. |
| Simulator scene | ` ```scene ` YAML block | Not shown as text. It embeds an interactive simulator at that point in the lesson (see 1.2). |

Quizzes sit at the end of each lesson in a ` ```quiz ` YAML block.

### 1.2 Scene schema (shared with the simulator spike)

```yaml
id: string              # unique, e.g. l04-s1
title: string
table:                  # preset table state
  rules: vegas-default  # see section 2; or vegas-3x-field, odds-10x, odds-100x
  puck: off | 4|5|6|8|9|10
  bankroll: 500
  bets:                 # bets already on the felt
    - { bet: pass-line, amount: 10 }
    - { bet: come, number: 6, amount: 10 }   # a come bet that has moved to 6
    - { bet: come-odds, number: 6, amount: 25 }
dice: random | forced:[a,b] | script:[[a,b],[a,b],...]  # forced = next roll only; script = a sequence
allowedBets: [ids] | all          # everything else is greyed out
highlight: [ids]                  # bets that pulse
showEv: true                      # show the EV panel (section 6)
autoRoll: off | {rolls: 100, speed: fast}
steps:                            # guided coach marks, run in order
  - "Tap **Pass Line**."          # each step waits for that action or a tap on Next
```

In free-play ("sandbox") mode every bet is allowed. Warnings follow the tiers in section 6.

### 1.3 Ids

* Bet ids are in section 5. A bet that exists per number (come bets that have moved, odds, place, buy, lay, hardways) uses the base id plus a `number` field, or the number-suffixed id where one exists (`place-6`, `hard-8`).
* Lesson ids are kebab-case, listed in section 3.

---

## 2. House rules the app uses

Rule set **`vegas-default`** (typical Las Vegas Strip/downtown table):

| Rule | Value |
|---|---|
| Odds | **3-4-5x**: take up to 3× the flat bet on 4/10, 4× on 5/9 and 5× on 6/8 (each pays the same 6× at most). Don't-side may **lay up to 6×** the flat bet on any point. |
| Don't Pass / Don't Come | **Bar 12**: a 12 on the come-out pushes. |
| Field | 3, 4, 9, 10, 11 pay 1:1; **2 pays 2:1; 12 pays 2:1**. |
| Buy bets | True odds less a **5% commission on the amount bet, charged only when the bet wins**. |
| Lay bets | True odds less a **5% commission on the amount won, charged only when the bet wins**. |
| Place payouts | 4/10 pay 9:5, 5/9 pay 7:5, 6/8 pay 7:6. |
| Hardways | Hard 4/10 pay 7:1, Hard 6/8 pay 9:1. |
| Big 6/8 | Even money. |
| One-roll props | Any 7 4:1; Any Craps 7:1; 2 (Aces) and 12 (Boxcars) 30:1; 3 (Ace-Deuce) and 11 (Yo) 15:1; hop bets 30:1 hard and 15:1 easy. |
| Working on come-out | Place, buy, hardways and come-bet odds are **OFF** on the come-out unless the player turns them on. Lay bets, Big 6/8, don't-come lay odds and one-roll bets are always **ON**. |
| Commission rounding | The simulator charges exactly 5% (no rounding, no $1 minimum). A lesson note explains that real casinos round. |

Variant presets the simulator should offer (Settings → Table rules):

* `vegas-3x-field`: the Field pays **3:1 on 12** (edge drops from 5.56% to 2.78%).
* `odds-2x`, `odds-10x`, `odds-100x`: take odds of N× the flat bet on every point, and lay odds that win N× the flat bet.
* `buy-vig-upfront`: commission is paid when the bet is made (buy 4/10 edge rises to 4.76%).

Not modelled in v1 (they are only mentioned in lessons): Fire Bet, All/Tall/Small, put bets, crapless craps, and casinos that let you turn the 5% buy vig into a "free" commission.

---

## 3. Course map

The course has 21 units in 6 chapters: 19 teaching lessons, a checkpoint and a final exam. Every unit ends with a quiz. Chapter checkpoints (marked ✔) are cumulative quizzes that unlock the next chapter.

| # | Lesson id | Title | Chapter |
|---|---|---|---|
| 1 | `dice-and-combinations` | Two dice, 36 outcomes | 1. Foundations |
| 2 | `table-tour` | A tour of the table | 1. Foundations |
| 3 | `come-out-and-point` | Come-out, point, seven-out | 1. Foundations |
| 4 | `pass-line` | The Pass Line | 2. The core game |
| 5 | `expected-value` | EV and house edge, in plain English | 2. The core game |
| 6 | `odds-bet` | Odds: the best bet in the house | 2. The core game |
| 7 | `come-bets` | Come bets: more points, same deal | 2. The core game |
| 8 | `checkpoint-core` ✔ | Checkpoint: the core game | 2. The core game |
| 9 | `place-bets` | Place bets | 3. More ways to bet |
| 10 | `buy-and-lay` | Buy and Lay bets: paying commission | 3. More ways to bet |
| 11 | `dont-side` | The Don't side | 3. More ways to bet |
| 12 | `field-and-big-6-8` | Field and Big 6/8 | 3. More ways to bet |
| 13 | `sucker-bets` | Hardways, props and the middle of the table | 3. More ways to bet |
| 14 | `edge-per-roll` | Edge per bet vs edge per roll, and the cost of an hour | 4. The math that matters |
| 15 | `variance-and-bankroll` | Variance, swings and bankroll | 4. The math that matters |
| 16 | `myths-and-systems` | Myths, systems and dice control | 4. The math that matters |
| 17 | `etiquette` | Playing at a real table | 5. The real casino |
| 18 | `strategy-lowest-edge` | Perfect strategy I: the lowest possible edge | 6. Perfect strategy |
| 19 | `strategy-practical` | Perfect strategy II: low edge, real life | 6. Perfect strategy |
| 20 | `strategy-fun-per-dollar` | Perfect strategy III: the most fun per dollar | 6. Perfect strategy |
| 21 | `final-exam` ✔ | Final exam | 6. Perfect strategy |

`checkpoint-core` and `final-exam` are quiz-focused units, each with one short practical scene.

Teaching approach. Each new idea comes first in plain English, then in a guided simulator scene, then as optional math in a "Show the math" box. The EV panel appears from lesson 5 on, so learners see the cost of every bet before they place it. Auto-roll (fast mode, many rolls) is held back until the variance chapter, so it lands as a surprise there.

---

## 4. Lessons

---

### Lesson 1: `dice-and-combinations`: Two dice, 36 outcomes

**Objectives**

* Know that two dice make 36 equally likely combinations.
* Find how many ways each total from 2 to 12 can be rolled.
* See why 7 is the most common total and why craps revolves around it.

**Lesson**

Craps is played with two ordinary six-sided dice. Each die is fair, so every face has the same chance.

Paint one die red and one blue. The red die can land 6 ways and the blue die 6 ways, which makes **6 × 6 = 36 combinations**, each just as likely as the others. A red 1 with a blue 6 is a different combination from a red 6 with a blue 1, even though both total 7.

What matters in craps is the **total**. Totals are not equally likely, because some have more combinations:

| Total | 2 | 3 | 4 | 5 | 6 | **7** | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ways | 1 | 2 | 3 | 4 | 5 | **6** | 5 | 4 | 3 | 2 | 1 |
| Chance | 2.8% | 5.6% | 8.3% | 11.1% | 13.9% | **16.7%** | 13.9% | 11.1% | 8.3% | 5.6% | 2.8% |

Notice the shape: the ways climb by one up to 7, then fall again. **7 is the most likely total, at 6 ways out of 36, or 1 in 6.** Nearly every bet in craps is a bet on whether some number shows up before a 7 does, so it pays to remember the column of "ways".

A trick for remembering: totals the same distance from 7 have the same number of ways. 6 and 8 both have 5 ways, 5 and 9 have 4, 4 and 10 have 3, 3 and 11 have 2, and 2 and 12 have 1.

Some totals can be rolled as a **pair** (both dice the same): 2-2 is a "hard 4", 3-3 a "hard 6", 4-4 a "hard 8" and 5-5 a "hard 10". Any other way to make those totals is "easy". Hard 6 is one combination; easy 6 is four (1-5, 5-1, 2-4, 4-2).

:::math Counting the 36 combinations
Each die shows 1 to 6 independently, so the outcomes are the ordered pairs (red, blue): 6 × 6 = 36, each with probability 1/36.

Ways to make total *t*: for *t* from 2 to 7 it is *t* − 1; for *t* from 7 to 12 it is 13 − *t*. Check: 1+2+3+4+5+6+5+4+3+2+1 = 36.

P(7) = 6/36 = 1/6 ≈ 16.67%. P(6) = 5/36 ≈ 13.89%.
:::

**Simulator scenes**

```scene
id: l01-s1
title: Roll the dice
table: { rules: vegas-default, puck: off, bankroll: 0, bets: [] }
dice: random
allowedBets: []
showEv: false
autoRoll: off
steps:
  - "No betting yet. Tap **Roll** a few times and watch the total."
  - "Each roll adds to the tally chart under the table. Roll 10 times."
```

```scene
id: l01-s2
title: 7 vs 2, 600 times
table: { rules: vegas-default, puck: off, bankroll: 0, bets: [] }
dice: random
allowedBets: []
showEv: false
autoRoll: { rolls: 600, speed: fast }
steps:
  - "Tap **Auto-roll 600**. The tally chart fills in."
  - "Compare the 7 bar with the 2 and 12 bars. You should see about 100 sevens and about 17 of each of 2 and 12. Real results wobble, and that's normal."
```

The tally chart is a histogram of the 11 totals, with the expected counts drawn as faint outlines.

```quiz
- q: How many equally likely combinations do two dice have?
  options: ["11", "12", "36", "21"]
  answer: 2
  explain: "6 faces × 6 faces = 36. The 11 totals are not equally likely."
- q: Which total is most likely?
  options: ["6", "7", "8", "They're all equal"]
  answer: 1
  explain: "7 can be made 6 ways (1-6, 2-5, 3-4, 4-3, 5-2, 6-1), more than any other total."
- q: How many ways can you roll a 9?
  options: ["3", "4", "5", "6"]
  answer: 1
  explain: "3-6, 4-5, 5-4, 6-3. Shortcut: 9 is two away from 7, so it has 6 − 2 = 4 ways."
- q: Which of these is a "hard 8"?
  options: ["2-6", "3-5", "4-4", "6-2"]
  answer: 2
  explain: "Hard means a pair. 4-4 is the only hard 8; the other four ways are easy 8s."
```

---

### Lesson 2: `table-tour`: A tour of the table

**Objectives**

* Name the main parts of the layout: Pass/Don't Pass, Come/Don't Come, the place-number boxes, Field, Big 6/8 and the center props.
* Know who is who: shooter, dealers, stickman, boxperson.
* Know that the layout is mirrored on both ends.

**Lesson**

A craps table is a big tub with a felt layout. The layout is printed twice, once at each end, so players on both sides reach the same bets. The middle is shared.

Start from the outside rail and work inward.

* **Pass Line**: the long strip that runs around the edge. This is the main bet of the game, and most players start here.
* **Don't Pass Bar**: a thinner strip just inside it. It's the opposite of the Pass Line.
* **Come** and **Don't Come**: big areas that work like Pass and Don't Pass, but you can bet them at any moment.
* **Field**: a band of numbers (2, 3, 4, 9, 10, 11, 12) that wins or loses on the very next roll.
* **Big 6 / Big 8**: a corner box. (Spoiler: you'll learn to skip it.)
* **Number boxes** (4, 5, SIX, 8, NINE, 10): along the top. Dealers set Place, Buy and Lay bets here, and move Come bets here. They also mark the point.
* **Center ("proposition") bets**: the colourful middle section run by the stickman. It has Any 7, Any Craps, the hardways, 2, 3, 11, 12 and the Horn. These pay big and cost the most.

The people:

* **Shooter**: the player rolling the dice. The dice move around the table clockwise.
* **Dealers** (two, one for each end): they take, pay and move bets.
* **Stickman**: runs the game from the middle, pushes the dice to the shooter, calls each roll and handles the center bets.
* **Boxperson**: sits between the dealers and supervises.

The **puck** is a disc that is white **ON** on one side and black **OFF** on the other. It tells you which phase the game is in. That's the next lesson.

:::tip
You don't need to roll to play. Most players at a table are betting on someone else's dice.
:::

**Simulator scenes**

```scene
id: l02-s1
title: Find the bets
table: { rules: vegas-default, puck: off, bankroll: 0, bets: [] }
dice: random
allowedBets: []
showEv: false
steps:
  - "Tap the **Pass Line**."
  - "Tap the **Don't Pass Bar**."
  - "Tap the **Come** area."
  - "Tap the **Field**."
  - "Tap the **6** number box."
  - "Tap any bet in the **center**. Those are the proposition bets."
```

This is an identification game: each step waits for a tap on the right area and gives a short label and a one-line description. No chips are placed.

```quiz
- q: Which bet runs along the outer edge of the layout?
  options: ["Field", "Pass Line", "Come", "Any 7"]
  answer: 1
  explain: "The Pass Line wraps around the edge. It's the main bet of the game."
- q: Who runs the bets in the middle of the table?
  options: ["Boxperson", "Shooter", "Stickman", "Pit boss"]
  answer: 2
  explain: "The stickman handles the dice and the center proposition bets."
- q: What does the puck show?
  options: ["Table minimum", "Whether a point is set, and which one", "Whose turn it is to roll", "The last number rolled"]
  answer: 1
  explain: "OFF means it's a come-out roll. ON, sitting on a number, marks the point."
```

---

### Lesson 3: `come-out-and-point`: Come-out, point, seven-out

**Objectives**

* Explain the two phases of a round: the come-out roll and the point phase.
* Know which come-out totals are naturals (7, 11), craps (2, 3, 12) and points (4, 5, 6, 8, 9, 10).
* Know what "making the point" and "seven-out" mean.

**Lesson**

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

**Simulator scenes**

```scene
id: l03-s1
title: Natural on the come-out
table: { rules: vegas-default, puck: off, bankroll: 0, bets: [] }
dice: "forced:[5,6]"
allowedBets: []
steps:
  - "The puck is OFF, so this is a come-out roll. Tap **Roll**."
  - "11! That's a natural. The puck stays OFF and the next roll is another come-out."
```

```scene
id: l03-s2
title: A full round
table: { rules: vegas-default, puck: off, bankroll: 0, bets: [] }
dice: "script:[[2,4],[3,5],[1,1],[5,6],[4,2]]"
allowedBets: []
steps:
  - "Tap **Roll**. A 6 on the come-out becomes the point. Watch the puck flip ON and move to 6."
  - "Roll again: 8. Not the point and not 7, so nothing happens to the round."
  - "Roll: 2. On the come-out that would be craps. Now it's just another roll."
  - "Roll: 11. Again nothing for the round."
  - "Roll: 6! The shooter made the point. The puck goes OFF and we're back to a come-out."
```

```scene
id: l03-s3
title: Seven-out
table: { rules: vegas-default, puck: 9, bankroll: 0, bets: [] }
dice: "forced:[3,4]"
allowedBets: []
steps:
  - "The point is 9. Tap **Roll**."
  - "7: seven-out. The round ends, the puck goes OFF and the dice go to the next shooter."
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

---

### Lesson 4: `pass-line`: The Pass Line

**Objectives**

* Place a Pass Line bet and follow it through a full round.
* Know that it pays even money (1:1).
* Know that a Pass bet is a "contract": once a point is set you can't take it down.

**Lesson**

The **Pass Line** is the classic craps bet, often called betting "with the shooter" or "right". You put chips on the Pass Line **before a come-out roll**, and lesson 3 told you what happens next:

* Come-out 7 or 11: **win**.
* Come-out 2, 3 or 12: **lose**.
* Come-out 4, 5, 6, 8, 9 or 10: that's the point. Then you **win** if the point comes again before a 7, and **lose** if 7 comes first.

A win pays **even money**: bet $10, win $10, and you keep your original $10.

Once a point is set, your Pass bet is locked in. It's a **contract bet**: you can't pick it up until it wins or loses. (That's because you already enjoyed the come-out, where you were the favourite.)

How good is it? Out of every 495 Pass bets, on average you win **244** and lose **251**. That's **49.3%** wins, a hair under a coin flip. The small gap is how the casino makes its money, and lesson 5 puts a number on it.

:::math Probability of winning a Pass bet
Win on the come-out: P(7 or 11) = 8/36.
Win by making a point: sum over points of P(point is set) × P(point before 7):

* 4: 3/36 × 3/9 = 1/36
* 5: 4/36 × 4/10 = 2/45
* 6: 5/36 × 5/11 = 25/396
* 8, 9, 10 mirror 6, 5, 4.

Total win = 8/36 + 2 × (1/36 + 2/45 + 25/396) = **244/495 ≈ 49.29%**. Lose = 251/495 ≈ 50.71%.
:::

**Simulator scenes**

```scene
id: l04-s1
title: Your first bet
table: { rules: vegas-default, puck: off, bankroll: 200, bets: [] }
dice: "script:[[4,4],[2,3],[6,2]]"
allowedBets: [pass-line]
highlight: [pass-line]
showEv: false
steps:
  - "Pick the **$10** chip and tap the **Pass Line**."
  - "Tap **Roll**. 8 is the point. Notice your Pass bet now has a lock icon: it's a contract bet."
  - "Roll. A 5 does nothing to your bet."
  - "Roll. 8! You made the point. You win $10 and keep your $10 bet."
```

```scene
id: l04-s2
title: Play a few rounds
table: { rules: vegas-default, puck: off, bankroll: 200, bets: [] }
dice: random
allowedBets: [pass-line]
highlight: [pass-line]
steps:
  - "Bet the Pass Line and play until you've finished 5 rounds. The bet stays up after a win, so you only re-bet after a loss."
```

```quiz
- q: What does a $10 Pass Line bet win when the point is made?
  options: ["$5", "$10", "$20", "Depends on the point"]
  answer: 1
  explain: "The Pass Line always pays even money, whatever the point."
- q: Can you take your Pass bet down after the point is set?
  options: ["Yes, any time", "No, it's a contract bet", "Only if the point is 4 or 10", "Only after a 7"]
  answer: 1
  explain: "Once a point is set the Pass bet stays until it wins or loses."
- q: Roughly how often does a Pass bet win?
  options: ["About 33%", "About 49%", "About 55%", "Exactly 50%"]
  answer: 1
  explain: "244 out of 495, or 49.29%, a little below even."
```

---

### Lesson 5: `expected-value`: EV and house edge, in plain English

**Objectives**

* Define expected value (EV) as the average result of a bet per dollar, over the long run.
* Define house edge as the negative of EV, written as a percentage.
* Read the simulator's EV panel.

**Lesson**

A single bet is luck. A thousand bets are math.

**Expected value (EV)** is what a bet is worth *on average* if you could make it over and over. You find it by multiplying each result by its chance and adding up.

Try the Pass Line with $1. You win $1 244 times out of 495 and lose $1 251 times out of 495:

> EV = (244 × $1 − 251 × $1) / 495 = −$7/495 ≈ **−$0.0141**

So the average Pass bet loses about 1.4 cents per dollar. That number turned into a percentage is the **house edge: 1.41%**. Bet $10 on the Pass Line a hundred times and you should expect to be down about **$14**. That's not a promise. You might be up $80 or down $120. But the average sits at −$14, and the more you play, the more firmly your results crowd around it.

Three facts to keep in mind for the rest of the course:

1. **Nearly every bet has a negative EV.** The casino sets payouts a little below "fair". The one exception is in the next lesson.
2. **Payout odds don't tell you the edge.** A bet that pays 30:1 can be far worse than one that pays 1:1. You have to compare the payout with the true odds.
3. **The house edge is the price of playing.** You can't make it positive, but you can make it very small. That's what "perfect strategy" means in this course.

From now on the simulator shows an **EV panel** whenever you place a bet. It lists the house edge, your expected loss in dollars, and a colour tier from green (great) to red (avoid).

:::math EV of the Pass Line
EV = Σ (probability × net result) = (244/495)(+1) + (251/495)(−1) = −7/495 = −0.014141…

House edge = −EV per $1 wagered = **1.414%**.

Expected loss on a bet of size B = B × house edge. For B = $10: $0.141 per bet, so $14.14 per 100 bets.
:::

**Simulator scenes**

```scene
id: l05-s1
title: Meet the EV panel
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [] }
dice: random
allowedBets: [pass-line]
highlight: [pass-line]
showEv: true
steps:
  - "Drag a **$10** chip toward the Pass Line, but don't let go. The EV panel opens."
  - "Read it: house edge 1.41%, expected loss about 14¢ on this bet. Tier: green."
  - "Let go to place the bet, then **Roll** until the bet is resolved."
```

```quiz
- q: The Pass Line's house edge is 1.41%. If you make 1,000 $5 Pass bets, about how much do you expect to lose?
  options: ["$1.41", "$14.14", "$70.71", "$141.41"]
  answer: 2
  explain: "$5 × 1,000 = $5,000 wagered; 1.414% of $5,000 ≈ $70.71."
- q: Which statement about EV is true?
  options: ["It tells you what will happen on your next bet", "It's the long-run average result per bet", "A bigger payout always means a better EV", "A negative EV means you'll lose every time"]
  answer: 1
  explain: "EV is an average. Individual bets still win or lose."
- q: A bet wins $30 with probability 1/36 and loses $1 otherwise. What is its EV per $1?
  options: ["+$0.83", "−$0.03", "−$0.14", "$0"]
  answer: 2
  explain: "(1 × 30 − 35 × 1) / 36 = −5/36 ≈ −$0.139. A 13.9% house edge, even though it pays 30:1."
```

---

### Lesson 6: `odds-bet`: Odds: the best bet in the house

**Objectives**

* Add an Odds bet behind a Pass Line bet once a point is set.
* Know the true-odds payouts: 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8.
* Understand that Odds has **0% house edge**, and that it lowers the combined edge of your Pass + Odds.
* Know the 3-4-5x maximums.

**Lesson**

Once a point is set and you have a Pass bet, you may add a second bet **behind** it, called **taking the odds**. It wins if the point is made and loses on a 7, exactly like your Pass bet. The difference is how it's paid: at **true odds**, the exact ratio of losing to winning chances.

| Point | Ways to make it vs 7 | Odds pay | Max at 3-4-5x (on a $10 Pass bet) |
|---|---|---|---|
| 4 or 10 | 3 vs 6 | **2 : 1** | $30 (wins $60) |
| 5 or 9 | 4 vs 6 | **3 : 2** | $40 (wins $60) |
| 6 or 8 | 5 vs 6 | **6 : 5** | $50 (wins $60) |

Because the payout matches the true chance exactly, **the Odds bet has a house edge of zero**. It's the only bet in the casino with no edge, and it's why the casino doesn't print it on the layout. You just have to know it exists.

The maximums at a "3-4-5x" table are set so a winning odds bet always pays 6× your flat bet. Some casinos allow 10× or even 100×.

Why it matters: your Pass bet still costs 1.41% of the flat bet, but now more of your money is riding at 0%. Averaged over everything you bet, the edge drops:

| Odds taken | Edge per dollar bet (Pass + Odds) |
|---|---|
| None | 1.41% |
| 1× | 0.85% |
| 2× | 0.61% |
| **3-4-5×** | **0.37%** |
| 10× | 0.18% |
| 100× | 0.02% |

One honest caveat. Odds lowers the edge **per dollar bet**, but it doesn't cut the dollars you expect to lose, which are still 1.41% of your flat bet. What it changes is that you get far more action for the same expected cost, and bigger swings. In practice, "perfect" craps means a small flat bet with as much odds as you're comfortable with.

Odds bets **can be taken down or reduced at any time**, though there's never a math reason to. Bet sizes matter. Use multiples of $2 on 5/9 and $5 on 6/8, because real casinos don't pay out fractions of a dollar.

:::math Why Odds has zero edge, and the 0.374% figure
Odds on 4: win 1/3 of the time, paid 2:1. EV = (1/3)(2) − (2/3)(1) = 0. Similarly 5: (2/5)(3/2) − 3/5 = 0, and 6: (5/11)(6/5) − 6/11 = 0.

Combined edge = expected loss ÷ expected total wagered. Per $1 of Pass:
expected odds wagered = P(4 or 10) × 3 + P(5 or 9) × 4 + P(6 or 8) × 5 = (6/36)3 + (8/36)4 + (10/36)5 = 100/36 ≈ 2.778.
Combined edge = (7/495) / (1 + 100/36) = **0.374%**.

With flat N× odds: (7/495) / (1 + N × 24/36). N = 1: 0.848%; 2: 0.606%; 10: 0.184%; 100: 0.0209%.
:::

:::tip
To take odds, set the chips just behind your Pass bet, off the line, or hand them to the dealer and say "odds, please."
:::

**Simulator scenes**

```scene
id: l06-s1
title: Taking odds
table:
  rules: vegas-default
  puck: 5
  bankroll: 500
  bets: [ { bet: pass-line, amount: 10 } ]
dice: "script:[[6,2],[4,1]]"
allowedBets: [pass-odds]
highlight: [pass-odds]
showEv: true
steps:
  - "The point is 5 and you have $10 on the Pass Line. Tap the area behind it to add **Odds**."
  - "The max here is $40 (4×). Place $40. The EV panel shows 0.00% edge and a $0.00 expected loss. Tier: best."
  - "Roll twice. You made the 5: the Pass pays $10 and the Odds pays $60."
```

```scene
id: l06-s2
title: Same flat bet, more action
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds]
highlight: [pass-odds]
showEv: true
steps:
  - "Bet $10 on the Pass Line and take maximum odds on every point. Play 10 rounds."
  - "Watch the session panel: total wagered climbs much faster than expected loss. Your edge per dollar is about 0.37%."
```

```quiz
- q: The point is 4. You have $10 on Pass and $30 in Odds. The shooter rolls a 4. How much do you win in total?
  options: ["$40", "$55", "$70", "$90"]
  answer: 2
  explain: "Pass pays even money ($10); Odds on 4 pays 2:1 ($60). Total $70."
- q: What is the house edge on the Odds bet?
  options: ["1.41%", "0.37%", "0%", "It depends on the point"]
  answer: 2
  explain: "It pays exactly true odds, so its EV is zero for every point."
- q: The point is 6. Which odds amount gets paid in full at a real table, with no rounding down?
  options: ["$12", "$22", "$25", "$33"]
  answer: 2
  explain: "6:5 needs a multiple of $5. $25 pays exactly $30. On the others the casino rounds the payout down, so you'd be giving away part of that 0% edge."
- q: Taking odds lowers which of these?
  options: ["Your expected dollar loss per round", "The house edge per dollar you bet", "Your swings", "The chance the shooter sevens out"]
  answer: 1
  explain: "Expected dollar loss is unchanged (it comes from the flat bet). Edge per dollar falls and swings get bigger."
```

---

### Lesson 7: `come-bets`: Come bets: more points, same deal

**Objectives**

* Explain a Come bet as a Pass Line bet that starts on any roll after a point is set.
* Follow a Come bet as it "travels" to a number, and add odds to it.
* Know that Come odds are OFF on the come-out by default, while the flat Come bet stays working.

**Lesson**

The Pass Line only takes bets before a come-out. What if you want more action while a point is in play? That's the **Come** bet.

A Come bet works **exactly like a Pass bet, except it starts on the next roll**, whatever is happening at the table. That next roll is its own private "come-out":

* **7 or 11**: wins at once. (Careful: a 7 also seven-outs the Pass Line.)
* **2, 3 or 12**: loses at once.
* **Any point number**: the dealer **moves your bet to that number's box**. It now wins if that number rolls again before a 7.

Once it has moved, you can add **odds** to it (same true-odds payouts and same 3-4-5x limits as Pass odds), and it becomes a contract bet just like Pass.

Same edge as the Pass Line, **1.41%**, and odds bring it down the same way. Come bets are how "right" players get more than one number working while staying at the lowest edge.

**One quirk.** If a new come-out roll happens while your Come bet sits on a number, the flat Come bet is still live, but its **odds are "off"** by default. If that come-out is a 7, you lose the flat bet and get the odds back. If it's your number, the flat bet wins and the odds come back to you unpaid. You can ask for them to be "working" if you prefer. It costs nothing either way, because odds have no edge.

:::math Why a Come bet has the same edge as Pass
The bet's first roll plays the role of the come-out, with the same 8/36 win, 4/36 lose and 24/36 point. From there it's resolved by "number before 7", exactly as Pass is. The probabilities are identical: win 244/495, house edge 7/495 ≈ 1.414%.
:::

**Simulator scenes**

```scene
id: l07-s1
title: A Come bet travels
table:
  rules: vegas-default
  puck: 6
  bankroll: 500
  bets: [ { bet: pass-line, amount: 10 }, { bet: pass-odds, number: 6, amount: 50 } ]
dice: "script:[[5,4],[3,6],[2,3]]"
allowedBets: [come, come-odds]
highlight: [come]
showEv: true
steps:
  - "The point is 6. Put **$10** in the **Come** area."
  - "Roll: 9. Your Come bet moves to the 9 box."
  - "Add **$40 odds** on your Come bet (tap the 9 box, then Odds)."
  - "Roll: 9! Your Come bet wins $10 and its odds win $60. Your Pass bet on 6 is still riding."
  - "Roll: 5. Nothing happens to any of your bets."
```

```scene
id: l07-s2
title: Odds are off on the come-out
table:
  rules: vegas-default
  puck: off
  bankroll: 500
  bets: [ { bet: come, number: 8, amount: 10 }, { bet: come-odds, number: 8, amount: 50 } ]
dice: "forced:[3,4]"
allowedBets: []
steps:
  - "It's a come-out roll. Your Come bet on 8 has an **OFF** marker on its odds."
  - "Roll: 7. The $10 Come bet loses, but your $50 odds come back to you."
```

```quiz
- q: The point is 9. You put $10 in Come, and the next roll is 11. What happens?
  options: ["Your Come bet loses", "Your Come bet wins $10", "Your Come bet moves to 11", "Nothing"]
  answer: 1
  explain: "11 on a Come bet's first roll is a natural: it wins."
- q: The point is 9. You put $10 in Come, and the next roll is 7. What happens to your Pass and Come bets?
  options: ["Both win", "Both lose", "Pass loses, Come wins", "Pass wins, Come loses"]
  answer: 2
  explain: "7 is a seven-out for the Pass Line, but a natural on the Come bet's first roll."
- q: What's the house edge on a Come bet with no odds?
  options: ["0%", "1.36%", "1.41%", "5.56%"]
  answer: 2
  explain: "It's resolved exactly like a Pass bet."
- q: Your Come bet is on 5 with $20 odds. A 7 rolls on the next come-out. With default rules, what do you lose?
  options: ["$0", "Only the flat Come bet", "Only the odds", "Both"]
  answer: 1
  explain: "Come odds are off on the come-out by default, so they're returned."
```

---

### Lesson 8: `checkpoint-core` ✔: Checkpoint: the core game

**Objectives**

* Combine lessons 1 to 7: phases, Pass/Come, odds and the house edge.

**Lesson**

Time to check what you've learned. Pass this checkpoint (75% or better) to unlock *More ways to bet*. You can retake it as often as you like, and the questions are drawn at random from the pool below.

**Simulator scenes**

```scene
id: l08-s1
title: Play it right
table: { rules: vegas-default, puck: off, bankroll: 300, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds, come, come-odds]
showEv: true
steps:
  - "Play 5 rounds using only Pass, Come and Odds. You'll get a green check for each round where your combined edge stays under 0.5%."
```

```quiz
- q: The puck is OFF. Which bet can you make right now?
  options: ["Pass Line", "Pass Odds", "Come Odds", "None"]
  answer: 0
  explain: "With the puck OFF it's a come-out: the time to bet the Pass Line. Odds need a point."
- q: The point is 10, and you have $5 on Pass with $15 odds. 10 rolls. You win...
  options: ["$20", "$35", "$45", "$15"]
  answer: 1
  explain: "$5 even money + $15 at 2:1 ($30) = $35."
- q: Which has the lowest house edge per dollar bet?
  options: ["Pass alone", "Pass + 1× odds", "Pass + 3-4-5× odds", "Come alone"]
  answer: 2
  explain: "1.41% → 0.85% → 0.37%. More money at 0% lowers the blend."
- q: What's the chance of making a point of 8?
  options: ["5/36", "5/11", "1/2", "6/11"]
  answer: 1
  explain: "5 ways to roll 8 against 6 ways to roll 7: 5/(5+6)."
- q: On the come-out, a natural is how many times as likely as craps?
  options: ["Same", "1.5×", "2×", "3×"]
  answer: 2
  explain: "8 ways (7, 11) vs 4 ways (2, 3, 12)."
- q: Which bet can you remove at any time?
  options: ["Pass after a point", "Come after it moved to a number", "Odds", "None"]
  answer: 2
  explain: "Pass and Come flat bets are contracts once a point is set; odds can always come down."
```

---

### Lesson 9: `place-bets`: Place bets

**Objectives**

* Place the 4, 5, 6, 8, 9 or 10 directly, without waiting for a Come bet to travel.
* Know the payouts and edges: 6/8 at 7:6 (1.52%), 5/9 at 7:5 (4.00%), 4/10 at 9:5 (6.67%).
* Know the working rules: off on the come-out by default, and they can be taken down, pressed or turned off.

**Lesson**

A **Place bet** lets you pick a number and bet it will roll **before a 7**. No come-out, no travelling. You hand the dealer chips and say "place the 6". The bet stays up after each win until a 7 takes it, or until you take it down.

The catch is that place bets pay **slightly less than true odds**. That shortfall is the house edge:

| Place | True odds | Pays | Bet in multiples of | House edge |
|---|---|---|---|---|
| 6 or 8 | 6:5 | **7:6** | $6 | **1.52%** |
| 5 or 9 | 3:2 | **7:5** | $5 | 4.00% |
| 4 or 10 | 2:1 | **9:5** | $5 | 6.67% |

**Place 6 and 8 are good bets**, nearly as cheap as the Pass Line (1.52% vs 1.41%). The 5/9 is meh, and 4/10 is expensive. Lesson 10 shows a cheaper way to bet the 4 and 10.

Rules to know:

* Place bets are **off on the come-out roll** unless you say "working". A come-out 7 doesn't take them, and a come-out 6 doesn't pay them.
* You can **take them down**, **turn them off** for a while, or **press** them (add winnings to make the bet bigger) between rolls.
* Use the right multiples. $6 on the 6 wins $7, but $5 on the 6 only wins $5 at most casinos, because the payout is rounded down. That raises your edge.

:::math Place-bet edges
Place 6: wins with P = 5/11 and pays 7/6. EV = (5/11)(7/6) − (6/11)(1) = (35/66 − 36/66) = −1/66 ≈ **−1.515%**.
Place 5: P(win) = 4/10, pays 7/5. EV = (2/5)(7/5) − 3/5 = 14/25 − 15/25 = −1/25 = **−4.00%**.
Place 4: P(win) = 3/9, pays 9/5. EV = (1/3)(9/5) − 2/3 = 9/15 − 10/15 = −1/15 ≈ **−6.67%**.
:::

**Simulator scenes**

```scene
id: l09-s1
title: Place the 6 and 8
table: { rules: vegas-default, puck: 5, bankroll: 500, bets: [ { bet: pass-line, amount: 10 } ] }
dice: "script:[[3,3],[6,2],[4,3]]"
allowedBets: [place-6, place-8]
highlight: [place-6, place-8]
showEv: true
steps:
  - "Place **$6** on the 6 and **$6** on the 8. The EV panel shows a 1.52% edge, about 9¢ each. Tier: green."
  - "Roll: 6. You win $7. The bet stays up."
  - "Roll: 8. Another $7."
  - "Roll: 7. Seven-out. Your Pass bet and both place bets lose."
```

```scene
id: l09-s2
title: The 4 costs more than you think
table: { rules: vegas-default, puck: 6, bankroll: 500, bets: [] }
dice: random
allowedBets: [place-4, place-5, place-6]
showEv: true
steps:
  - "Drag $5 toward **Place 4**. Read the EV panel: 6.67% edge, tier orange. It suggests **Buy 4** (1.67%) instead."
  - "Compare with **Place 6**. Which would you choose?"
```

```quiz
- q: What does a $12 Place bet on the 8 win?
  options: ["$12", "$14", "$10", "$7"]
  answer: 1
  explain: "7:6 means $7 for every $6: $12 wins $14."
- q: Which Place bet has the lowest house edge?
  options: ["4", "5", "6", "10"]
  answer: 2
  explain: "6 and 8: 1.52%. Then 5/9 at 4%, then 4/10 at 6.67%."
- q: By default, what happens to your Place 6 if a 7 rolls on the come-out?
  options: ["It loses", "It wins", "Nothing, it's off", "It's moved"]
  answer: 2
  explain: "Place bets are off on the come-out unless you call them working."
- q: Why bet $6 rather than $5 on Place 6?
  options: ["Table minimum", "$5 gets paid even money, a higher edge", "No reason", "To get 2:1"]
  answer: 1
  explain: "7:6 needs $6 units. A $5 bet is usually paid $5, and the edge jumps to about 9.1%."
```

---

### Lesson 10: `buy-and-lay`: Buy and Lay bets: paying commission

**Objectives**

* Explain a Buy bet: true-odds payout with a 5% commission ("vig").
* Explain a Lay bet: betting a 7 shows before a number, at true odds, less 5% of the win.
* Know when Buy beats Place (4 and 10 only) and how vig timing changes the edge.

**Lesson**

**Buy bets** are like place bets, except the casino pays **true odds** (2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8) and charges a **5% commission**, called the **vig**. In this app, as at many Las Vegas casinos, the vig is **5% of your bet, taken only when you win**.

| Buy | House edge (vig on win) | Compare Place |
|---|---|---|
| 4 / 10 | **1.67%** | 6.67% → **buy these instead** |
| 5 / 9 | 2.00% | 4.00% → buying wins on paper, but real-casino rounding often wipes it out |
| 6 / 8 | 2.27% | **1.52% → place these instead** |

So the rule of thumb is: **place the 6 and 8, buy the 4 and 10.**

Some casinos take the vig **up front**, when you make the bet. Then every buy bet costs **4.76%**: still better than placing the 4/10, but no longer cheap. Real casinos also round the vig. The usual minimum is $1, which is why buy bets are typically $20 or more ($20 × 5% = $1).

**Lay bets** are the reverse: you bet that **7 comes before** the number. 7 is more likely, so you have to risk more than you win. You pay true odds the other way (lay $2 to win $1 against 4/10, $3 to win $2 against 5/9, $6 to win $5 against 6/8), and the vig is **5% of what you win**.

| Lay | House edge (vig on win) | Vig paid up front |
|---|---|---|
| 4 / 10 | **1.67%** | 2.44% |
| 5 / 9 | 2.00% | 3.23% |
| 6 / 8 | 2.27% | 4.00% |

Lay bets are **always working**, including on the come-out, and you can take them down at any time.

:::math Buy and Lay edges
Buy 4, $1, vig 5% of bet on win: win (1/3) pays 2 − 0.05 = 1.95; lose (2/3) −1. EV = 0.65 − 0.6667 = −0.01667 → **1.667%**.
Buy 5: (2/5)(1.5 − 0.05) − 3/5 = 0.58 − 0.60 = −0.02 → **2.00%**. Buy 6: (5/11)(1.2 − 0.05) − 6/11 = −0.25/11 → **2.27%**.
Vig up front: you risk 1.05 for an otherwise fair bet, expected loss 0.05 → 0.05/1.05 = **4.76%** for every number.

Lay 4, $1, wins $0.50 with P = 2/3, vig 5% of the win: (2/3)(0.475) − (1/3)(1) = −0.01667 → **1.667%**.
Lay 5: wins 2/3 with P = 3/5: (3/5)(0.6333) − 2/5 = −0.02 → **2.00%**. Lay 6: wins 5/6 with P = 6/11: (6/11)(0.79167) − 5/11 = −0.02273 → **2.27%**.
Up front: the vig is 5% × win; edge = vig/(lay + vig) = 0.025/1.025 = 2.44% (4/10), 0.0333/1.0333 = 3.23% (5/9), 0.04167/1.04167 = 4.00% (6/8).
:::

**Simulator scenes**

```scene
id: l10-s1
title: Buy the 10
table: { rules: vegas-default, puck: 6, bankroll: 500, bets: [] }
dice: "script:[[5,5]]"
allowedBets: [buy-10, place-10]
highlight: [buy-10]
showEv: true
steps:
  - "Drag $20 toward **Place 10**: 6.67%, orange. Now drag it to **Buy 10**: 1.67%, green."
  - "Buy the 10 for $20. Roll: 10! You win $40, less a $1 vig = $39."
```

```scene
id: l10-s2
title: Lay the 4
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [] }
dice: "script:[[2,2],[3,4]]"
allowedBets: [lay-4]
highlight: [lay-4]
showEv: true
steps:
  - "Lay **$40** against the 4. It's working even on the come-out."
  - "Roll: hard 4. You lose $40. Ouch: laying means risking more to win less."
  - "Lay $40 again and roll: 7. You win $20 less a $1 vig = $19."
```

```quiz
- q: You want to bet on the 10. What's the cheapest way (vig on win)?
  options: ["Place 10 (6.67%)", "Buy 10 (1.67%)", "Hard 10", "Big 6"]
  answer: 1
  explain: "Buying the 4 and 10 cuts the edge from 6.67% to 1.67%."
- q: You want to bet on the 6. Which is cheaper?
  options: ["Place 6", "Buy 6", "They're equal", "Big 6"]
  answer: 0
  explain: "Place 6 is 1.52%; Buy 6 is 2.27%; Big 6 is 9.09%."
- q: A $30 Lay bet against the 9 wins. What do you collect (vig 5% of the win)?
  options: ["$20", "$19", "$30", "$45"]
  answer: 1
  explain: "Lay 3 to win 2: $30 wins $20, less a $1 vig = $19 (you also keep your $30)."
- q: If the vig on a Buy bet is paid up front, the edge on every number is...
  options: ["1.67%", "4.76%", "5%", "0%"]
  answer: 1
  explain: "You pay $0.05 for each $1, so you risk $1.05 to lose $0.05 on average: 0.05/1.05 = 4.76%."
```

---

### Lesson 11: `dont-side`: The Don't side

**Objectives**

* Explain Don't Pass and Don't Come as bets on the shooter losing, with "bar 12".
* Lay odds behind Don't bets: true odds, 0% edge, up to 6× at a 3-4-5x table.
* Compare the Do and Don't sides: edge, swings and social feel.

**Lesson**

Everything on the Pass side has a mirror image. **Don't Pass** (and **Don't Come**, its any-time version) bets that the shooter will **lose**:

* Come-out **2 or 3**: **win**.
* Come-out **12**: **push** (a tie, your bet stays). This is the "**bar 12**" printed on the layout. Without it, the Don't would beat the house.
* Come-out **7 or 11**: **lose**.
* A point is set: you **win if 7 comes before the point**, and lose if the point comes first.

On the come-out the Don't is the underdog (3 ways to win vs 8 ways to lose). But **once a point is set, the Don't is the favourite**. A Don't Pass on a 4 wins 2 times out of 3. Because of that, Don't bets **can** be taken down after a point is set, but you **shouldn't**: you'd be giving up the good part of the bet.

**House edge: 1.36%**, a little lower than the Pass Line's 1.41%.

**Laying odds.** Behind a Don't bet you can **lay odds**, which is the mirror of taking odds: risk more to win less, at true odds, **0% edge**. At a 3-4-5x table you may lay up to **6×** your flat bet on any point (that wins 3×, 4× or 5×). Don't Pass + 6× lay odds has a combined edge of **0.27%**, the lowest of any standard bet combination at this table. Lay odds are **always working**, even on the come-out for Don't Come bets.

Why does almost everyone bet "right" anyway?

* **The swings feel different.** Don't players win small and often, and lose big when a point is made. A hot shooter can wipe out a Don't player while the rest of the table cheers.
* **It's social.** Betting Don't means betting against the shooter and the table. It's perfectly legal and polite, just quieter. ("Darksiders" usually celebrate silently.)
* **The math is nearly a tie.** 1.36% vs 1.41%, or 0.27% vs 0.37% with full odds. The choice is mostly about feel, not money.

:::math Don't Pass numbers
Win on the come-out (2 or 3) = 3/36. Win after a point (7 first) = Σ P(pt) × 6/(ways + 6) = 2 × [3/36 × 2/3 + 4/36 × 3/5 + 5/36 × 6/11] = 251/495 − 4/36 (that's the Pass Line's "point then seven-out" losses).
Total **win = 3/36 + 251/495 − 4/36 = 251/495 − 1/36 = 949/1980 ≈ 47.93%**.
Lose = 244/495 = 976/1980 ≈ 49.29%. Push (12) = 1/36 = 55/1980 ≈ 2.78%.
EV = (949 − 976)/1980 = −27/1980 = −3/220 ≈ **−1.364%** per bet made. Counting only bets that win or lose (ignoring pushes): 27/1925 ≈ 1.403%.

Lay odds of 6× on every point: expected lay = 6 × 24/36 = 4 units per flat unit. Combined = (3/220)/(1 + 4) = **0.273%**.
With lay odds that win N× the flat: expected lay = N × Σ P(pt) × true odds = N × 1. Combined = (3/220)/(1 + N): N = 1: 0.682%; 2: 0.455%; 10: 0.124%; 100: 0.0135%.
:::

**Simulator scenes**

```scene
id: l11-s1
title: Going dark
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [] }
dice: "script:[[2,2],[3,4]]"
allowedBets: [dont-pass, dont-pass-odds]
highlight: [dont-pass]
showEv: true
steps:
  - "Bet **$10** on **Don't Pass**. EV panel: 1.36%."
  - "Roll: 4 is the point. Your Don't Pass now wins 2 times in 3."
  - "Lay **$60** odds (6×) behind it. It wins $30 if a 7 comes first. EV panel: 0.00%."
  - "Roll: 7! Seven-out. You win $10 + $30. The table groans; you smile quietly."
```

```scene
id: l11-s2
title: The bar 12
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [ { bet: dont-pass, amount: 10 } ] }
dice: "forced:[6,6]"
allowedBets: []
steps:
  - "Roll. 12 on the come-out: Pass loses, but your Don't Pass **pushes**. It stays on the table."
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

---

### Lesson 12: `field-and-big-6-8`: Field and Big 6/8

**Objectives**

* Explain the Field: a one-roll bet that wins on 2, 3, 4, 9, 10, 11 and 12.
* See why "seven numbers vs four" is a trap, and know the 2:1/2:1 vs 2:1/3:1 Field variants.
* Know that Big 6/8 is the same bet as Place 6/8 at a much worse payout.

**Lesson**

**The Field** is a one-roll bet. Win if the next roll is 2, 3, 4, 9, 10, 11 or 12; lose on 5, 6, 7 or 8. Most winners pay even money, but 2 and 12 pay extra.

It looks generous: seven winning numbers against only four losing ones! But count **ways**, not numbers. The four losers (5, 6, 7, 8) are the four most common totals: **20 ways out of 36**. The winners have only 16.

| Field variant | 2 pays | 12 pays | House edge |
|---|---|---|---|
| This app's default | 2:1 | 2:1 | **5.56%** |
| Better tables | 2:1 | 3:1 | 2.78% |

Because it settles on every roll, the Field's cost piles up fast. That idea gets its own lesson (14).

**Big 6 / Big 8** sits in the corner. It wins if the 6 (or 8) rolls before a 7, the **exact same thing as Place 6/8**, but it pays only **even money** instead of 7:6. That pushes the edge from 1.52% to **9.09%**. There's never a reason to bet Big 6/8; place the number instead. (Atlantic City removed it altogether.)

:::math Field and Big 6/8
Field (2:1 on 2 and 12): EV = [1 × (2+3+4+3+2) + 2 × 1 + 2 × 1 − 20]/36 = (14 + 4 − 20)/36 = −2/36 = **−5.556%**.
With 3:1 on 12: (14 + 2 + 3 − 20)/36 = −1/36 = **−2.778%**.

Big 6: P(win) = 5/11, pays 1:1. EV = 5/11 − 6/11 = −1/11 = **−9.09%**.
:::

**Simulator scenes**

```scene
id: l12-s1
title: Seven numbers, four numbers
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [] }
dice: random
allowedBets: [field]
highlight: [field]
showEv: true
autoRoll: { rolls: 200, speed: fast }
steps:
  - "Put $5 on the **Field**. EV panel: 5.56%, orange, and it suggests the Pass Line (1.41%)."
  - "Turn on **Re-bet every roll** and **Auto-roll 200**. Compare the session result with the expected loss of 200 × $5 × 5.56% ≈ $56."
```

```scene
id: l12-s2
title: Big 6 vs Place 6
table: { rules: vegas-default, puck: 9, bankroll: 500, bets: [] }
dice: "forced:[2,4]"
allowedBets: [big-6, place-6]
highlight: [big-6, place-6]
showEv: true
steps:
  - "Put $6 on **Big 6** and $6 on **Place 6**."
  - "Roll: 6. Both win, but Big 6 pays $6 and Place 6 pays $7. Same bet, worse price."
```

```quiz
- q: How many of the 36 combinations win a Field bet?
  options: ["7", "16", "20", "18"]
  answer: 1
  explain: "2 (1) + 3 (2) + 4 (3) + 9 (4) + 10 (3) + 11 (2) + 12 (1) = 16."
- q: Big 8 and Place 8 both win when...
  options: ["8 rolls before 7", "8 rolls next", "8 rolls as a pair", "Any even number"]
  answer: 0
  explain: "It's the same event; only the payout differs (1:1 vs 7:6)."
- q: Which has the higher edge?
  options: ["Field paying 3:1 on 12", "Field paying 2:1 on 12", "Equal", "Place 8"]
  answer: 1
  explain: "2:1 on 12 → 5.56%; 3:1 on 12 → 2.78%; Place 8 → 1.52%."
```

---

### Lesson 13: `sucker-bets`: Hardways, props and the middle of the table

**Objectives**

* Know the center bets: hardways, Any 7, Any Craps, 2, 3, 11, 12, Horn, C&E, World and hop bets.
* See that their edges run from 9% to almost 17%, and spot "for" vs "to" payouts.
* Recognise bonus side bets (Fire Bet, All/Tall/Small) as high-edge.

**Lesson**

The center of the table is bright, loud and paid at long odds. It's also where craps makes most of its money.

**Hardways** (multi-roll): bet that a number rolls **as a pair** before it rolls easy or a 7.

| Bet | Pays | Wins | House edge |
|---|---|---|---|
| Hard 6 / Hard 8 | 9:1 | 1 way vs 10 losing ways | **9.09%** |
| Hard 4 / Hard 10 | 7:1 | 1 way vs 8 losing ways | **11.11%** |

Hardways are off on the come-out by default and can be taken down.

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
| Hop (easy, e.g. 2-4) | that exact pair, either way round | 15:1 | 11.11% |
| Hop (hard, e.g. 3-3) | that exact pair | 30:1 | 13.89% |

**Watch the word "for".** Some layouts print "30 **for** 1" instead of "30 **to** 1". "For" includes your original bet, so 30 for 1 is really 29 to 1, an even worse deal. This app's tables pay "to".

**Bonus side bets** you'll see in casinos (not in this simulator):

* **Fire Bet**: pays if the shooter makes 4, 5 or 6 *different* points. With the common 24:1 / 249:1 / 999:1 paytable the edge is about **20.8%**.
* **All / Tall / Small**: pays if every number from 2 to 6 (Small), from 8 to 12 (Tall), or both (All) rolls before a 7. With 34:1 / 34:1 / 175:1 the edge is about **7.5–7.8%**, and much higher with 30:1 / 150:1.

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

**Simulator scenes**

```scene
id: l13-s1
title: The red zone
table: { rules: vegas-default, puck: 8, bankroll: 500, bets: [] }
dice: random
allowedBets: all
highlight: [any-7, horn, hard-8, world]
showEv: true
steps:
  - "Drag a chip over **Any 7**, **Horn**, **World** and **Hard 8** in turn, without placing it. Each one shows a red or orange tier and suggests a cheaper bet."
  - "Place $1 on Any 7 and $1 on Hard 8 anyway, then roll a few times. Watch the session panel."
```

```scene
id: l13-s2
title: 1,000 Any 7 bets
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [any-7]
showEv: true
autoRoll: { rolls: 1000, speed: fast }
steps:
  - "Put $1 on Any 7, turn on **Re-bet every roll**, and **Auto-roll 1,000**."
  - "Expected loss: 1,000 × $1 × 16.67% ≈ $167. How close did you get?"
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

---

### Lesson 14: `edge-per-roll`: Edge per bet vs edge per roll, and the cost of an hour

**Objectives**

* Tell apart edge **per bet resolved** and edge **per roll**.
* Work out the expected cost of an hour: bet size × per-roll edge × number of rolls.
* See why a one-roll bet that "only" costs 5.56% is far more expensive per hour than a Pass Line bet.

**Lesson**

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

**The cost of an hour.** A busy table runs about 100 rolls an hour, and a quiet one more (a crowded one fewer). Expected cost ≈ **bet × per-roll edge × rolls the bet is working**:

| Your play (about 100 rolls/hour) | Expected cost per hour |
|---|---|
| $10 Pass Line, every round | **$4.19** |
| $10 Pass Line + max odds | **$4.19**, the same: odds cost nothing |
| $10 Don't Pass + 6× lay odds | $4.04 |
| $6 Place 6 + $6 Place 8 (off on come-outs) | $3.91 |
| $5 Field, every roll | **$27.78** |
| $1 Any 7, every roll | $16.67 |
| $4 Horn, every roll | $50.00 |

A $5 Field bettor pays almost **7×** what a $10 Pass Line bettor pays, while betting half as much.

:::math Per-roll edge and hourly cost
Average rolls per Pass decision: 1 + Σ P(point) × 1/P(point or 7 per roll) = 557/165 ≈ 3.376. Per-roll edge = 1.414% ÷ 3.376 = **0.419%**.
Place 6: it resolves on any 6 or 7, 11/36 of rolls. Per-roll edge = (1/66) × (11/36) = **0.463%**. Place 4: (1/15) × (9/36) = 1.667%. Hard 8: (1/11) × (11/36) = 1/36 = 2.778%; Hard 4: (1/9) × (9/36) = 1/36 too.
Share of rolls that are in the point phase: 1 − 165/557 = 392/557 ≈ 70.4%. Bets that are off on come-outs only work on those rolls.
$10 Pass, 100 rolls: 100/3.376 ≈ 29.6 decisions × $10 × 1.414% = **$4.19**. Place 6 + 8: $12 × 0.463% × 70.4 = **$3.91**. Field: $5 × 5.556% × 100 = **$27.78**.
:::

**Simulator scenes**

```scene
id: l14-s1
title: Pass vs Field, one hour
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [pass-line, field]
showEv: true
autoRoll: { rolls: 100, speed: fast }
steps:
  - "Bet $10 on the Pass Line and $5 on the Field. Turn on **Re-bet** for both."
  - "**Auto-roll 100** (about an hour). The session panel splits the result by bet and shows expected vs actual."
  - "Repeat 5 times. The Field's expected-cost line is far steeper."
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

---

### Lesson 15: `variance-and-bankroll`: Variance, swings and bankroll

**Objectives**

* Know that short sessions are mostly luck: the edge only takes over in the long run.
* Tell expected loss (cost) apart from standard deviation (swing).
* Size a session bankroll for flat bets and for full odds.

**Lesson**

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
The broke-in-an-hour figures come from 20,000 simulated 100-roll sessions, betting only when the bankroll can cover the bet plus full odds. The simulator's auto-roll reproduces them.
:::

**Simulator scenes**

```scene
id: l15-s1
title: Same cost, bigger swings
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds]
showEv: true
autoRoll: { rolls: 100, speed: fast, repeat: 20, chart: session-results }
steps:
  - "Strategy A: $10 Pass, no odds. Tap **Run 20 hours**. Each dot on the chart is one hour."
  - "Strategy B: $10 Pass + max odds. Run 20 hours again."
  - "Same average, much wider spread. Which spread are you comfortable with?"
```

```scene
id: l15-s2
title: Bankroll test
table: { rules: vegas-default, puck: off, bankroll: 100, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds]
autoRoll: { rolls: 100, speed: fast, repeat: 50, stopWhenBroke: true, chart: survival }
steps:
  - "Start with $100 and play $10 Pass + max odds for an hour, 50 times over. How many runs go broke?"
  - "Now try a $500 bankroll."
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

---

### Lesson 16: `myths-and-systems`: Myths, systems and dice control

**Objectives**

* Know that no betting system changes the house edge.
* Spot the gambler's fallacy ("the 7 is due").
* Weigh dice control and "hot tables" honestly.

**Lesson**

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

**Simulator scenes**

```scene
id: l16-s1
title: Martingale vs flat
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [pass-line]
autoRoll: { rolls: 1000, speed: fast, repeat: 20, betting: martingale, base: 10, tableMax: 1000, chart: session-results }
steps:
  - "Run Martingale (double after each loss) for 20 sessions of 1,000 rolls. Most sessions end up a little; a few crash hard."
  - "Run flat $10 betting for the same sessions. Compare the averages: both negative."
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

---

### Lesson 17: `etiquette`: Playing at a real table

**Objectives**

* Buy in, place bets and collect winnings correctly.
* Know the shooter's rules and common table manners.
* Know how tipping works in craps.

**Lesson**

Real tables move fast, but the rules of the road are simple.

**Buying in.** Wait until the dice are in the middle, then put your cash **on the layout** (never in the dealer's hand) and say "**change, please**". Chips go in the **rail** in front of you. Keep them there.

**Making bets.**

* You place your own **Pass, Don't Pass, Come, Don't Come, Field** and **odds behind the line**.
* For **Place, Buy, Lay, Come odds** and the **center bets**, set chips down in the Come area and tell the dealer (or stickman), for example "**$12, place the 6 and 8**", "**$1 hard 8**".
* Call your bets **before** the stickman sends the dice out. Once the shooter has the dice, keep your hands out of the table: a die hitting a hand starts arguments.
* Make sure your bets are the right size for the payout ($6 units on 6/8, $5 units on 4/5/9/10, even amounts for odds on 5/9).

**Shooting.** You'll usually need a Pass or Don't Pass bet to shoot. Pick two dice, **use one hand**, keep them over the table, and throw so **both dice hit the back wall**. Don't fuss with them for long.

**Manners.**

* Don't say "seven" out loud at the table. It's a superstition, but a strong one.
* Keep drinks off the rail.
* Don't blame the shooter, or the Don't bettors.
* When you leave, ask to "**color up**" to bigger chips between rolls.

**Tipping ("toking").** Dealers rely on tips. The craps way is to **bet for them**: "a $1 Yo for the dealers", or a small Pass Line bet "for the boys". Tipping isn't required, but it's customary when you win. If you want your tip to last, a line bet with odds for the dealers is cheaper for you than a prop bet.

:::tip
Ask questions during a slow moment. Dealers are paid to help, and quiet tables are the best place to learn.
:::

**Simulator scenes**

```scene
id: l17-s1
title: Call your bets
table: { rules: vegas-default, puck: 6, bankroll: 300, bets: [ { bet: pass-line, amount: 10 } ] }
dice: random
allowedBets: [place-8, place-5, hard-8, pass-odds]
mode: call-bet
steps:
  - "In call-bet mode you **say** the bet: choose the phrase from the list, and the dealer places it."
  - "Call: '$6 place the 8'. Then: '$50 odds' (you place odds yourself: tap behind your line bet)."
  - "Try calling '$5 place the 8'. The dealer suggests $6 for the full 7:6 payout."
```

(The `mode: call-bet` scene mode is optional for the v1 simulator. If it's not built, this scene falls back to normal tapping with the step text.)

```quiz
- q: Where do you put cash to buy in?
  options: ["In the dealer's hand", "On the layout", "On the Pass Line", "In the rail"]
  answer: 1
  explain: "Dealers can't take cash from your hand. Lay it on the felt between rolls."
- q: Which bet do you place yourself?
  options: ["Place 6", "Hard 8", "Odds behind your Pass bet", "Any 7"]
  answer: 2
  explain: "Line bets, Come/Don't Come, Field and line odds are yours to place. Dealers handle the rest."
- q: How do craps players usually tip?
  options: ["Hand cash to the stickman", "Make a bet for the dealers", "Tip only the boxperson", "Tipping isn't allowed"]
  answer: 1
  explain: "A bet 'for the dealers' is the tradition."
```

---

### Lesson 18: `strategy-lowest-edge`: Perfect strategy I: the lowest possible edge

**Objectives**

* State the mathematical optimum: Don't Pass/Don't Come with maximum lay odds.
* Rank the best combinations by edge per dollar bet.
* Know what "perfect" can and can't achieve: no positive-EV play exists.

**Lesson**

Here's the uncomfortable truth: **there is no way to win at craps in the long run**. Every bet except odds has a house edge, and odds can only be added to bets that have one. "Perfect strategy" therefore means **paying the smallest possible edge for every dollar you put in action**.

By that pure measure, the ranking at a 3-4-5x table is:

| Rank | Play | Edge per dollar bet |
|---|---|---|
| 1 | **Don't Pass / Don't Come + 6× lay odds** | **0.27%** |
| 2 | Pass / Come + 3-4-5× odds | 0.37% |
| 3 | Don't Pass / Don't Come, no odds | 1.36% |
| 4 | Pass / Come, no odds | 1.41% |
| 5 | Place 6 or 8 | 1.52% |
| 6 | Buy 4/10, Lay 4/10 (vig on win) | 1.67% |

So the **mathematically perfect recipe** is:

1. Bet the **table minimum on Don't Pass**.
2. When a point is set, **lay the maximum odds** (6× here).
3. For more action, add **Don't Come** bets and lay full odds on each.
4. **Never** take down a Don't bet once its point is set.
5. **Bet nothing else.**

The right side is a very close second. Pass + max odds is 0.37%, and some players prefer it for reasons covered in Perfect strategy II. **At higher-odds tables the gap all but vanishes**: with 10× odds it's 0.12% vs 0.18%, and at 100× it's 0.01% vs 0.02%.

Two caveats keep this honest:

* **Edge per dollar isn't dollars per hour.** Your expected cost still comes from the flat bets: about $4 an hour at $10. The odds just let you bet much more at that same cost.
* **Lay odds risk big to win small.** You'll put up $60 behind a $10 bet to win $30–50. Make sure your bankroll (lesson 15) can carry it.

:::math Comparing the two sides at different odds
Combined edge = flat edge ÷ (1 + expected odds amount per flat unit).
Right side, 3-4-5x: (7/495)/(1 + 25/9) = 0.374%. Don't side, 6× lay: (3/220)/(1 + 4) = 0.273%.
Lay 6× means 6 units laid on every point (wins 3, 4 or 5 units). The Don't side gets more 0% money in action per flat unit (4.0 vs 2.78), as well as a slightly lower flat edge.
At N× (taking N×; laying to win N×): right (7/495)/(1 + 2N/3); don't (3/220)/(1 + N).
:::

**Simulator scenes**

```scene
id: l18-s1
title: The optimum, hands-on
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [dont-pass, dont-pass-odds, dont-come, dont-come-odds]
showEv: true
steps:
  - "Bet $10 on Don't Pass. When a point is set, lay full odds."
  - "Add up to two Don't Come bets with full lay odds. Play 10 rounds."
  - "Your session panel's 'edge per dollar' should land near 0.27%."
```

```scene
id: l18-s2
title: Optimum vs near-optimum, 10,000 rolls
table: { rules: vegas-default, puck: off, bankroll: 100000, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds, dont-pass, dont-pass-odds]
autoRoll: { rolls: 10000, speed: fast, compare: ["pass-line+max-odds", "dont-pass+max-odds"], chart: running-result }
steps:
  - "Run both strategies on the **same dice** for 10,000 rolls. The lines are mirror images: one side's win is the other's loss (apart from the bar 12)."
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
```

---

### Lesson 19: `strategy-practical`: Perfect strategy II: low edge, real life

**Objectives**

* Build a near-optimal plan that suits your budget, temperament and table.
* Choose between Do and Don't knowing the real tradeoffs.
* Plan a session: bankroll, odds level, stop rules.

**Lesson**

Pure math says Don't + max odds. Real life adds budget, nerves and a table full of people. Here's the **practical perfect strategy**: still near the minimum edge, and built for an actual evening.

**The core plan (right side)**

1. **Pass Line at the table minimum.**
2. **Take odds**: the maximum if your bankroll allows, otherwise 2× (0.61%) or 1× (0.85%). Prefer smaller flat bets with more odds over bigger flat bets with less odds.
3. Want more numbers working? Add **one or two Come bets** with odds. Or, as the **acceptable alternative**, **place the 6 and 8** in $6 units (1.52%, and quick, with no waiting for a bet to travel).
4. Want the 4 or 10? **Buy** them (1.67% with vig on win). Never place them (6.67%).
5. **Skip** the Field, Big 6/8, hardways and every center bet.

**Do or Don't?**

| | Right (Pass/Come) | Dark (Don't Pass/Don't Come) |
|---|---|---|
| Edge with full odds | 0.37% | 0.27% |
| Feel | Win with the table; big cheers on hot rolls | Win against the table; quiet celebrations |
| How results come | Many small losses, occasional big wins | Many small wins, occasional big losses |
| Money needed for full odds | Smaller (odds ≤ 5× the flat bet) | Larger (lay 6× the flat bet) |

The difference is **0.1% of action**, about **$0.10 an hour** in expected cost at $10. Choose the side you'll enjoy and stick to it calmly.

**Session planning, at a $10 table (about 100 rolls an hour)**

| Plan | Edge per $ bet | Expected cost/hour | Typical hourly swing | Bankroll for ~1 hour |
|---|---|---|---|---|
| $10 Pass, no odds | 1.41% | $4 | ±$55 | $100–150 |
| $10 Pass + 2× odds | 0.61% | $4 | ±$155 | $300–400 |
| $10 Pass + 3-4-5× | 0.37% | $4 | ±$265 | $500–800 |
| $10 Don't + 6× lay | 0.27% | $4 | ±$265 | $500–800 |
| $6 Place 6 + $6 Place 8 | 1.52% | $4 | ±$50 | $100–150 |

Plan rules that work:

* **Decide your bankroll before you sit down**, and make your odds level fit it.
* Set a **loss limit** (for example, the whole session bankroll) and a **time limit**.
* A **win goal** ("I'll stop if I'm up $200") doesn't change EV, but it makes good nights end as good nights.
* **Comps**: casinos rate your play by bet size and time, usually at an average edge, and often without counting odds. A small flat bet with big odds gets you cheap action and decent ratings.

:::math Behind the planning table
Expected cost/hour = $10 × 1.414% × 29.6 decisions ≈ $4.19 for every Pass plan (odds add 0); Don't ≈ $4.04; Place 6 + 8 = $12 × 0.463% × 70.4 rolls ≈ $3.91.
Swings and bankrolls come from 40,000 simulated 100-roll hours (see lesson 15). "Bankroll for ~1 hour" ≈ the 7%-to-under-1% risk of ruin range.
:::

**Simulator scenes**

```scene
id: l19-s1
title: Build your plan
table: { rules: vegas-default, puck: off, bankroll: 500, bets: [] }
dice: random
allowedBets: all
showEv: true
planner: true
steps:
  - "Open the **Plan** panel. Choose a side (Right/Dark), your flat bet, an odds level and extra numbers (Come bets, or Place 6 & 8)."
  - "The panel shows edge per dollar, expected cost per hour, hourly swing, and a suggested bankroll."
  - "Tap **Play my plan** to auto-bet it for 100 rolls."
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
  options: ["Huge, avoid Pass", "About 0.1% of action, around 10¢ an hour at $10", "Nothing, they're equal", "Pass is cheaper"]
  answer: 1
  explain: "0.37% vs 0.27% per dollar bet: a small price for many players' preference."
```

---

### Lesson 20: `strategy-fun-per-dollar`: Perfect strategy III: the most fun per dollar

**Objectives**

* Compare popular "action" strategies by expected cost per hour, not by how often they win.
* Use a simple **fun-per-dollar** measure: swing per dollar of expected cost.
* Know how to get lots of action cheaply.

**Lesson**

Some people come for the math, most come for the thrill. If fun is the goal, the question is: **how much excitement do I get for each dollar I expect to lose?**

Here are some popular ways to play a $10-ish table, priced honestly (about 100 rolls an hour):

| Strategy | What it is | Expected cost/hour | Hourly swing | Fun per $ (swing ÷ cost) |
|---|---|---|---|---|
| **Pass + max odds** | $10 Pass, 3-4-5× odds | $4.19 | ±$265 | **63** |
| **3-point Molly** | $10 Pass + up to two $10 Come bets, all with max odds | ~$10.50 | ±$470 | **45** |
| **Place 6 & 8** | $6 each, after the point | $3.91 | ±$50 | 13 |
| Flat Pass | $10 Pass, no odds | $4.19 | ±$55 | 13 |
| $1 Hard 6 & Hard 8 | kept up after the point | $3.91 | ±$20 | 5 |
| **Iron Cross** | $5 Field + $5 Place 5 + $6 Place 6 + $6 Place 8, after the point | $27.37 | ±$80 | 3 |
| Field every roll | $5 | $27.78 | ±$55 | 2 |
| Horn every roll | $4 | $50.00 | — | — |

What this shows:

* **Odds are the cheapest thrill in the casino.** Pass + odds and the 3-point Molly give the biggest swings per dollar of cost, because odds add excitement at 0% edge.
* **The 3-point Molly** is the classic "lots of numbers working" plan that stays mathematically clean. It costs about 2.5× the single Pass bet, because there are more flat bets in action, but it's still only ~0.42% of everything you bet.
* **Iron Cross** wins on every roll except 7 (83% of rolls!). That feels great, but it costs about **6.5×** as much per hour as Pass + odds. The steady trickle of small wins is the price you're paying.
* **Small hardway bets** are cheap in dollars per hour ($1 units), but they're 9% bets. Enjoy them as a garnish, not a meal.
* **Props every roll** are the most expensive fun on the table.

A good **fun-per-dollar recipe**: Pass (or Don't) at the minimum, full odds, one or two Come bets with odds (or Place 6 & 8), plus, if you like, a $1 hardway now and then. Lots of action, lots of numbers, all for a few dollars an hour.

:::math How the table was computed
Expected cost/hour: bet × per-roll edge × rolls working (100 rolls; point-phase-only bets work on ≈70.4 of them).
Iron Cross per point-phase roll: Field $5 × 5.556% + Place 5 $5 × 1.111% + Place 6/8 $12 × 0.463% = $0.3889; × 70.4 = **$27.37**. It wins on 30 of 36 totals and loses $22 on the 6 ways to roll 7.
3-point Molly: on average ≈ 2.4 flat $10 bets in action per roll × 0.419% per roll ≈ $0.10/roll → ≈ $10–10.50/hour (simulated: $10.52).
Swings are from 40,000 simulated hours. "Fun per $" = hourly SD ÷ expected hourly cost: a rough measure of excitement per dollar paid. It isn't an official statistic, just an honest yardstick.
:::

**Simulator scenes**

```scene
id: l20-s1
title: Iron Cross vs Pass + odds
table: { rules: vegas-default, puck: off, bankroll: 2000, bets: [] }
dice: random
allowedBets: all
showEv: true
autoRoll: { rolls: 100, speed: fast, repeat: 20, compare: ["iron-cross", "pass-line+max-odds"], chart: session-results }
steps:
  - "Run 20 hours of each on the same dice. Iron Cross wins more rolls; check which one has the better average."
```

```scene
id: l20-s2
title: Run a 3-point Molly
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: [pass-line, pass-odds, come, come-odds]
showEv: true
steps:
  - "Bet $10 Pass and take full odds. Add a Come bet each roll until you have three numbers working, each with full odds."
  - "Whenever one wins or loses, add another Come bet to stay at three. Play 50 rolls."
```

Preset strategy ids used by `compare`: `iron-cross`, `pass-line+max-odds`, `dont-pass+max-odds`, `three-point-molly`, `place-6-8`, `field-every-roll`.

```quiz
- q: Which strategy costs the most per hour at roughly similar bet sizes?
  options: ["Pass + max odds", "3-point Molly", "Iron Cross", "Place 6 & 8"]
  answer: 2
  explain: "Iron Cross ≈ $27/hour, mostly from the Field bet on every point-phase roll."
- q: Iron Cross wins on 30 of 36 combinations. Why is it still a poor deal?
  options: ["It doesn't win often", "The 7 takes the whole $22 at once, and the Field's 5.56% runs every roll", "Dealers dislike it", "It loses on 2 and 12"]
  answer: 1
  explain: "Winning often isn't the same as winning on average."
- q: What's the cheapest way to add excitement?
  options: ["Bigger prop bets", "More odds", "Field bets", "Big 6/8"]
  answer: 1
  explain: "Odds add swing at 0% edge."
```

---

### Lesson 21: `final-exam` ✔: Final exam

**Objectives**

* Show mastery of rules, payouts, edges, bankroll and strategy.

**Lesson**

Twelve questions drawn from the whole course. Score 80% or more to earn the **Perfect Strategy** badge and unlock the sandbox's **Challenge mode** (play 300 rolls, and you're scored on edge per dollar, with no red-tier bets).

**Simulator scenes**

```scene
id: l21-s1
title: The perfect session
table: { rules: vegas-default, puck: off, bankroll: 1000, bets: [] }
dice: random
allowedBets: all
showEv: true
steps:
  - "Play 30 rolls with any bets you like. You pass if your session's edge per dollar stays under 0.5% and you place no red-tier bets."
```

```quiz
- q: The point is 5. You have $10 Pass + $40 odds. A 5 rolls. Total win?
  options: ["$50", "$70", "$60", "$40"]
  answer: 1
  explain: "$10 + $40 × 3/2 ($60) = $70."
- q: Which is the cheapest way to bet the 4?
  options: ["Place 4", "Buy 4 (vig on win)", "Hard 4", "Field"]
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
- q: Lay $40 against the 10 wins. You collect (vig 5% of win)...
  options: ["$20", "$19", "$40", "$38"]
  answer: 1
  explain: "Lay 2 to win 1: $20, less a $1 vig."
- q: Which is the best description of "perfect strategy" in craps?
  options: ["A system that beats the house", "Paying the smallest edge for the action you want, with a bankroll that fits the swings", "Only betting when the table is hot", "Never betting the Don't"]
  answer: 1
  explain: "No strategy wins long-term; you minimise the cost and manage the variance."
```

---

## 5. Bet reference table

Applies to rule set `vegas-default` (section 2). These numbers are authoritative: the simulator's EV engine and its unit tests must reproduce them (exact fractions are in 5.4).

Definitions

* **Payout** is "to 1": net profit per unit won. The stake is returned on a win.
* **Edge per bet** = expected loss ÷ amount bet, per bet **made** (pushes count as bets made: Don't Pass gives 1.364%). For buy and lay bets the vig counts as part of the loss, and the base is the bet amount, not bet + vig.
* **Edge per roll** = expected loss per roll ÷ amount in action, counted over the rolls the bet is working (pushes count as a roll).
* **EV per $1** = −edge per bet.
* "Off on come-out" means the bet stays on the layout but neither wins nor loses on a come-out roll.

### 5.1 Rules: when bets can be made, how they resolve, working status

| id | Name | Can be placed | Wins | Loses | Push | Pays | On come-out | Can be removed |
|---|---|---|---|---|---|---|---|---|
| `pass-line` | Pass Line | Come-out only (puck OFF) | Come-out 7, 11; point before 7 | Come-out 2, 3, 12; 7 before point | — | 1:1 | n/a (it *is* the come-out bet) | Before a point is set only; contract afterwards |
| `dont-pass` | Don't Pass | Come-out only | Come-out 2, 3; 7 before point | Come-out 7, 11; point before 7 | Come-out 12 | 1:1 | n/a | Yes, any time (not recommended after a point) |
| `come` | Come | Puck ON | Next roll 7, 11; or its number before 7 | Next roll 2, 3, 12; or 7 before its number | — | 1:1 | Flat bet on a number stays working | No, once moved to a number (contract) |
| `dont-come` | Don't Come | Puck ON | Next roll 2, 3; or 7 before its number | Next roll 7, 11; or its number before 7 | Next roll 12 | 1:1 | Working | Yes, after it moves (not recommended) |
| `pass-odds` | Pass Odds (take) | Puck ON, behind `pass-line` | Point before 7 | 7 | — | 4/10 2:1 · 5/9 3:2 · 6/8 6:5 | n/a (resolved with the pass bet) | Yes, any time |
| `dont-pass-odds` | Don't Pass Odds (lay) | Puck ON, behind `dont-pass` | 7 before point | Point | — | 4/10 1:2 · 5/9 2:3 · 6/8 5:6 | n/a | Yes, any time |
| `come-odds` | Come Odds (take) | Once a `come` has moved to a number | Number before 7 | 7 | Returned if the flat bet resolves on a come-out while odds are OFF | as `pass-odds` | **OFF** by default (toggle) | Yes, any time |
| `dont-come-odds` | Don't Come Odds (lay) | Once a `dont-come` has moved | 7 before number | Number | — | as `dont-pass-odds` | Working | Yes, any time |
| `place-4`, `place-10` | Place 4 / 10 | Any roll | Number before 7 | 7 | — | 9:5 | **OFF** by default | Yes; can also be pressed or turned off |
| `place-5`, `place-9` | Place 5 / 9 | Any roll | Number before 7 | 7 | — | 7:5 | **OFF** by default | Yes |
| `place-6`, `place-8` | Place 6 / 8 | Any roll | Number before 7 | 7 | — | 7:6 | **OFF** by default | Yes |
| `buy-4` … `buy-10` | Buy 4, 5, 6, 8, 9, 10 | Any roll | Number before 7 | 7 | — | True odds (2:1, 3:2, 6:5) **less 5% of the bet, on win** | **OFF** by default | Yes (no vig charged) |
| `lay-4` … `lay-10` | Lay 4, 5, 6, 8, 9, 10 | Any roll | 7 before number | Number | — | True odds (1:2, 2:3, 5:6) **less 5% of the win, on win** | **Working** | Yes |
| `field` | Field | Any roll | 3, 4, 9, 10, 11 (1:1); 2 (2:1); 12 (2:1, or 3:1 under `vegas-3x-field`) | 5, 6, 7, 8 | — | see Wins | One-roll, always working | n/a (one roll) |
| `big-6`, `big-8` | Big 6 / Big 8 | Any roll | Number before 7 | 7 | — | 1:1 | Working | Yes |
| `hard-4`, `hard-10` | Hard 4 / 10 | Any roll | 2-2 / 5-5 before 7 or easy way | 7, or easy 4/10 | — | 7:1 | **OFF** by default | Yes |
| `hard-6`, `hard-8` | Hard 6 / 8 | Any roll | 3-3 / 4-4 before 7 or easy way | 7, or easy 6/8 | — | 9:1 | **OFF** by default | Yes |
| `any-7` | Any 7 (Big Red) | Any roll | 7 | anything else | — | 4:1 | One-roll | n/a |
| `any-craps` | Any Craps | Any roll | 2, 3, 12 | anything else | — | 7:1 | One-roll | n/a |
| `aces` | Aces / Snake Eyes (2) | Any roll | 2 | other | — | 30:1 | One-roll | n/a |
| `ace-deuce` | Ace-Deuce (3) | Any roll | 3 | other | — | 15:1 | One-roll | n/a |
| `yo-11` | Yo (11) | Any roll | 11 | other | — | 15:1 | One-roll | n/a |
| `boxcars` | Boxcars / Midnight (12) | Any roll | 12 | other | — | 30:1 | One-roll | n/a |
| `horn` | Horn (amount in multiples of 4) | Any roll | 2, 3, 11, 12: the winning quarter is paid as its own prop, the other three quarters lose | other | — | 2/12: net +27 per 4 units; 3/11: net +12 per 4 units | One-roll | n/a |
| `c-e` | Craps & Eleven (multiples of 2) | Any roll | 2, 3, 12 (net 3:1 on the whole bet); 11 (net 7:1) | other | — | as Wins | One-roll | n/a |
| `world` | World / Whirl (multiples of 5) | Any roll | 2/12: net +26 per 5 units; 3/11: net +11 per 5 | 4, 5, 6, 8, 9, 10 | 7 (the any-7 unit's win covers the four losing units) | as Wins | One-roll | n/a |
| `hop` | Hop bet (param `hop: [a,b]`, normalized low-high) | Any roll | That exact pair (either order) | other | — | Easy (a≠b) 15:1; hard (a=b) 30:1 | One-roll | n/a |

Instances: a `come`/`dont-come` that has moved carries `number`. Odds bets carry `number`. A Horn, C&E or World bet is one bet object in the simulator; it is paid as a combined net result.

Limits (`vegas-default`): `pass-odds` and `come-odds` ≤ 3× the flat bet on 4/10, 4× on 5/9 and 5× on 6/8. `dont-pass-odds` and `dont-come-odds` ≤ 6× the flat bet on any point. The simulator pays exact fractions and **suggests** proper units (place 6/8 in $6; place 4/5/9/10 in $5; odds on 5/9 in even amounts; odds on 6/8 in $5; lay 4/10 in $2, lay 5/9 in $3, lay 6/8 in $6), with a tip explaining that real casinos round payouts down.

Not supported in v1 (lessons mention them only): `fire-bet`, `all-tall-small`, put bets, `horn-high-*`, crapless craps.

### 5.2 Math: probabilities and edges

P(win) / P(lose) / P(push) are **per resolution** (per bet made).

| id | P(win) | P(lose) | P(push) | Edge per bet | Edge per roll | EV per $1 |
|---|---|---|---|---|---|---|
| `pass-line`, `come` | 244/495 = 49.29% | 251/495 = 50.71% | 0 | **1.414%** | 0.419% | −0.01414 |
| `dont-pass`, `dont-come` | 949/1980 = 47.93% | 976/1980 = 49.29% | 1/36 = 2.78% | **1.364%** (1.403% excluding pushes) | 0.404% | −0.01364 |
| `pass-odds`, `come-odds` on 4/10 | 1/3 | 2/3 | 0 | 0% | 0% | 0 |
| … on 5/9 | 2/5 | 3/5 | 0 | 0% | 0% | 0 |
| … on 6/8 | 5/11 | 6/11 | 0 | 0% | 0% | 0 |
| `dont-pass-odds`, `dont-come-odds` vs 4/10 | 2/3 | 1/3 | 0 | 0% | 0% | 0 |
| … vs 5/9 | 3/5 | 2/5 | 0 | 0% | 0% | 0 |
| … vs 6/8 | 6/11 | 5/11 | 0 | 0% | 0% | 0 |
| `place-6`, `place-8` | 5/11 = 45.45% | 6/11 | 0 | **1.515%** | 0.463% | −0.01515 |
| `place-5`, `place-9` | 2/5 = 40% | 3/5 | 0 | 4.000% | 1.111% | −0.04000 |
| `place-4`, `place-10` | 1/3 = 33.3% | 2/3 | 0 | 6.667% | 1.667% | −0.06667 |
| `buy-4`, `buy-10` | 1/3 | 2/3 | 0 | **1.667%** | 0.417% | −0.01667 |
| `buy-5`, `buy-9` | 2/5 | 3/5 | 0 | 2.000% | 0.556% | −0.02000 |
| `buy-6`, `buy-8` | 5/11 | 6/11 | 0 | 2.273% | 0.694% | −0.02273 |
| `lay-4`, `lay-10` | 2/3 | 1/3 | 0 | **1.667%** | 0.417% | −0.01667 |
| `lay-5`, `lay-9` | 3/5 | 2/5 | 0 | 2.000% | 0.556% | −0.02000 |
| `lay-6`, `lay-8` | 6/11 | 5/11 | 0 | 2.273% | 0.694% | −0.02273 |
| `field` (2:1 on 12) | 16/36 = 44.44% | 20/36 | 0 | 5.556% | 5.556% | −0.05556 |
| `field` (3:1 on 12, variant) | 16/36 | 20/36 | 0 | 2.778% | 2.778% | −0.02778 |
| `big-6`, `big-8` | 5/11 | 6/11 | 0 | 9.091% | 2.778% | −0.09091 |
| `hard-6`, `hard-8` | 1/11 = 9.09% | 10/11 | 0 | 9.091% | 2.778% | −0.09091 |
| `hard-4`, `hard-10` | 1/9 = 11.1% | 8/9 | 0 | 11.111% | 2.778% | −0.11111 |
| `any-7` | 6/36 | 30/36 | 0 | **16.667%** | 16.667% | −0.16667 |
| `any-craps` | 4/36 | 32/36 | 0 | 11.111% | 11.111% | −0.11111 |
| `aces`, `boxcars` | 1/36 | 35/36 | 0 | 13.889% | 13.889% | −0.13889 |
| `ace-deuce`, `yo-11` | 2/36 | 34/36 | 0 | 11.111% | 11.111% | −0.11111 |
| `horn` | 6/36 | 30/36 | 0 | 12.500% | 12.500% | −0.12500 |
| `c-e` | 6/36 | 30/36 | 0 | 11.111% | 11.111% | −0.11111 |
| `world` | 6/36 | 24/36 | 6/36 | 13.333% | 13.333% | −0.13333 |
| `hop` easy | 2/36 | 34/36 | 0 | 11.111% | 11.111% | −0.11111 |
| `hop` hard | 1/36 | 35/36 | 0 | 13.889% | 13.889% | −0.13889 |

Variant (`buy-vig-upfront`): every buy bet is 4.762% (the base is bet + vig). Lay vig up front: 4/10 2.439%, 5/9 3.226%, 6/8 4.000%.

### 5.3 Combinations (edge per dollar of total action)

| Combination | Edge |
|---|---|
| `pass-line` + `pass-odds` at 1× / 2× / 3-4-5× / 10× / 100× | 0.848% / 0.606% / **0.374%** / 0.184% / 0.0209% |
| `dont-pass` + lay odds winning 1× / 2× / 10× / 100× the flat bet | 0.682% / 0.455% / 0.124% / 0.0135% |
| `dont-pass` + lay 6× (3-4-5x table) | **0.273%** |
| Iron Cross ($5 field, $5 place-5, $6 place-6, $6 place-8) | ≈ 1.77% per roll of the $22 in action |

Useful constants: average rolls per line decision = 557/165 ≈ 3.376. Share of rolls in the point phase = 392/557 ≈ 70.4%. Average rolls per shooter (come-out to seven-out) = 1671/196 ≈ 8.53. Come-out: natural 8/36, craps 4/36, point 24/36.

### 5.4 Exact fractions for unit tests

```
pass win 244/495, lose 251/495, EV −7/495
dont-pass win 949/1980, lose 976/1980, push 55/1980, EV −27/1980 = −3/220
odds EV 0 (all points)
pass + 3-4-5x edge = (7/495)/(1+25/9) = 7/1870 ≈ 0.003743
dont + 6x lay edge = (3/220)/5 = 3/1100 ≈ 0.002727
place-6 −1/66; place-5 −1/25; place-4 −1/15
buy-4 −1/60; buy-5 −1/50; buy-6 −1/44   (vig 5% of bet, on win)
lay-4 −1/60; lay-5 −1/50; lay-6 −1/44   (vig 5% of win, on win)
field −1/18 (2:1/2:1); −1/36 (2:1/3:1)
big-6 −1/11; hard-6 −1/11; hard-4 −1/9
any-7 −1/6; any-craps −1/9; aces −5/36; yo-11 −1/9; horn −1/8; c-e −1/9; world −2/15
per-roll: pass −7/495 × 165/557 = −7/1671; place-6 −1/66 × 11/36 = −1/216; hardways −1/36
```

---

## 6. How EV is shown in the simulator

Learner-facing copy is in quotation marks; the rest is guidance for implementers.

### 6.1 The EV panel (shown when a chip is dragged over a bet, or a placed bet is tapped)

Show four lines, then the tier and a suggestion:

1. **House edge**: "House edge **1.52%**: on average you lose 1.52¢ of every $1 you bet here."
2. **Expected loss for this bet**: "Expected loss on this $12 bet: **$0.18**." (amount × edge per bet. Under 1¢, show "less than 1¢". Odds show "**$0.00: a free bet**".)
3. **Per hour if you leave it up**: "If you keep this bet up for an hour (~100 rolls): about **$3.91**." (amount × per-roll edge × 100, × 392/557 for bets that are off on come-outs.) This line is how one-roll bets get exposed.
4. **Your chance**: "Wins **5 in 11** (45%) · pays **7 to 6**." For one-roll bets: "Wins **1 in 6** rolls · pays **4 to 1**."

When a line bet has odds, show the **combined** figure as well: "Pass + Odds together: **0.37%** per dollar."

### 6.2 Tiers (by edge per bet)

| Tier | Edge | Colour / label | Bets |
|---|---|---|---|
| Best | 0% | Blue "**Free bet**" | All odds |
| Good | ≤ 2.0% | Green "**Good bet**" | Pass, Don't Pass, Come, Don't Come, Place 6/8, Buy 4/10, Lay 4/10, Buy/Lay 5/9 |
| Fair | > 2.0% and ≤ 5% | Yellow "**Fair**" | Buy/Lay 6/8, Place 5/9, Field 3:1 variant, up-front-vig buys/lays |
| Poor | > 5% and < 9% | Orange "**Costly**" | Place 4/10, Field (2:1/2:1) |
| Avoid | ≥ 9% | Red "**Sucker bet**" | Big 6/8, all hardways, all one-roll props, Horn, C&E, World, hop bets |

One extra rule: any **one-roll** bet gets the per-hour line in bold, plus the note "One-roll bet: its edge is paid on every roll."

In **sandbox** mode every bet is allowed. Red bets need a second tap to confirm ("Place anyway"), unless the learner has turned that off in Settings. Orange bets show the suggestion without blocking.

### 6.3 "Better alternative" suggestions

Shown for Fair, Poor and Avoid tiers, and for line bets without odds. Each suggestion names the bet, its edge, and the saving on the same amount.

| If the learner chooses… | Suggest | Copy |
|---|---|---|
| `place-4`/`place-10` | `buy-4`/`buy-10` | "**Buy the 4** instead: same bet, 1.67% instead of 6.67%." |
| `buy-6`/`buy-8`, `big-6`/`big-8`, `hard-6`/`hard-8` | `place-6`/`place-8` | "**Place the 6** wins on the same number at 1.52%." |
| `hard-4`/`hard-10` | `buy-4`/`buy-10` | "**Buy the 4**: wins on any 4 before 7, at 1.67%." |
| `place-5`/`place-9` | `come` + odds (or `buy-5`) | "A **Come bet with odds** gets you on a number at under 0.4%." |
| `field` | `pass-line` / `come` | "**Pass Line**: 1.41% per bet, and 13× cheaper per roll." |
| `any-7` | `dont-come` or `lay-4` | "Rooting for a 7? **Don't Come** pays off on 7 at 1.36%." |
| `any-craps`, `c-e`, `aces`, `ace-deuce`, `yo-11`, `boxcars`, `horn`, `world`, `hop` | `come` + odds | "Props cost 11–14%. A **Come bet with odds** costs under 0.4%." |
| `lay-6`/`lay-8`, `lay-5`/`lay-9` | `dont-come` + lay odds | "**Don't Come with lay odds**: 0.27% overall." |
| `pass-line`/`come` with no odds after a point | add `pass-odds`/`come-odds` | "Add **odds**: 0% edge. Your combined edge drops toward 0.37%." |
| `dont-pass`/`dont-come` removal after a point | keep it | "This bet is now the favourite. Taking it down gives up your edge." |

### 6.4 Session panel

Always reachable from the table. It shows:

* "**Total bet**: $1,240 · **Expected loss**: $5.10 · **Actual**: −$35.00"
* "**Luck**: −$29.90" (actual − expected), so the learner sees that results are mostly luck in the short run.
* "**Your edge per dollar**: 0.41%" (expected loss ÷ total bet) with its tier colour.
* A per-bet breakdown (bet, total bet, expected, actual).
* In auto-roll runs: a chart of the running result, with the expected-loss line drawn as a dashed slope.

### 6.5 Wording rules

* Say "**expected loss**" and "**on average**". Avoid "you will lose".
* Don't round any edge to "0%" unless it really is zero. Show at least two decimals (1.41%, 0.37%).
* Show money to the cent; show percentages to two decimals (three in the reference screens).
* Use "pays 7 to 6". Never use "for" payouts in the default rules.
* Never present any strategy as able to win in the long run.

---

## 7. Verification notes and sources

* **Every figure in this document was computed exactly** (rational arithmetic) in a verification script during this spike: per-bet probabilities and EVs, per-roll edges via expected resolution times, combined odds edges, and Fire Bet / All-Tall-Small edges by Markov recursion over sets of points or numbers. Hourly swings, risk-of-ruin and the 3-point Molly cost come from Monte Carlo runs: 20,000–100,000 simulated 100-roll hours, plus 3 million rolls for the Molly. They're labelled "about" in the lessons. The app's test suite should check the section 5.4 fractions directly against its EV engine.
* The values agree with the standard published figures (Wizard of Odds' craps appendix, casino rack cards and the common strategy guides): Pass 1.41%, Don't Pass 1.36%, Place 6/8 1.52%, 5/9 4.00%, 4/10 6.67%, Buy/Lay 4/10 1.67% with vig on win, Lay 4/10 2.44% with vig up front, Field 5.56% / 2.78%, Hard 6/8 9.09%, Hard 4/10 11.11%, Any 7 16.67%, Horn 12.5%, World 13.33%, Pass + 3-4-5x 0.374%, Don't + 6× 0.273%. The figures quoted for Fire Bet (≈20.8%, 24/249/999 paytable) and All/Tall/Small (≈7.5–7.8%, 34/34/175 paytable) depend on the paytable; other paytables differ.
* The "100 rolls per hour" pace is an assumption; real tables range from about 60 to 130+. The simulator should let the user change it (Settings → Rolls per hour), and every per-hour figure scales linearly.
* Teaching sequence: it follows the order used by casino free lessons and beginner guides (dice odds → layout → come-out/point → Pass → odds → Come → Place → Don't → props), then adds the EV, variance and strategy chapters that casino lessons leave out.
