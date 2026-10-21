import type { ComponentChildren } from 'preact';
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

export function Shell(props: { path: string; children: ComponentChildren }) {
  return (
    <div class="shell">
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
