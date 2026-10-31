import { Link } from '../components/Link';
import { useContent } from '../context';
import type { LessonSource } from '../../content/types';

/** One source line: linked title, author, and what it was used for. */
export function SourceEntry({ s }: { s: LessonSource }) {
  return (
    <>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer">
          {s.title}
        </a>
      ) : (
        <span>{s.title}</span>
      )}
      {s.author ? <span class="muted">, {s.author}</span> : null}
      {s.note ? <span class="muted"> — {s.note}</span> : null}
    </>
  );
}

export function Sources() {
  const { sources } = useContent();
  return (
    <div class="page sources">
      <Link to="/more" class="back">
        {'←'} More
      </Link>
      <h1>Sources</h1>
      <p class="muted">
        Every figure in this app is computed by the app itself, in exact arithmetic or exhaustive
        enumeration, and cross-checked against the published references below. The rules and
        strategies are the standard ones; these are the places they&rsquo;re documented.
      </p>
      {sources.map((g) => (
        <section key={g.group}>
          <h2>{g.group}</h2>
          <ul class="source-list">
            {g.items.map((it) => (
              <li key={it.id} id={`source-${it.id}`}>
                <SourceEntry s={it} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
