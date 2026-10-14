import { useState } from 'preact/hooks';
import { Link } from '../components/Link';
import { TierBadge } from '../components/TierBadge';
import { Html } from '../components/Html';
import { betRows, formatEdge, betLabel, betPayout, houseEdge, tierOf } from '../bets';
import type { BetRow } from '../bets';
import { useContent } from '../context';
import { NotFound } from './NotFound';
import { isBetTypeId } from '../../sim';
import { TIER_LABEL, TIERS } from '../../content/types';
import type { Tier } from '../../content/types';

export function BetsList() {
  const content = useContent();
  const [sort, setSort] = useState<'edge' | 'name'>('edge');
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const rows = betRows(content.bets).filter((r) => tier === 'all' || r.tier === tier);
  const order = (r: BetRow) => r.edge ?? TIERS.indexOf(r.tier) * 0.03;
  rows.sort(
    sort === 'edge' ? (a, b) => order(a) - order(b) : (a, b) => a.label.localeCompare(b.label),
  );
  return (
    <div class="page">
      <h1>Bets</h1>
      <p class="muted">
        House edge is the average share of each bet the casino keeps. Standard Vegas rules, shown at
        a typical bet size.
      </p>
      <div class="filters">
        <label>
          Sort{' '}
          <select value={sort} onChange={(e) => setSort(e.currentTarget.value as 'edge' | 'name')}>
            <option value="edge">Lowest edge first</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Show{' '}
          <select value={tier} onChange={(e) => setTier(e.currentTarget.value as Tier | 'all')}>
            <option value="all">All bets</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="table-wrap">
        <table class="bets">
          <thead>
            <tr>
              <th>Bet</th>
              <th>Pays</th>
              <th class="num">Edge</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/bets/${r.id}`}>{r.label}</Link>
                </td>
                <td>{r.payout ?? '--'}</td>
                <td class="num">{formatEdge(r.edge)}</td>
                <td>
                  <TierBadge tier={r.tier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BetDetail({ id }: { id: string }) {
  const content = useContent();
  if (!isBetTypeId(id)) return <NotFound what="That bet" />;
  const copy = content.bets[id];
  const edge = houseEdge(id);
  const tier = edge !== null ? tierOf(edge) : (copy?.verdict ?? 'fair');
  const lesson = copy?.lessonId ? content.lessons.find((l) => l.id === copy.lessonId) : undefined;
  return (
    <div class="page">
      <Link to="/bets" class="back">
        {'←'} All bets
      </Link>
      <h1>{betLabel(id)}</h1>
      <p>
        <TierBadge tier={tier} />
      </p>
      <dl class="facts">
        <div>
          <dt>Pays</dt>
          <dd>{betPayout(id) ?? '--'}</dd>
        </div>
        <div>
          <dt>House edge</dt>
          <dd>{formatEdge(edge)}</dd>
        </div>
      </dl>
      {copy ? (
        <>
          <p class="lead">{copy.summary}</p>
          <Html html={copy.howItWorks} />
        </>
      ) : (
        <p class="muted">No description yet.</p>
      )}
      <div class="row">
        <Link to={`/play?preset=${id}`} class="btn">
          Try it at the table
        </Link>
        {lesson && (
          <Link to={`/learn/${lesson.id}`} class="btn btn-ghost">
            Lesson: {lesson.title}
          </Link>
        )}
      </div>
    </div>
  );
}
