import { isBetTypeId } from '../engine/bets';

/** Anything inside `{{ }}`, so a malformed token is caught too (validation rejects what does not parse). */
const LOOSE = /\{\{([^}]*)\}\}/g;
/** A token must be exactly `name` or `name:arg`: no spaces, names are letters, args are lowercase ids. */
const STRICT = /^([A-Za-z]+)(?::([a-z0-9_-]+))?$/;

const SIMPLE: readonly string[] = ['bankroll', 'point', 'onTable', 'session'];
const WITH_BET: readonly string[] = ['ev', 'edge'];

/** The parsed token, or null when the inside of `{{ }}` is not a known token. */
export function parseToken(inner: string): { name: string; arg?: string } | null {
  const m = STRICT.exec(inner);
  if (!m) return null;
  const name = m[1]!;
  const arg = m[2];
  if (SIMPLE.includes(name) && arg === undefined) return { name };
  if (WITH_BET.includes(name) && arg !== undefined && isBetTypeId(arg)) return { name, arg };
  return null;
}

/** Problems with the tokens in a string, for validateScene. Empty when every `{{ }}` is a known token. */
export function tokenProblems(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(LOOSE)) {
    if (!parseToken(m[1]!)) out.push(`unknown token ${m[0]}`);
  }
  return out;
}

/** Replaces each known token with `resolve(name, arg)`; anything else stays as written. */
export function replaceTokens(
  text: string,
  resolve: (name: string, arg?: string) => string | undefined,
): string {
  return text.replace(LOOSE, (raw, inner: string) => {
    const t = parseToken(inner);
    if (!t) return raw;
    const v = resolve(t.name, t.arg);
    return v === undefined ? raw : v;
  });
}
