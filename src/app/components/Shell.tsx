import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Link } from './Link';

const TABS = [
  { to: '/', label: 'Home', icon: '⌂', match: (p: string) => p === '/' },
  { to: '/learn', label: 'Learn', icon: '♠', match: (p: string) => p.startsWith('/learn') },
  { to: '/play', label: 'Play', icon: '⚅', match: (p: string) => p.startsWith('/play') },
  { to: '/bets', label: 'Bets', icon: '$', match: (p: string) => p.startsWith('/bets') },
  {
    to: '/more',
    label: 'More',
    icon: '≡',
    match: (p: string) => /^\/(more|glossary|settings|practice)/.test(p),
  },
];

/** Pages that give the whole short landscape screen to their content (see .is-immersive in app.css). */
const immersive = (p: string) => p.startsWith('/play');

export function Shell(props: { path: string; children: ComponentChildren }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // the menu closes on navigation and on Escape
  useEffect(() => setMenuOpen(false), [props.path]);
  useEffect(() => {
    if (!menuOpen) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [menuOpen]);
  return (
    <div class={`shell${immersive(props.path) ? ' is-immersive' : ''}`}>
      {immersive(props.path) ? (
        <>
          <button
            type="button"
            class="immersive-menu"
            aria-label="Pages"
            aria-expanded={menuOpen}
            aria-controls="immersive-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span aria-hidden="true">{menuOpen ? '×' : '≡'}</span>
          </button>
          <nav
            id="immersive-nav"
            class={`immersive-nav${menuOpen ? ' is-open' : ''}`}
            aria-label="Pages menu"
          >
            {TABS.map((t) => (
              <Link key={t.to} to={t.to} aria-current={t.match(props.path) ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
      <header class="topbar">
        <Link to="/" class="brand">
          crappy
        </Link>
        <nav class="topnav" aria-label="Main">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} aria-current={t.match(props.path) ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {props.children}
      </main>
      <nav class="tabbar" aria-label="Tabs">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} aria-current={t.match(props.path) ? 'page' : undefined}>
            <span class="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
