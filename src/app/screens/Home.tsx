import { Link } from '../components/Link';
import { ProgressRing } from '../components/ProgressRing';
import { useContent, useStore } from '../context';
import { hasPerfectStrategyBadge, nextLesson, overallProgress } from '../store';

export function Home() {
  const content = useContent();
  const store = useStore();
  const next = nextLesson(content, store);
  const nextL = content.lessons.find((l) => l.id === next);
  const { done, total } = overallProgress(content, store);
  const badge = hasPerfectStrategyBadge(content, store);
  const started = done > 0 || content.lessons.some((l) => store.status(l.id) === 'progress');
  return (
    <div class="page">
      <section class="hero">
        <ProgressRing done={done} total={total} />
        <div>
          <h1>Learn craps</h1>
          <p class="muted">Lessons, odds and a practice table. Nothing here costs real money.</p>
        </div>
      </section>
      {badge && (
        <p class="card badge-card">
          <span class="badge tier-fair">Perfect Strategy</span> You passed the final exam with 80%
          or better.
        </p>
      )}
      {nextL ? (
        <Link to={`/learn/${nextL.id}`} class="btn btn-big">
          {started ? 'Continue' : 'Start'}: {nextL.title}
        </Link>
      ) : total > 0 ? (
        <p class="card">All lessons complete. Nicely done. Head to the practice table.</p>
      ) : (
        <p class="card">No lessons yet.</p>
      )}
      <div class="grid">
        <Link to="/learn" class="card tile">
          <strong>Learn</strong>
          <span class="muted">All lessons, by chapter</span>
        </Link>
        <Link to="/play" class="card tile">
          <strong>Play</strong>
          <span class="muted">Free-play practice table</span>
        </Link>
        <Link to="/bets" class="card tile">
          <strong>Bets</strong>
          <span class="muted">House edge for every bet</span>
        </Link>
        <Link to="/glossary" class="card tile">
          <strong>Glossary</strong>
          <span class="muted">Craps words, explained</span>
        </Link>
      </div>
    </div>
  );
}
