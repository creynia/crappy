import type { BetTypeId } from '../sim/engine';
import type { SceneConfig } from '../sim/scene';

export type LessonId = string;
export type ChapterId = string;

/** Five EV tiers (decisions.md): free <=0, good <=2%, fair <=5%, poor <9%, avoid >=9%. */
export type Tier = 'free' | 'good' | 'fair' | 'poor' | 'avoid';
export const TIERS: readonly Tier[] = ['free', 'good', 'fair', 'poor', 'avoid'];
export const TIER_LABEL: Record<Tier, string> = {
  free: 'Free bet',
  good: 'Good bet',
  fair: 'Fair',
  poor: 'Costly',
  avoid: 'Sucker bet',
};

export interface Quiz {
  /** `<lessonId>-q<n>` (1-based) unless the author gave one */
  id: string;
  prompt: string;
  choices: string[];
  /** index into `choices` (0-based) */
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

/** Source form (content/glossary.json) has markdown; the compiled bundle holds HTML. */
export interface GlossaryEntry {
  term: string;
  slug: string;
  definition: string; // markdown in source, HTML in the bundle
  see?: string[];
  /** lesson that teaches the term (source field `seeAlso`) */
  lessonId?: LessonId;
}

export interface BetCopy {
  name?: string; // display name (fallback when the engine registry is unavailable)
  tip?: string;
  summary: string;
  howItWorks: string; // markdown in source, HTML in the bundle
  /** fallback tier, used when the math module cannot supply an edge */
  verdict?: Tier;
  lessonId?: LessonId;
}

export interface ContentBundle {
  chapters: Chapter[];
  lessons: Lesson[];
  glossary: GlossaryEntry[];
  bets: Record<BetTypeId, BetCopy>;
}
