import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  Simulator,
  bandLabel,
  challengeScene,
  dailySeed,
  emptyTally,
  equity,
  formatScore,
  observeChallenge,
  scoreChallenge,
  RANK_BANDS,
} from '../../sim';
import type {
  ChallengeResult,
  ChallengeTally,
  GameState,
  SceneConfig,
  SimulatorEvent,
} from '../../sim';
import { Link } from '../components/Link';
import { useStore } from '../context';
import { navigate } from '../router';
import { simSettings } from '../simSettings';

type Phase = { kind: 'intro' } | { kind: 'play'; seed: number } | { kind: 'result'; seed: number };

const money = (cents: number, sign = false): string => {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const body = `$${Math.floor(abs / 100).toLocaleString('en-US')}${abs % 100 ? '.' + String(abs % 100).padStart(2, '0') : ''}`;
  return neg ? `-${body}` : sign && abs ? `+${body}` : body;
};

/** CSS tier for a rank band: the better the score, the "freer" the colour. */
const BAND_TIER: Record<string, string> = {
  perfect: 'free',
  sharp: 'good',
  solid: 'fair',
  leaky: 'poor',
  sucker: 'avoid',
  'no-action': 'fair',
};

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! & 0x7fffffff;
  } catch {
    return Math.floor(Math.random() * 0x7fffffff);
  }
}

