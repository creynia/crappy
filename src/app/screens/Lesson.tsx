import { useEffect } from 'preact/hooks';
import { Html } from '../components/Html';
import { Link } from '../components/Link';
import { LessonScene } from '../components/LessonScene';
import { Quiz } from '../components/Quiz';
import { useContent, useStore } from '../context';
import { NotFound } from './NotFound';

export function LessonView({ id }: { id: string }) {
  const content = useContent();
  const store = useStore();
  const idx = content.lessons.findIndex((l) => l.id === id);
  const lesson = content.lessons[idx];
  useEffect(() => {
    if (lesson) store.start(lesson.id);
  }, [lesson?.id]);
  if (!lesson) return <NotFound what="That lesson" />;
  const prev = content.lessons[idx - 1];
  const next = content.lessons[idx + 1];
  const done = store.status(lesson.id) === 'done';
  const progress = store.lesson(lesson.id);
  return (
    <article class="page lesson">
      <Link to="/learn" class="back">
        {'←'} All lessons
      </Link>
      <h1>{lesson.title}</h1>
      <p class="muted">{lesson.minutes} min read</p>
      {lesson.blocks.map((b, i) => {
        switch (b.kind) {
          case 'html':
            return <Html key={i} html={b.html} />;
          case 'tip':
            return (
              <aside key={i} class="tip">
                <strong class="tip-tag">Tip</strong>
                <Html html={b.html} />
              </aside>
            );
          case 'math':
            return (
              <details key={i} class="math">
                <summary>Show the math: {b.title}</summary>
                <Html html={b.html} />
              </details>
            );
          case 'scene':
            return (
              <LessonScene
                key={`${lesson.id}:${b.scene.id}`}
                lessonId={lesson.id}
                scene={b.scene}
              />
            );
          case 'quiz':
            return (
              <Quiz
                key={`${lesson.id}:${b.quiz.id}`}
                quiz={b.quiz}
                answeredBefore={progress?.quizzes[b.quiz.id]?.correct === true}
                onAnswer={(ok) => store.markQuiz(lesson.id, b.quiz.id, ok)}
              />
            );
        }
      })}
      <footer class="lesson-foot">
        <button
          type="button"
          class={done ? 'btn btn-ghost' : 'btn'}
          aria-pressed={done}
          onClick={() => store.completeLesson(lesson.id, !done)}
        >
          {done ? '✓ Completed (tap to undo)' : 'Mark complete'}
        </button>
        <div class="prevnext">
          {prev ? (
            <Link to={`/learn/${prev.id}`}>
              {'←'} {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={`/learn/${next.id}`}>
              {next.title} {'→'}
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </article>
  );
}
