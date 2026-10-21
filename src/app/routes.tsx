import type { VNode } from 'preact';
import { matchPath } from './router';
import type { ParsedHash } from './router';
import { BetDetail, BetsList } from './screens/Bets';
import { Challenge } from './screens/Challenge';
import { Glossary } from './screens/Glossary';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { LessonView } from './screens/Lesson';
import { More } from './screens/More';
import { NotFound } from './screens/NotFound';
import { Play } from './screens/Play';
import { DrillView, PracticeHub } from './screens/Practice';
import { Settings } from './screens/Settings';

type Render = (p: Record<string, string>, r: ParsedHash) => VNode;

export const ROUTES: { pattern: string; render: Render }[] = [
  { pattern: '/', render: () => <Home /> },
  { pattern: '/learn', render: () => <Learn /> },
  { pattern: '/learn/:lessonId', render: (p) => <LessonView id={p.lessonId!} /> },
  { pattern: '/play', render: (_p, r) => <Play query={r.query} /> },
  { pattern: '/practice', render: () => <PracticeHub /> },
  {
    pattern: '/practice/:drillId',
    render: (p, r) => <DrillView id={p.drillId!} query={r.query} />,
  },
  { pattern: '/challenge', render: (_p, r) => <Challenge query={r.query} /> },
  { pattern: '/bets', render: () => <BetsList /> },
  { pattern: '/bets/:betId', render: (p) => <BetDetail id={p.betId!} /> },
  { pattern: '/glossary', render: (_p, r) => <Glossary query={r.query} /> },
  { pattern: '/settings', render: () => <Settings /> },
  { pattern: '/more', render: () => <More /> },
];

export function renderRoute(route: ParsedHash): VNode {
  for (const r of ROUTES) {
    const params = matchPath(r.pattern, route.path);
    if (params) return r.render(params, route);
  }
  return <NotFound />;
}
