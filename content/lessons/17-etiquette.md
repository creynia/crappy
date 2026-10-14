---
id: etiquette
title: "Playing at a real table"
chapter: real-casino
summary: How to buy in, call bets, shoot, tip and behave at a live craps table.
minutes: 6
---

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

**Tipping ("toking").** Dealers rely on tips. The craps way is to **bet for them**: "a $1 Yo for the dealers", or a small Pass Line bet "for the boys". Tipping isn't required, but it's customary when you win. If you want your tip to last, a line bet with odds for the dealers costs you far less than a prop bet in expected loss.

:::tip
Ask questions during a slow moment. Dealers are paid to help, and quiet tables are the best place to learn.
:::

Try the same moves on the simulator. You place the odds yourself, and you ask for the rest in the right units.

```scene
id: l17-s1
version: 1
title: Bets in the right units
rules: standard-vegas
bankroll: 30000
phase: point
point: 6
bets:
  - { type: pass-line, amount: 1000 }
allowedBets: [pass-odds, place-8, hard-8]
steps:
  - id: odds
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Odds are yours to place. Add the **maximum odds** behind your Pass Line."
    highlightedBets: [pass-odds]
    allowedBets: [pass-odds]
    completeWhen: { action: { type: place-bet, betType: pass-odds, oddsMax: true } }
  - id: short-pay
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Tap the **8** and try a $5 chip. Read the note: $5 on the 8 pays $5.83 here, and most casinos pay $5. Don't confirm."
    highlightedBets: [place-8]
    allowedBets: [place-8]
    completeWhen: { previewed: place-8 }
    advance: button
  - id: place-8
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Say it like a pro: **\"$6, place the 8.\"** Place $6 on the 8."
    highlightedBets: [place-8]
    allowedBets: [place-8]
    completeWhen: { action: { type: place-bet, betType: place-8, amount: 600 } }
  - id: hard-8
    allowedActions: [place-bet, set-amount, remove-bet]
    text: "Now **\"$1 hard 8.\"** Place $1 on the Hard 8."
    highlightedBets: [hard-8]
    allowedBets: [hard-8]
    completeWhen: { action: { type: place-bet, betType: hard-8, amount: 100 } }
  - id: roll
    text: "Roll once and watch how the dealer pays."
    allowedActions: [roll]
    completeWhen: { rolls: 1 }
```

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
