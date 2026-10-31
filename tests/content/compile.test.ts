import { describe, expect, it } from 'vitest';
import { compileLesson, minHeadingDepth } from '../../src/content/compile';

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

describe('heading levels', () => {
  it('shifts the shallowest heading to h2', () => {
    const l = compileLesson(head + '### A\n\ntext\n\n#### B\n\n:::tip\n### C\n:::\n', 't.md');
    const html = JSON.stringify(l.blocks);
    expect(html).toContain('<h2>A</h2>');
    expect(html).toContain('<h3>B</h3>');
    expect(html).toContain('<h2>C</h2>');
  });
  it('leaves h2 lessons alone and ignores # inside code fences', () => {
    const l = compileLesson(head + '## A\n\n```text\n# not a heading\n```\n', 't.md');
    expect(JSON.stringify(l.blocks)).toContain('<h2>A</h2>');
  });
});

describe('minHeadingDepth', () => {
  it('ignores headings inside nested / longer fences and handles setext headings', () => {
    const body = '#### Real\n\n````md\n```\n# fake\n```\n# still fake\n````\n\nSetext\n------\n';
    expect(minHeadingDepth(body)).toBe(2);
    expect(minHeadingDepth('#### Real\n\n````md\n```\n# fake\n```\n# still fake\n````\n')).toBe(4);
    expect(minHeadingDepth('no headings')).toBe(7);
  });
});

describe('quiz ids', () => {
  it('reject ":" so they cannot collide with in-scene answers', () => {
    expect(() =>
      compileLesson(
        head + '```quiz\n- id: scene:step\n  q: A?\n  options: [a, b]\n  answer: 0\n  explain: e\n```\n',
        't.md',
      ),
    ).toThrow(/":"/);
  });
});

describe('lesson sources and citations', () => {
  const sourceIds = new Map([['woo', { id: 'woo', title: 'Wizard of Odds', url: 'https://wizardofodds.com/' }]]);
  const lesson = (fm: string, body: string) =>
    `---\nid: x\ntitle: X\nsummary: s\nminutes: 1\n${fm}---\n\n${body}\n`;

  it('resolves ids and one-off entries, and renders [^n] markers', () => {
    const l = compileLesson(
      lesson('sources:\n  - woo\n  - { title: One-off, note: n }\n', 'Edge is 1%.[^1] And more.[^2]'),
      'x.md',
      { sourceIds },
    );
    expect(l.sources?.map((s) => s.title)).toEqual(['Wizard of Odds', 'One-off']);
    const html = (l.blocks[0] as { html: string }).html;
    expect(html).toContain('data-cite="1"');
    expect(html).toContain('data-cite="2"');
    expect(html).not.toContain('[^');
  });

  it('rejects unknown ids, out-of-range markers and bad urls', () => {
    expect(() => compileLesson(lesson('sources: [nope]\n', 'a'), 'x.md', { sourceIds })).toThrow(/unknown source id/);
    expect(() => compileLesson(lesson('sources: [woo]\n', 'a[^2]'), 'x.md', { sourceIds })).toThrow(/out of range/);
    expect(() => compileLesson(lesson('', 'a[^1]'), 'x.md', { sourceIds })).toThrow(/out of range/);
    expect(() =>
      compileLesson(lesson('sources:\n  - { title: T, url: "http://x.test" }\n', 'a'), 'x.md', { sourceIds }),
    ).toThrow(/https/);
  });

  it('lessons without sources carry none', () => {
    expect(compileLesson(lesson('', 'plain'), 'x.md').sources).toBeUndefined();
  });
});
