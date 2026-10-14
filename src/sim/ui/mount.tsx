import { render } from 'preact';
import { Simulator } from './Simulator';
import type { Action, ApplyResult, GameState } from '../engine/types';
import type { SceneConfig } from '../scene/types';
import type { SimulatorHandle, SimulatorProps } from './types';

/** Framework-agnostic mount for lesson renderers. The handle becomes live after the first render. */
export function mountSimulator(el: HTMLElement, props: SimulatorProps): SimulatorHandle {
  let inner: Omit<SimulatorHandle, 'unmount'> | null = null;
  render(<Simulator {...props} onHandle={(h) => (inner = h)} />, el);
  const need = () => {
    if (!inner) throw new Error('Simulator is not ready yet');
    return inner;
  };
  return {
    unmount: () => render(null, el),
    getState: (): GameState => need().getState(),
    dispatch: (a: Action): ApplyResult => need().dispatch(a),
    reset: (scene?: SceneConfig) => need().reset(scene),
  };
}
