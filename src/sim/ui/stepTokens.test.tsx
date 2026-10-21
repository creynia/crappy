import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import { resolverFor } from './stepTokens';
import { StepPanel } from './StepPanel';

afterEach(cleanup);

// $500 bankroll, $5 on the pass line (EV -1.41% = -7.07 cents)
function withPassLine() {
  const r = applyAction(createGame({ bankroll: 50000, seed: 1 }), {
    type: 'place-bet',
    betType: 'pass-line',
    amount: 500,
  });
  if (!r.ok) throw new Error('bet rejected');
  return r.state;
}

describe('resolverFor', () => {
  it('resolves money, point and table tokens from the live game', () => {
    const r = resolverFor(withPassLine());
    expect(r('bankroll')).toBe('$495');
    expect(r('point')).toBe('off');
    expect(r('onTable')).toBe('$5');
    expect(r('session')).toBe('$0');
    expect(r('nope')).toBeUndefined();
  });

  it('gives the EV and house edge of your bet, and "no bet" when you have none', () => {
    const r = resolverFor(withPassLine());
    expect(r('ev', 'pass-line')).toBe('-$0.07');
    expect(r('edge', 'pass-line')).toBe('1.41%');
    expect(r('ev', 'dont-pass')).toBe('no bet');
  });
});

describe('StepPanel with live tokens', () => {
  it('shows the resolved values in the step text', () => {
    const { container } = render(
      <StepPanel
        step={{
          id: 's',
          text: 'Bankroll {{bankroll}}; your pass line is worth {{ev:pass-line}}.',
          completeWhen: { acknowledged: true },
        }}
        index={0}
        total={1}
        hintVisible={false}
        showNext={false}
        done={false}
        onNext={() => {}}
        resolve={resolverFor(withPassLine())}
      />,
    );
    expect(container.querySelector('.sim-step-text')!.textContent).toBe(
      'Bankroll $495; your pass line is worth -$0.07.',
    );
  });
});
