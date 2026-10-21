import { isDicePair } from '../engine/bets';
import type { Bet, GameState } from '../engine/types';

/** Sandbox state saved under `crappy:sim:${key}:v1`. Every access is guarded: storage may be missing or full. */
export interface PersistedSandbox {
  v: 1;
  game: GameState;
  /** bankroll the sandbox started with, so a changed default bankroll discards old state */
  startBankroll: number;
  presetId: string;
  chip?: number;
}

const storageKey = (key: string) => `crappy:sim:${key}:v1`;

export function loadSandbox(key: string): PersistedSandbox | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedSandbox;
    if (p?.v !== 1 || p.game?.version !== 1 || !Array.isArray(p.game.bets)) return null;
    // States saved before hop bets (I035) have no `hop` field and load as-is; a hop without its pair is corrupt.
    const bets: readonly Bet[] = p.game.bets;
    if (bets.some((b) => b.type === 'hop' && !isDicePair(b.hop))) return null;
    // Saves from before luck was tracked have no variance. If they already hold results the luck
    // cannot be reconstructed, so mark it unknown (NaN) instead of showing an absurd z.
    const stats = p.game.stats;
    if (typeof stats.variance !== 'number') stats.variance = stats.expectedLoss > 0 ? NaN : 0;
    return p;
  } catch {
    return null;
  }
}

export function saveSandbox(key: string, data: PersistedSandbox): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(data));
  } catch {
    /* private mode or quota: the sandbox still works, it just will not persist */
  }
}

export function clearSandbox(key: string): void {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}
