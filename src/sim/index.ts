// Public API of the simulator. src/content and src/app import from here (and from the
// sub-module barrels for engine/math/strategy), never from deep files.
export * from './engine';
export * from './math';
export * from './strategy';
export * from './scene';
export { Simulator } from './ui/Simulator';
export { mountSimulator } from './ui/mount';
export type { SimSettings, SimulatorProps, SimulatorEvent, SimulatorHandle } from './ui/types';
