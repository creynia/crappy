import { useEffect, useRef, useState } from 'preact/hooks';
import { DieIcon } from '../../sim';
import { Link } from '../components/Link';
import { useStore } from '../context';
import { DRILLS, getDrill } from '../practice/drills';
import { ItemView } from '../practice/ItemView';
import { deriveSeed, randomSeed } from '../practice/rng';
import {
  answerRound,
  clampLevel,
  createRound,
  isRoundDone,
  missedEntries,
  nextItem,
  type Round,
} from '../practice/round';
import type { AnyDrill } from '../practice/types';
import { NotFound } from './NotFound';
import '../practice/practice.css';

export function PracticeHub() {
  const store = useStore();
  return (
    <div class="page">
      <h1>Practice</h1>
      <p class="muted">
        Short drills, 10 questions a round. Questions you miss come back later in the round and
        again next time.
      </p>
      <ul class="pr-hub">
        {DRILLS.map((d) => {
          const p = store.drill(d.id);
          return (
            <li key={d.id}>
              <Link to={`/practice/${d.id}`} class="card tile pr-drill-card">
                <strong>{d.title}</strong>
                <span class="muted">{d.summary}</span>
                <span class="pr-stats">
                  {p && p.rounds > 0 ? (
                    <>
                      Best {p.best}/10 · Streak {p.streak}
                      {p.review.length > 0 && ` · ${p.review.length} to review`}
                    </>
                  ) : (
                    'Not played yet'
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DrillView(props: { id: string; query: URLSearchParams }) {
  const drill = getDrill(props.id);
  if (!drill) return <NotFound />;
  return <DrillRunner key={drill.id} drill={drill} query={props.query} />;
}

function DrillRunner({ drill, query }: { drill: AnyDrill; query: URLSearchParams }) {
  const store = useStore();
  // ?seed=n makes rounds reproducible (tests, sharing); otherwise random.
  const seedParam = Number.parseInt(query.get('seed') ?? '', 10);
  const baseSeed = useRef(Number.isFinite(seedParam) ? seedParam | 0 : randomSeed());
  const levelParam = Number.parseInt(query.get('level') ?? '', 10);
  const [level, setLevel] = useState(() =>
    clampLevel(
      drill,
      Number.isFinite(levelParam) ? levelParam : (store.drill(drill.id)?.level ?? 1),
    ),
  );
  const roundNo = useRef(0);
  const makeRound = (lvl: number): Round =>
    createRound(drill, {
      seed: deriveSeed(baseSeed.current, roundNo.current++),
      level: lvl,
      review: store.drill(drill.id)?.review ?? [],
    });
  const [round, setRound] = useState<Round>(() => makeRound(level));
  const recorded = useRef(false);

  const promptRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (round.feedback) nextRef.current?.focus();
  }, [round.feedback]);

  const restart = (lvl: number) => {
    recorded.current = false;
    setRound(makeRound(lvl));
  };
  const pickLevel = (lvl: number) => {
    setLevel(lvl);
    store.setPracticeLevel(drill.id, lvl);
    restart(lvl);
  };
  const onAnswer = (answer: unknown) => {
    const r = answerRound(drill, round, answer);
    store.recordPracticeAnswer(drill.id, r.result.ok, r.effects);
    if (r.round.queue.length === 0 && !recorded.current) {
      recorded.current = true;
      store.recordPracticeRound(drill.id, r.round.score, r.round.level);
    }
    setRound(r.round);
  };
  const onNext = () => {
    setRound(nextItem(round));
    requestAnimationFrame(() => promptRef.current?.focus());
  };

  const progress = store.drill(drill.id);
  const shown = round.feedback?.entry ?? round.queue[0];
  const done = isRoundDone(round);
  const position = Math.min(round.total, round.scoredCount + (round.feedback ? 0 : 1));

  return (
    <div class="page">
      <Link to="/practice" class="back">
        ← Practice
      </Link>
      <h1>{drill.title}</h1>
      {drill.levels.length > 1 && (
        <div class="pr-levels" role="radiogroup" aria-label="Level">
          {drill.levels.map((name, i) => (
            <button
              type="button"
              key={name}
              role="radio"
              aria-checked={level === i + 1}
              class={`pr-level${level === i + 1 ? ' is-on' : ''}`}
              onClick={() => level !== i + 1 && pickLevel(i + 1)}
            >
              <span class="pr-level-n">Level {i + 1}</span> {name}
            </button>
          ))}
        </div>
      )}
      <p class="pr-meter" aria-live="off">
        <span>
          Score {round.score}/{round.scoredCount}
        </span>
        <span>Streak {progress?.streak ?? 0}</span>
        <span>Best {progress?.best ?? 0}/10</span>
      </p>

      {done ? (
        <RoundSummary round={round} best={progress?.best ?? 0} onAgain={() => restart(level)} />
      ) : shown ? (
        <section class="card pr-card" aria-labelledby="pr-q">
          <h2 id="pr-q" class="pr-count" tabIndex={-1} ref={promptRef}>
            {shown.scored ? `Question ${position} of ${round.total}` : 'Again: you missed this one'}
            {shown.fromReview && shown.scored && <span class="badge pr-tag">Review</span>}
          </h2>
          <ItemView
            key={`${round.seed}:${round.answered.length - (round.feedback ? 1 : 0)}`}
            drill={drill}
            item={shown.item}
            answered={round.feedback}
            onAnswer={onAnswer}
          />
          {round.feedback && (
            <div class={`pr-feedback ${round.feedback.result.ok ? 'ok' : 'no'}`} role="status">
              <p>
                <strong>{round.feedback.result.ok ? 'Correct.' : 'Not quite.'}</strong>{' '}
                {!round.feedback.result.ok && <>Answer: {round.feedback.result.expected}. </>}
                {round.feedback.result.explain}
              </p>
              <button type="button" class="btn" ref={nextRef} onClick={onNext}>
                {round.queue.length === 0 ? 'See results' : 'Next'}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function RoundSummary(props: { round: Round; best: number; onAgain: () => void }) {
  const { round } = props;
  const missed = missedEntries(round);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <section class="card pr-summary" aria-labelledby="pr-done">
      <h2 id="pr-done" tabIndex={-1} ref={ref}>
        Round complete: {round.score} of {round.total}
      </h2>
      <p class="muted">
        {round.score === round.total
          ? 'A perfect round.'
          : round.score >= props.best
            ? 'Your best round on this drill so far.'
            : `Your best is ${props.best} of ${round.total}.`}{' '}
        Longest streak this round: {round.bestStreak}.
      </p>
      {missed.length > 0 && (
        <>
          <h3>To review</h3>
          <ul class="pr-missed">
            {missed.map((a, i) => (
              <li key={i}>
                {a.entry.item.visuals?.map((v, j) =>
                  v.kind === 'dice' ? (
                    <span key={j} class="pr-mini-dice" aria-label={`${v.dice[0]} and ${v.dice[1]}`}>
                      <DieIcon value={v.dice[0]} size={20} />
                      <DieIcon value={v.dice[1]} size={20} />
                    </span>
                  ) : null,
                )}{' '}
                {a.entry.item.prompt} <strong>{a.result.expected}</strong>
              </li>
            ))}
          </ul>
          <p class="muted">These come back at the start of your next round.</p>
        </>
      )}
      <div class="row">
        <button type="button" class="btn" onClick={props.onAgain}>
          Play again
        </button>
        <Link to="/practice" class="btn btn-ghost">
          All drills
        </Link>
      </div>
    </section>
  );
}
