// The drill registry. To add a drill: create `drills/<name>.ts` with `defineDrill(...)` (see
// ../types.ts for the API) and append it here. Order = order on the practice hub.
import type { AnyDrill } from '../types';
import { lineCalls } from './lineCalls';

export const DRILLS: readonly AnyDrill[] = [lineCalls];

export function getDrill(id: string): AnyDrill | undefined {
  return DRILLS.find((d) => d.id === id);
}
