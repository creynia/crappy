---
id: sample-pass-line
title: The Pass Line (sample)
summary: Placeholder lesson with a scene and one quiz.
minutes: 4
---

The Pass Line wins on a 7 or 11 at the come-out, loses on 2, 3 or 12, and otherwise sets the point.

```scene
id: sample-pass
version: 1
title: Bet the Pass Line
bankroll: 50000
allowedBets: [pass-line]
highlightedBets: [pass-line]
```

```quiz
- id: sample-pass-q
  q: On the come-out you roll a 7. What happens to a Pass Line bet?
  options: ["It wins", "It loses", "Nothing"]
  answer: 0
  explain: "A 7 or 11 on the come-out is a natural, so the Pass Line wins."
```
