import type { BetTypeId, BetTypeStats } from '../engine/types';
import { betLabel, fmtMoney } from './text';

/** Edges above this (poor and avoid tiers) count as costly. Good and free bets never get the sentence. */
const COSTLY_EDGE = 0.05;
/** Pass Line flat edge, exact: 7/495 of each dollar resolved (1.41%). */
const PASS_LINE_EDGE = 7 / 495;

const pct = (f: number) => `${Math.round(f * 100)}%`;

export interface LossBreakdown {
  /** each bet's share of the total expected loss, 0..1; sums to 1 when there is any expected loss */
  loss: Partial<Record<BetTypeId, number>>;
  /** the personal takeaway, or null when no bet is costly */
  sentence: string | null;
}

/**
 * Curriculum 6.4 as a takeaway (I023). The costliest bet (highest expected loss among bets whose house edge
 * is over 5%) is compared with its share of the action. "Pass Line would have cost" is the expected loss
 * of the same action on Pass Line (7/495 per dollar resolved).
 */
export function lossBreakdown(
  byType: Partial<Record<BetTypeId, BetTypeStats>>,
  totalWagered: number,
): LossBreakdown {
  const entries = (Object.entries(byType) as [BetTypeId, BetTypeStats][]).filter(
    ([, s]) => s.count > 0,
  );
  const totalLoss = entries.reduce((t, [, s]) => t + s.expectedLoss, 0);
  const loss: Partial<Record<BetTypeId, number>> = {};
  for (const [t, s] of entries) loss[t] = totalLoss > 0 ? s.expectedLoss / totalLoss : 0;

  let top: [BetTypeId, BetTypeStats] | null = null;
  let costlyWagered = 0;
  for (const [t, s] of entries) {
    const edge = s.wagered > 0 ? s.expectedLoss / s.wagered : 0;
    if (edge <= COSTLY_EDGE) continue;
    costlyWagered += s.wagered;
    if (!top || s.expectedLoss > top[1].expectedLoss) top = [t, s];
  }
  if (!top || totalLoss <= 0 || totalWagered <= 0) return { loss, sentence: null };
  const [t, s] = top;
  const sentence =
    `${betLabel(t)} bets were ${pct(s.wagered / totalWagered)} of your action but ` +
    `${pct(s.expectedLoss / totalLoss)} of your expected loss. ` +
    `Pass Line would have cost about ${fmtMoney(costlyWagered * PASS_LINE_EDGE, { exact: true })} on all your costly bets.`;
  return { loss, sentence };
}
