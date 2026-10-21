import type { SceneConfig, SceneRuntime, SceneStep } from '../scene/types';
import { StepPanel } from './StepPanel';

export interface SimStepProps {
  scene: SceneConfig;
  step: SceneStep | null | undefined;
  rt: SceneRuntime;
  hintVisible: boolean;
  onNext: () => void;
  onRestart: () => void;
}

/** Guided-lesson step panel, or the "Done" panel once the scene is complete. */
export function SimStep({ scene, step, rt, hintVisible, onNext, onRestart }: SimStepProps) {
  const guided = !!scene.steps?.length;
  const lastIdx = (scene.steps?.length ?? 1) - 1;
  const stepAck = step ? 'acknowledged' in step.completeWhen : false;
  const showNext = !!step && (rt.satisfied === true || stepAck);
  return (
    <>
      {guided && step ? (
        <StepPanel
          step={step}
          index={rt.stepIndex}
          total={scene.steps!.length}
          hintVisible={hintVisible}
          showNext={showNext}
          nextLabel={rt.stepIndex === lastIdx ? 'Finish' : 'Next'}
          done={false}
          onNext={onNext}
          onRestart={onRestart}
        />
      ) : null}
      {guided && rt.done ? (
        <section class="sim-step sim-step-done" aria-label="Lesson step">
          <p class="sim-step-text" role="status">
            <strong>Done.</strong> Nice work. Keep playing here, or restart the practice.
          </p>
          <button type="button" class="sim-linkbtn" onClick={onRestart}>
            Restart
          </button>
        </section>
      ) : null}
    </>
  );
}
