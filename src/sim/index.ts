// Public API of the simulator. src/content and src/app import from here (and from the
// sub-module barrels for engine/math/strategy), never from deep files.
export * from './engine';
export * from './math';
export * from './strategy';
export * from './scene';
export { Simulator } from './ui/Simulator';
export { mountSimulator } from './ui/mount';
// Small presentational pieces for app screens outside the table (e.g. practice drills).
export { Dice, DieIcon, DieFaceSvg } from './ui/Dice';
export type { DiceProps } from './ui/Dice';
export { ChipStack, ChipFace, chipBreakdown } from './ui/ChipStack';
export type { ChipStackProps } from './ui/ChipStack';
export { Puck } from './ui/Puck';
export { Table } from './ui/Table';
export type { TableProps, StackAnnotation } from './ui/Table';
export { centerLayout, landscapeLayout, portraitLayout } from './ui/layouts';
export type { SimSettings, SimulatorProps, SimulatorEvent, SimulatorHandle } from './ui/types';
