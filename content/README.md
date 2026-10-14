# content/

Lesson sources for crappy. Everything is plain text and checked by `tests/content/`.

- `lessons/NN-slug.md`: one lesson. YAML frontmatter (`id`, `title`, `chapter`, `summary`, `minutes`), then a Markdown body.
- `chapters.json`: ordered chapters, each `{ id, title, summary, lessons: [lessonId] }`.
- `glossary.json`: `[{ term, definition, seeAlso?: lessonId }]`.

Body extras:

- `:::math Title` ... `:::` is a collapsed "Show the math" box. `:::tip` ... `:::` is a callout.
- A fenced `scene` block holds YAML in the `SceneConfig` shape of `docs/design/simulator.md` section 4.1. Money is in cents, bet ids are the engine ids, rules are preset ids such as `standard-vegas`. Steps use `completeWhen` conditions.
- A fenced `quiz` block is a YAML list of `{ id?, q, options, answer, explain }` with a 0-based `answer`. The default id is `<lessonId>-q<n>`.

See `docs/authoring.md` (written by the app agent) for the full guide.
