import { replaceTokens } from '../scene/tokens';
import type { TokenResolver } from './stepTokens';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SceneStep } from '../scene/types';

export interface StepPanelProps {
  step: SceneStep;
  index: number;
  total: number;
  /** show a hint now (after a rejected action or idle) */
  hintVisible: boolean;
  /** step is met and waits for Next (advance: button), or is an acknowledge step */
  showNext: boolean;
  nextLabel?: string;
  done: boolean;
  onNext: () => void;
  /** the learner picked an option of the step's `ask` */
  onAnswer?: (choice: number) => void;
  /** answers given to the current step's ask so far, and whether one was correct */
  asked?: { count: number; correct: boolean };
  onRestart?: () => void;
  /** demo step: play the scripted actions again */
  onReplay?: () => void;
  /** demo narration so far, one line per scripted frame */
  captions?: string[];
  /** Live values for {{tokens}} in the step text, hint and math. */
  resolve?: TokenResolver;
}

/** Tiny inline formatter: **bold** and _italic_ only (scene text is trusted repo content, still escaped). */
export function renderLite(text: string, resolve?: TokenResolver) {
  const src = resolve ? replaceTokens(text, resolve) : text;
  const out: preact.ComponentChild[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    out.push(
      m[1] !== undefined ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>,
    );
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

/** Spoken/shown text for an answer, naming the pick so repeated wrong answers read differently. */
export function askFeedback(ask: NonNullable<SceneStep['ask']>, choice: number): string {
  const ok = choice === ask.answer;
  return `You chose "${ask.options[choice] ?? ''}". ${ok ? 'Correct.' : 'Not quite.'} ${ask.explain}${
    ok ? ' Now roll to check your call.' : ' Try again.'
  }`;
}

/**
 * The question and its options (plain buttons in a labelled group). Feedback is shown here but is not a live region: the
 * simulator has one announcer, which Simulator.tsx feeds the same text through `announce`.
 */
function AskBlock(p: {
  ask: NonNullable<SceneStep['ask']>;
  stepId: string;
  asked: { count: number; correct: boolean };
  onAnswer?: (choice: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setPicked(null), [p.stepId]);
  // a restart clears the runtime counters; forget the old pick with them
  useEffect(() => {
    if (p.asked.count === 0) setPicked(null);
  }, [p.asked.count]);
  const solved = p.asked.correct;
  // Once solved the options are disabled, so focus would fall to the page. Hand it to what comes next:
  // Roll when it is unlocked, else the Next button. The announcer speaks the feedback.
  useEffect(() => {
    if (!solved) return;
    const sim = root.current?.closest('.sim-root');
    sim?.querySelector<HTMLElement>('.sim-roll:not(:disabled), .sim-next')?.focus();
  }, [solved]);
  const shown = p.asked.count === 0 ? null : picked;
  const correct = shown !== null && shown === p.ask.answer;
  return (
    <div class="sim-ask" ref={root}>
      <p class="sim-ask-q" id={`ask-q-${p.stepId}`}>
        {renderLite(p.ask.q)}
      </p>
      <div class="sim-ask-options" role="group" aria-labelledby={`ask-q-${p.stepId}`}>
        {p.ask.options.map((o, i) => (
          <button
            key={i}
            type="button"
            class="sim-ask-opt"
            data-state={shown === i ? (correct ? 'correct' : 'wrong') : undefined}
            disabled={solved}
            onClick={() => {
              setPicked(i);
              p.onAnswer?.(i);
            }}
          >
            {renderLite(o)}
          </button>
        ))}
      </div>
      {/* Visual feedback only: the simulator's single announcer speaks the same text (Simulator.tsx). */}
      <p class="sim-ask-feedback">
        {shown === null ? null : (
          <>
            <strong>{correct ? 'Correct.' : 'Not quite.'}</strong> {renderLite(p.ask.explain)}
            {correct ? ' Now roll to check your call.' : ' Try again.'}
          </>
        )}
      </p>
    </div>
  );
}

export function StepPanel(p: StepPanelProps) {
  const [mathOpen, setMathOpen] = useState(false);
  useEffect(() => setMathOpen(false), [p.step.id]);
  return (
    <section class="sim-step" aria-label="Lesson step" data-step={p.step.id} tabIndex={-1}>
      <div class="sim-step-count">
        {p.done ? 'Done' : `Step ${p.index + 1} of ${p.total}`}
        {p.onReplay ? (
          <button
            type="button"
            class="sim-linkbtn sim-replay"
            aria-label="Replay the demo"
            onClick={p.onReplay}
          >
            Replay
          </button>
        ) : null}
        {p.onRestart ? (
          <button type="button" class="sim-linkbtn" onClick={p.onRestart}>
            Restart
          </button>
        ) : null}
      </div>
      {/* not a live region: the simulator has one announcer (roll results); see Simulator.tsx */}
      <p class="sim-step-text">{renderLite(p.step.text, p.resolve)}</p>
      {p.step.ask ? (
        <AskBlock
          ask={p.step.ask}
          stepId={p.step.id}
          asked={p.asked ?? { count: 0, correct: false }}
          {...(p.onAnswer ? { onAnswer: p.onAnswer } : {})}
        />
      ) : null}
      {p.captions && p.captions.length ? (
        <ol class="sim-demo-captions" aria-label="What happens in the demo">
          {p.captions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      ) : null}
      {p.hintVisible && p.step.hint ? (
        <p class="sim-step-hint" role="note">
          Hint: {renderLite(p.step.hint, p.resolve)}
        </p>
      ) : null}
      {p.step.math ? (
        <div class="sim-step-math">
          <button
            type="button"
            class="sim-linkbtn"
            aria-expanded={mathOpen}
            onClick={() => setMathOpen(!mathOpen)}
          >
            {mathOpen ? 'Hide the math' : 'Show the math'}
          </button>
          {mathOpen ? <p>{renderLite(p.step.math, p.resolve)}</p> : null}
        </div>
      ) : null}
      {p.showNext && !p.done ? (
        <button type="button" class="sim-next" onClick={p.onNext}>
          {p.nextLabel ?? 'Next'}
        </button>
      ) : null}
    </section>
  );
}
