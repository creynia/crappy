import { isBetTypeId } from '../engine/bets';

/** `{{name}}` or `{{name:arg}}` inside step text, hint or math. */
export const TOKEN_RE = /\{\{\s*([a-z-]+)(?::([a-z0-9-]+))?\s*\}\}/g;

const SIMPLE = ['bankroll', 'point', 'onTable', 'session'] as const;
const WITH_BET = ['ev', 'edge'] as const;

/** Problems with the tokens in a string, for validateScene. Empty when every token is known. */
export function tokenProblems(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const [raw, name, arg] = m as unknown as [string, string, string | undefined];
    const ok =
      ((SIMPLE as readonly string[]).includes(name) && arg === undefined) ||
      ((WITH_BET as readonly string[]).includes(name) && arg !== undefined && isBetTypeId(arg));
    if (!ok) out.push(`unknown token ${raw}`);
  }
  return out;
}

/** Replaces each known token with `resolve(name, arg)`; tokens the resolver does not know stay as written. */
export function replaceTokens(
  text: string,
  resolve: (name: string, arg?: string) => string | undefined,
): string {
  return text.replace(TOKEN_RE, (raw, name: string, arg: string | undefined) => {
    const v = resolve(name, arg);
    return v === undefined ? raw : v;
  });
}
