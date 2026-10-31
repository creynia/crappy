import { Link } from '../components/Link';

export function More() {
  return (
    <div class="page">
      <h1>More</h1>
      <div class="grid">
        <Link to="/practice" class="card tile">
          <strong>Practice</strong>
          <span class="muted">Quick drills with scores</span>
        </Link>
        <Link to="/glossary" class="card tile">
          <strong>Glossary</strong>
          <span class="muted">Craps words, explained</span>
        </Link>
        <Link to="/sources" class="card tile">
          <strong>Sources</strong>
          <span class="muted">Where the rules, figures and strategies come from</span>
        </Link>
        <Link to="/settings" class="card tile">
          <strong>Settings</strong>
          <span class="muted">Theme, speed, progress</span>
        </Link>
      </div>
    </div>
  );
}
