---
id: table-tour
title: A tour of the table
chapter: foundations
summary: Learn the layout, the crew and the puck, so the table stops looking like a maze.
minutes: 5
---

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

This is a finding game. Tap each area when asked, and read the short note that pops up. No chips are placed.

```scene
id: l02-s1
version: 1
title: Find the bets
bankroll: 0
allowedBets: all
allowedActions: []
showEV: false
ui:
  compact: true
  showChipRack: false
  showBankroll: false
steps:
  - id: pass-line
    text: "Tap the **Pass Line**."
    completeWhen: { previewed: pass-line }
  - id: dont-pass
    text: "Tap the **Don't Pass Bar**."
    callouts:
      - { target: dont-pass, text: "Bets against the shooter." }
    completeWhen: { previewed: dont-pass }
  - id: come
    text: "Tap the **Come** area."
    completeWhen: { previewed: come }
  - id: field
    text: "Tap the **Field**."
    callouts:
      - { target: field, text: "One roll: 2-4 or 9-12 wins." }
    completeWhen: { previewed: field }
  - id: six
    text: "Tap the **6** number box."
    callouts:
      - { target: box-6, text: "Place bets on the 6 go here.", placement: below }
    completeWhen: { previewed: place-6 }
  - id: center
    text: "Tap any bet in the **center**. Those are the proposition bets."
    completeWhen:
      any:
        - { previewed: any-7 }
        - { previewed: any-craps }
        - { previewed: yo-11 }
        - { previewed: aces-2 }
        - { previewed: boxcars-12 }
        - { previewed: ace-deuce-3 }
        - { previewed: horn }
        - { previewed: c-e }
        - { previewed: world }
        - { previewed: hard-4 }
        - { previewed: hard-6 }
        - { previewed: hard-8 }
        - { previewed: hard-10 }
```

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
