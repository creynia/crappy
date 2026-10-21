/**
 * Every `answered` requirement inside a condition tree (true = any answer, 'correct' = the right one).
 * Defensive about shape: validation calls it on unchecked JSON.
 */
export function answeredRequirements(c: unknown): Array<true | 'correct'> {
  if (typeof c !== 'object' || c === null) return [];
  const o = c as Record<string, unknown>;
  for (const k of ['all', 'any']) {
    const list = o[k];
    if (Array.isArray(list)) return list.flatMap(answeredRequirements);
  }
  return o.answered === true || o.answered === 'correct' ? [o.answered] : [];
}
