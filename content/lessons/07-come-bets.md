---
id: come-bets
title: "Come bets: more points, same deal"
chapter: core-game
summary: A Come bet is a Pass bet you can make on any roll. Watch it travel to a number and add odds.
minutes: 8
---

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

```scene
id: l07-s1
version: 1
title: A Come bet travels
bankroll: 50000
phase: point
point: 6
bets:
  - { ref: p, type: pass-line, amount: 1000 }
  - { type: pass-odds, amount: 5000, parentRef: p }
forcedDice: [[5, 4], [3, 6], [2, 3]]
allowedBets: [come, come-odds]
highlightedBets: [come]
showEV: true
evDetail: basic
ui:
  compact: true
steps:
  - id: come
    text: "The point is 6. Put **$10** in the **Come** area."
    completeWhen: { action: { type: place-bet, betType: come, amount: 1000 } }
  - id: travel
    text: "Roll: 9. Your Come bet moves to the 9 box."
    completeWhen: { event: bet-travelled }
  - id: odds
    text: "Add **$40 odds** on your Come bet (tap it on the 9 box, then Odds)."
    completeWhen: { action: { type: place-bet, betType: come-odds, amount: 4000 } }
  - id: win
    text: "Roll: 9! Your Come bet wins $10 and its odds win $60. Your Pass bet on 6 is still riding."
    completeWhen: { event: bet-won, betType: come }
  - id: five
    text: "Roll: 5. Nothing happens to any of your bets."
    completeWhen: { rolls: 1 }
```

```scene
id: l07-s2
version: 1
title: Odds are off on the come-out
bankroll: 50000
phase: come-out
bets:
  - { ref: c, type: come, amount: 1000, point: 8 }
  - { type: come-odds, amount: 5000, parentRef: c }
forcedDice: [[3, 4]]
allowedBets: []
allowedActions: [roll]
showEV: false
ui:
  compact: true
steps:
  - id: look
    text: "It's a come-out roll. Your Come bet on 8 has an **OFF** marker on its odds."
    completeWhen: { acknowledged: true }
    advance: button
  - id: seven
    text: "Roll: 7. The $10 Come bet loses, but your $50 odds come back to you."
    completeWhen: { event: bet-returned }
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
