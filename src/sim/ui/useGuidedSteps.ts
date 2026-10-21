import { useEffect, useRef } from 'preact/hooks';
import type { SceneConfig, SceneRuntime, SceneStep } from '../scene/types';
import type { SimulatorEvent } from './types';

/**
 * Guided-lesson effects: emits `step-started` once per step (opening auto-roll for auto-roll steps)
 * and shows the step hint after 20s idle. Returns the started-step ref, which a reset clears.
 */
export function useGuidedSteps(
  scene: SceneConfig,
  rt: SceneRuntime,
  step: SceneStep | undefined,
  emit: (e: SimulatorEvent) => void,
  setHintVisible: (v: boolean) => void,
  setAutoOpen: (v: boolean) => void,
) {
  const guided = !!scene.steps?.length;
  const startedRef = useRef(-1);
  useEffect(() => {
    if (!guided || rt.done) return;
    if (startedRef.current === rt.stepIndex) return;
    startedRef.current = rt.stepIndex;
    const st = scene.steps![rt.stepIndex]!;
    setHintVisible(false);
    emit({ type: 'step-started', stepId: st.id, index: rt.stepIndex });
    if (JSON.stringify(st.completeWhen).includes('autoRollCompleted')) setAutoOpen(true);
  }, [rt.stepIndex, rt.done, guided]);
  // idle hint after 20s
  useEffect(() => {
    if (!guided || rt.done || !step?.hint) return;
    const h = setTimeout(() => setHintVisible(true), 20_000);
    return () => clearTimeout(h);
  }, [rt.stepIndex, rt.counters, guided, rt.done, step?.hint]);
  return startedRef;
}
