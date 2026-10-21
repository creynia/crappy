// The drill registry. To add a drill: create `drills/<name>.ts` with `defineDrill(...)` (see
// ../types.ts for the API) and append it here. Order = order on the practice hub.
import type { AnyDrill } from '../types';
import { evQuiz } from './evQuiz';
import { lineCalls } from './lineCalls';
import { ways } from './ways';

export const DRILLS: readonly AnyDrill[] = [lineCalls, ways, evQuiz];

export function getDrill(id: string): AnyDrill | undefined {
  return DRILLS.find((d) => d.id === id);
}
