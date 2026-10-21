import { useState } from 'preact/hooks';
import { ChipStack, Dice, DieIcon, Puck } from '../../sim';
import { formatMoney } from '../../sim/engine';
import type { AnyDrill, BuiltinAnswer, CheckResult, DrillItem, Visual } from './types';

function VisualView({ v }: { v: Visual }) {
  switch (v.kind) {
    case 'dice':
      return (
        <figure class="pr-visual">
          <Dice dice={v.dice} size="lg" />
          {v.caption && <figcaption>{v.caption}</figcaption>}
        </figure>
      );
    case 'chips':
      return (
        <figure class="pr-visual">
          <svg
            viewBox="-48 -52 96 112"
            width="72"
            height="84"
            role="img"
            aria-label={`${formatMoney(v.amount)} in chips`}
          >
            <ChipStack x={0} y={0} amount={v.amount} r={34} />
          </svg>
          {v.caption && <figcaption>{v.caption}</figcaption>}
        </figure>
      );
    case 'puck':
      return (
        <figure class="pr-visual">
          <svg viewBox="-40 -40 80 84" width="64" height="67" aria-hidden="true">
            <Puck x={0} y={0} r={34} on={v.point !== null} />
          </svg>
          <figcaption>{v.point === null ? 'Come-out' : `Point ${v.point}`}</figcaption>
        </figure>
      );
  }
}

export function Visuals({ visuals }: { visuals?: readonly Visual[] }) {
  if (!visuals?.length) return null;
  return (
    <div class="pr-visuals">
      {visuals.map((v, i) => (
        <VisualView key={i} v={v} />
      ))}
    </div>
  );
}

/** Parses "$1,234.50" / "14" into a number, or null. */
export function parseNumberAnswer(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumberInput(props: {
  money?: boolean;
  label?: string;
  disabled: boolean;
  onAnswer: (n: number) => void;
}) {
  const [text, setText] = useState('');
  const value = parseNumberAnswer(text);
  return (
    <form
      class="pr-number"
      onSubmit={(e) => {
        e.preventDefault();
        if (value !== null && !props.disabled) props.onAnswer(value);
      }}
    >
      <label>
        <span class="sr">{props.label ?? 'Your answer'}</span>
        {props.money && <span aria-hidden="true">$</span>}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={props.disabled}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>
      <button type="submit" class="btn" disabled={props.disabled || value === null}>
        Check
      </button>
    </form>
  );
}

/** Prompt, pictures and the answer input for one drill item. */
export function ItemView(props: {
  drill: AnyDrill;
  item: DrillItem;
  /** the given answer and its result once answered */
  answered: { answer: unknown; result: CheckResult } | null;
  onAnswer: (answer: unknown) => void;
}) {
  const { drill, item, answered } = props;
  const spec = item.answer;
  const disabled = answered !== null;
  let input;
  if (spec.kind === 'choice') {
    input = (
      <div class="pr-choices" role="group" aria-label="Answers">
        {spec.choices.map((c) => {
          const picked = answered?.answer === c.id;
          const state = !answered ? '' : picked ? (answered.result.ok ? ' right' : ' wrong') : '';
          return (
            <button
              type="button"
              key={c.id}
              class={`pr-choice${state}`}
              disabled={disabled}
              aria-pressed={answered ? picked : undefined}
              onClick={() => props.onAnswer(c.id satisfies BuiltinAnswer)}
            >
              {c.dice && (
                <span class="pr-choice-dice" aria-hidden="true">
                  <DieIcon value={c.dice[0]} size={22} />
                  <DieIcon value={c.dice[1]} size={22} />
                </span>
              )}
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (spec.kind === 'number') {
    input = (
      <NumberInput
        key={item.key}
        money={spec.money}
        label={spec.label}
        disabled={disabled}
        onAnswer={(n) => props.onAnswer(n)}
      />
    );
  } else {
    const Input = drill.Input;
    input = Input ? (
      <Input item={item} disabled={disabled} onAnswer={props.onAnswer} />
    ) : (
      <p class="muted">This drill has no answer input.</p>
    );
  }
  return (
    <div class="pr-item" data-key={item.key}>
      <Visuals visuals={item.visuals} />
      <p class="pr-prompt">{item.prompt}</p>
      {input}
    </div>
  );
}
