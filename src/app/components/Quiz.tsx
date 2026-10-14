import { useState } from 'preact/hooks';
import type { Quiz as QuizData } from '../../content/types';

export function Quiz(props: {
  quiz: QuizData;
  answeredBefore: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const { quiz } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = checked && picked === quiz.answer;
  const name = `quiz-${quiz.id}`;
  return (
    <fieldset class="card quiz">
      <legend class="quiz-tag">Quiz{props.answeredBefore ? ' (answered)' : ''}</legend>
      <p class="quiz-q">{quiz.prompt}</p>
      <div class="choices">
        {quiz.choices.map((c, i) => {
          const state =
            checked && i === quiz.answer ? 'right' : checked && i === picked ? 'wrong' : '';
          return (
            <label key={i} class={`choice ${state}`}>
              <input
                type="radio"
                name={name}
                checked={picked === i}
                disabled={checked}
                onChange={() => setPicked(i)}
              />
              <span>{c}</span>
            </label>
          );
        })}
      </div>
      {!checked ? (
        <button
          type="button"
          class="btn"
          disabled={picked === null}
          onClick={() => {
            setChecked(true);
            props.onAnswer(picked === quiz.answer);
          }}
        >
          Check answer
        </button>
      ) : (
        <div role="status" class={`quiz-result ${correct ? 'ok' : 'no'}`}>
          <strong>{correct ? 'Correct.' : 'Not quite.'}</strong> {quiz.explanation}
          {!correct && (
            <div>
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => {
                  setChecked(false);
                  setPicked(null);
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
