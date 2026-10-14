import type { BetTypeId, SceneConfig } from '../sim';

export type LessonId = string;
export type ChapterId = string;

export interface Quiz {
  id: string;
  prompt: string;
  choices: string[];
  /** index into `choices` */
  answer: number;
  explanation: string;
}

export type Block =
  | { kind: 'html'; html: string } // marked output, trusted repo content
  | { kind: 'math'; title: string; html: string } // collapsible "Show the math"
  | { kind: 'tip'; html: string }
  | { kind: 'scene'; scene: SceneConfig }
  | { kind: 'quiz'; quiz: Quiz };

export interface Lesson {
  id: LessonId;
  title: string;
  summary: string;
  minutes: number;
  chapterId: ChapterId;
  blocks: Block[];
}

export interface Chapter {
  id: ChapterId;
  title: string;
  summary: string;
  lessons: LessonId[];
}

export interface GlossaryEntry {
  term: string;
  slug: string;
  definition: string; // markdown
  see?: string[];
}

export interface BetCopy {
  summary: string;
  howItWorks: string; // markdown
  verdict: 'best' | 'ok' | 'avoid';
  lessonId?: LessonId;
}

export interface ContentBundle {
  chapters: Chapter[];
  lessons: Lesson[];
  glossary: GlossaryEntry[];
  bets: Record<BetTypeId, BetCopy>;
}
