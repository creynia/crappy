import { describe, expect, it } from 'vitest';
import { compileLesson } from '../../src/content/compile';

const head = '---\nid: t\ntitle: T\nsummary: S\nminutes: 2\n---\n';

describe('compileLesson', () => {
  it('splits prose, math, tip, scene and quiz blocks in order', () => {
    const l = compileLesson(
      head +
        'Hello **world**.\n\n:::tip\nBe nice.\n:::\n\n:::math The math\nx = `1`\n:::\n\n' +
        '```scene\nid: s1\nversion: 1\n```\n\n' +
        '```quiz\n- q: A?\n  options: [a, b]\n  answer: 1\n  explain: because\n- id: custom\n  q: B?\n  options: [a, b]\n  answer: 0\n  explain: e\n```\n',
      't.md',
    );
    expect(l.blocks.map((b) => b.kind)).toEqual(['html', 'tip', 'math', 'scene', 'quiz', 'quiz']);
    const quizzes = l.blocks.filter((b) => b.kind === 'quiz').map((b) => b.quiz.id);
    expect(quizzes).toEqual(['t-q1', 'custom']);
    expect(JSON.stringify(l.blocks[0])).toContain('<strong>world</strong>');
    expect(l.blocks[2]).toMatchObject({ kind: 'math', title: 'The math' });
  });

  it('does not treat ::: inside ordinary code fences as containers', () => {
    const l = compileLesson(head + '```text\n:::math nope\n```\n', 't.md');
    expect(l.blocks).toHaveLength(1);
    expect(l.blocks[0]?.kind).toBe('html');
  });

  it('rejects bad input with the file name in the message', () => {
    expect(() => compileLesson(head + ':::math\nbody\n:::\n', 'a.md')).toThrow(/a\.md.*title/);
    expect(() => compileLesson(head + ':::math T\nbody\n', 'a.md')).toThrow(/unclosed/);
    expect(() => compileLesson(head + ':::weird\nx\n:::\n', 'a.md')).toThrow(/unknown/);
    expect(() => compileLesson(head + '```scene\nid: x\nversion: 2\n```\n', 'a.md')).toThrow(/invalid scene/);
    expect(() => compileLesson('no front matter', 'a.md')).toThrow(/id/);
  });

  it('resolves glossary links and rejects unknown terms', () => {
    const opts = { glossarySlugs: new Set(['point']), glossaryTerms: new Map([['point', 'point']]) };
    const l = compileLesson(head + 'The [[point]] is set.', 't.md', opts);
    expect(JSON.stringify(l.blocks[0])).toContain('#/glossary?term=point');
    expect(() => compileLesson(head + '[[nope]]', 't.md', opts)).toThrow(/nope/);
  });
});
