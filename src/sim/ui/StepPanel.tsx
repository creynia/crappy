import { useEffect, useState } from 'preact/hooks';
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
}

/** Tiny inline formatter: **bold** and _italic_ only (scene text is trusted repo content, still escaped). */
export function renderLite(text: string) {
  const out: preact.ComponentChild[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] !== undefined ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function AskBlock(p: {
  ask: NonNullable<SceneStep['ask']>;
  stepId: string;
  asked: { count: number; correct: boolean };
  onAnswer?: (choice: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [p.stepId]);
  // a restart clears the runtime counters; forget the old pick with them
  useEffect(() => {
    if (p.asked.count === 0) setPicked(null);
  }, [p.asked.count]);
  const shown = p.asked.count === 0 ? null : picked;
  const correct = shown !== null && shown === p.ask.answer;
  const solved = p.asked.correct;
  return (
    <div class="sim-ask" role="group" aria-labelledby={`ask-q-${p.stepId}`}>
      <p class="sim-ask-q" id={`ask-q-${p.stepId}`}>
        {renderLite(p.ask.q)}
      </p>
      <div class="sim-ask-options">
        {p.ask.options.map((o, i) => (
          <button
            key={i}
            type="button"
            class="sim-ask-opt"
            aria-pressed={shown === i}
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
      <p class="sim-ask-feedback" role="status" aria-live="polite">
        {shown === null ? null : (
          <>
            <strong>{correct ? 'Correct.' : 'Not quite.'}</strong> {renderLite(p.ask.explain)}
            {correct ? null : ' Try again.'}
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
    <section class="sim-step" aria-label="Lesson step" data-step={p.step.id}>
      <div class="sim-step-count">
        {p.done ? 'Done' : `Step ${p.index + 1} of ${p.total}`}
        {p.onRestart ? (
          <button type="button" class="sim-linkbtn" onClick={p.onRestart}>
            Restart
          </button>
        ) : null}
      </div>
      <p class="sim-step-text" role="status" aria-live="polite">
        {renderLite(p.step.text)}
      </p>
      {p.step.ask ? (
        <AskBlock
          ask={p.step.ask}
          stepId={p.step.id}
          asked={p.asked ?? { count: 0, correct: false }}
          {...(p.onAnswer ? { onAnswer: p.onAnswer } : {})}
        />
      ) : null}
      {p.hintVisible && p.step.hint ? (
        <p class="sim-step-hint" role="note">
          Hint: {renderLite(p.step.hint)}
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
          {mathOpen ? <p>{renderLite(p.step.math)}</p> : null}
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
