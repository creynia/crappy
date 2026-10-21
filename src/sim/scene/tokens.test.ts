import { describe, expect, it } from 'vitest';
import { replaceTokens, tokenProblems } from './tokens';
import { validateScene } from './validate';

describe('step tokens', () => {
  it('accepts the known tokens', () => {
    expect(
      tokenProblems(
        '{{bankroll}} {{point}} {{onTable}} {{session}} {{ev:dont-pass}} {{edge:pass-line}}',
      ),
    ).toEqual([]);
  });

  it('rejects unknown names, unknown bet ids and missing or stray arguments', () => {
    expect(tokenProblems('{{nope}}')).toEqual(['unknown token {{nope}}']);
    expect(tokenProblems('{{ev:nope}}')).toEqual(['unknown token {{ev:nope}}']);
    expect(tokenProblems('{{ev}}')).toEqual(['unknown token {{ev}}']);
    expect(tokenProblems('{{bankroll:5}}')).toEqual(['unknown token {{bankroll:5}}']);
  });

  it('validateScene reports a bad token in step text with its path', () => {
    const r = validateScene({
      id: 'x',
      version: 1,
      steps: [{ id: 's', text: 'EV is {{ev:nope}}', completeWhen: { acknowledged: true } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('steps[0].text: unknown token {{ev:nope}}');
  });

  it('replaces known tokens and leaves unknown ones as written', () => {
    expect(
      replaceTokens('Has {{bankroll}} and {{x}}', (n) => (n === 'bankroll' ? '$50' : undefined)),
    ).toBe('Has $50 and {{x}}');
  });
});