export function Challenge({ query }: { query: URLSearchParams }) {
  const store = useStore();
  const seedParam = query.get('seed');
  const urlSeed = seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : null;
  const [phase, setPhase] = useState<Phase>(() =>
    urlSeed !== null ? { kind: 'play', seed: urlSeed } : { kind: 'intro' },
  );
  const [rolls, setRolls] = useState(0);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const tally = useRef<ChallengeTally>(emptyTally());
  const scene: SceneConfig | null = useMemo(
    () => (phase.kind === 'play' ? challengeScene({ seed: phase.seed }) : null),
    [phase.kind === 'play' ? phase.seed : null],
  );
  const best = store.challenge.best;

  const start = (seed: number) => {
    tally.current = emptyTally();
    finished.current = false;
    setRolls(0);
    setResult(null);
    setPhase({ kind: 'play', seed });
  };
  // `#/challenge` -> `#/challenge?seed=N` keeps this component mounted: follow the URL seed.
  useEffect(() => {
    if (urlSeed !== null && !(phase.kind === 'play' && phase.seed === urlSeed)) start(urlSeed);
  }, [urlSeed]);

  // The simulator reports `scene-completed` before the `rolled` event of the roll that ended it,
  // so scoring waits for that last roll to be tallied.
  const finished = useRef(false);
  const finish = (state: GameState) => {
    if (!scene?.challenge || phase.kind !== 'play') return;
    const start = scene.bankroll ?? 0;
    const r = scoreChallenge(tally.current, scene.challenge, {
      actualNet: equity(state) - start,
      expectedLoss: state.stats.expectedLoss,
    });
    setResult(r);
    store.recordChallenge({ score: r.score, band: r.band, seed: phase.seed });
    setPhase({ kind: 'result', seed: phase.seed });
  };
  const onEvent = (e: SimulatorEvent) => {
    tally.current = observeChallenge(tally.current, e);
    if (e.type === 'rolled') {
      setRolls(tally.current.rolls);
      if (finished.current) {
        finished.current = false;
        finish(e.state);
      }
    }
    if (e.type === 'scene-completed') finished.current = true;
  };

  if (phase.kind === 'intro') {
    return (
      <div class="page">
        <h1>Challenge</h1>
        <p class="muted">
          Play 300 rolls at a $500 table and get a score for your <strong>bets</strong>, not your
          luck: the score is the house edge on your action, every bet the dice decide counted by its
          amount and its exact edge. Winning or losing a bet changes nothing; odds carry no edge, so
          they pull the score down. The mix of bets that gets decided depends on the session, so the
          same play can land a hair apart from one seed to the next. Nobody wins money here; a low
          score means you gave the house as little as possible.
        </p>
        <div class="grid">
          <button type="button" class="card tile" onClick={() => start(dailySeed())}>
            <strong>Seed of the day</strong>
            <span class="muted">Everyone gets the same dice today ({dailySeed()})</span>
          </button>
          <button type="button" class="card tile" onClick={() => start(randomSeed())}>
            <strong>Random dice</strong>
            <span class="muted">A fresh sequence every time</span>
          </button>
        </div>
        <section class="card" aria-label="Rank bands">
          <h2>Rank bands</h2>
          <ul class="challenge-bands">
            {RANK_BANDS.map((b) => (
              <li key={b.id}>
                <span class={`badge tier-${BAND_TIER[b.id]}`}>{b.label}</span>{' '}
                <span class="muted">
                  {b.max === Infinity ? 'over 5.00%' : `up to ${(b.max * 100).toFixed(2)}%`}
                </span>
              </li>
            ))}
          </ul>
          {best ? (
            <p>
              Your best: <strong>{formatScore(best.score)}</strong> ({bandLabel(best.band)}), after{' '}
              {store.challenge.played} {store.challenge.played === 1 ? 'session' : 'sessions'}.
            </p>
          ) : (
            <p class="muted">No scored session yet.</p>
          )}
        </section>
      </div>
    );
  }

  if (phase.kind === 'result' && result) {
    const r = result;
    return (
      <div class="page" data-testid="challenge-result">
        <h1>Challenge result</h1>
        <section class={`card challenge-score tier-${BAND_TIER[r.band]}`} aria-label="Score">
          <p class="challenge-score-big">
            <span class={`badge tier-${BAND_TIER[r.band]}`}>{r.label}</span>{' '}
            <strong data-testid="challenge-score">{formatScore(r.score)}</strong>
          </p>
          <p>{r.blurb}</p>
          {best && r.score !== null && r.score <= best.score ? (
            <p class="muted">That is your best score so far.</p>
          ) : null}
        </section>
        <section class="card" aria-label="Breakdown">
          <h2>How the score adds up</h2>
          <dl class="challenge-kv">
            <dt>Rolls</dt>
            <dd>{r.rolls}</dd>
            <dt>Bets decided by the dice</dt>
            <dd>
              {money(r.resolved)} in {r.decisions} {r.decisions === 1 ? 'decision' : 'decisions'}
            </dd>
            <dt>House edge on that action (the score)</dt>
            <dd>
              <strong>{formatScore(r.score)}</strong>
            </dd>
            <dt>Sucker bets decided (observation)</dt>
            <dd>{r.redDecisions}</dd>
            <dt>Points played without odds (observation)</dt>
            <dd>{r.noOddsCycles}</dd>
          </dl>
          <p class="muted">
            The dice: you finished {r.actualNet >= 0 ? 'up' : 'down'} {money(Math.abs(r.actualNet))}{' '}
            against an expected {money(-r.expectedLoss, true)}. That gap is luck, and it does not
            touch the score.
          </p>
        </section>
        <div class="challenge-actions">
          <button type="button" class="btn" onClick={() => start(randomSeed())}>
            Play again (random dice)
          </button>
          <button type="button" class="btn btn-ghost" onClick={() => start(dailySeed())}>
            Seed of the day
          </button>
          <Link to="/play" class="btn btn-ghost">
            Practice table
          </Link>
        </div>
      </div>
    );
  }

  const seed = phase.kind === 'play' ? phase.seed : 0;
  return (
    <div class="page page-wide">
      <header class="challenge-head">
        <h1>Challenge</h1>
        <p class="muted" role="status" aria-live="polite" data-testid="challenge-rolls">
          Roll {rolls} of {scene?.challenge?.rolls ?? 300} · seed {seed}
        </p>
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => {
            setPhase({ kind: 'intro' });
            navigate('/challenge');
          }}
        >
          Quit
        </button>
      </header>
      {scene ? (
        <Simulator
          key={seed}
          scene={scene}
          mode="embedded"
          initialSettings={simSettings(store.settings)}
          onEvent={onEvent}
        />
      ) : null}
    </div>
  );
}
