import { useEffect, useRef, useState } from 'preact/hooks';
import { Simulator } from '../../sim';
import type { SceneConfig, SimulatorEvent } from '../../sim';
import { useStore } from '../context';
import { simSettings } from '../simSettings';

/**
 * Renders <Simulator scene onEvent>. Guided steps are owned by the sim scene runner; this only
 * persists progress from step-completed / scene-completed events. The table mounts lazily when
 * scrolled into view (long lessons stay fast on phones).
 */
export function LessonScene(props: { lessonId: string; scene: SceneConfig }) {
  const store = useStore();
  const { lessonId, scene } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (visible || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const done = store.lesson(lessonId)?.scenes[scene.id]?.completed === true;
  const onEvent = (e: SimulatorEvent) => {
    if (e.type === 'step-completed') store.markSceneStep(lessonId, scene.id, e.index + 1);
    else if (e.type === 'scene-completed') store.markSceneComplete(lessonId, scene.id);
  };
  return (
    <section class="scene card" aria-label={scene.title ?? 'Practice table'}>
      <header class="scene-head">
        <h3>{scene.title ?? 'Try it'}</h3>
        {done && <span class="badge tier-good">Done</span>}
      </header>
      <div ref={ref} class="scene-body">
        {visible ? (
          <Simulator
            scene={scene}
            mode="embedded"
            initialSettings={simSettings(store.settings)}
            onEvent={onEvent}
          />
        ) : (
          <div class="scene-placeholder">Table loads as you scroll</div>
        )}
      </div>
    </section>
  );
}
