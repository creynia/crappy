import type { GameState } from '../engine/types';
import type { RollLogEntry } from './rollLog';

/** Sandbox state saved under `crappy:sim:${key}:v1`. Every access is guarded: storage may be missing or full. */
export interface PersistedSandbox {
  v: 1;
  game: GameState;
  /** bankroll the sandbox started with, so a changed default bankroll discards old state */
  startBankroll: number;
  presetId: string;
  chip?: number;
  /** last few roll-log entries */
  log?: RollLogEntry[];
}

const storageKey = (key: string) => `crappy:sim:${key}:v1`;

export function loadSandbox(key: string): PersistedSandbox | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedSandbox;
    if (p?.v !== 1 || p.game?.version !== 1 || !Array.isArray(p.game.bets)) return null;
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
