import { render } from 'preact';
import { Simulator } from './Simulator';
import type { SimulatorHandle, SimulatorProps } from './types';

/** Framework-agnostic mount for lesson renderers. Placeholder: renders, but state methods TODO. */
export function mountSimulator(el: HTMLElement, props: SimulatorProps): SimulatorHandle {
  render(<Simulator {...props} />, el);
  return {
    unmount: () => render(null, el),
    getState: () => {
      throw new Error('TODO(sim-ui)');
    },
    dispatch: () => {
      throw new Error('TODO(sim-ui)');
    },
    reset: () => {
      throw new Error('TODO(sim-ui)');
    },
  };
}
