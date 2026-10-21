import type { SceneConfig, SceneRuntime, SceneStep } from '../scene/types';
import { StepPanel } from './StepPanel';
import type { TokenResolver } from './stepTokens';

export interface SimStepProps {
  scene: SceneConfig;
  step: SceneStep | null | undefined;
  rt: SceneRuntime;
  hintVisible: boolean;
  onNext: () => void;
  onAnswer?: (choice: number) => void;
  onRestart: () => void;
  resolve?: TokenResolver;
}

/** Guided-lesson step panel, or the "Done" panel once the scene is complete. */
export function SimStep({
  scene,
  step,
  rt,
  hintVisible,
  onNext,
  onAnswer,
  onRestart,
  resolve,
}: SimStepProps) {
  const guided = !!scene.steps?.length;
  const lastIdx = (scene.steps?.length ?? 1) - 1;
  const stepAck = step ? 'acknowledged' in step.completeWhen : false;
  const showNext = !!step && (rt.satisfied === true || stepAck);
  const restart = scene.ui?.showRestart !== false;
  const label = scene.ui?.stepPanelLabel ?? 'Lesson step';
  return (
    <>
      {guided && step ? (
        <StepPanel
          resolve={resolve}
          step={step}
          index={rt.stepIndex}
          total={scene.steps!.length}
          hintVisible={hintVisible}
          showNext={showNext}
          nextLabel={rt.stepIndex === lastIdx ? 'Finish' : 'Next'}
          done={false}
          onNext={onNext}
          {...(onAnswer ? { onAnswer } : {})}
          asked={{ count: rt.counters.ans ?? 0, correct: (rt.counters.ansOk ?? 0) > 0 }}
          {...(restart ? { onRestart } : {})}
          label={label}
        />
      ) : null}
      {guided && rt.done ? (
        <section class="sim-step sim-step-done" aria-label={label}>
          {/* not a live region: the simulator has one announcer; see Simulator.tsx */}
          <p class="sim-step-text">
            <strong>Done.</strong> Nice work.{' '}
            {restart ? 'Keep playing here, or restart the practice.' : 'Keep playing here.'}
          </p>
          {restart ? (
            <button type="button" class="sim-linkbtn" onClick={onRestart}>
              Restart
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
