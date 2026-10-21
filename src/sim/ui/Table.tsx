import type { JSX } from 'preact';
import { useId, useMemo, useRef } from 'preact/hooks';
import type { Bet, BetTypeId, Cents, PointNumber } from '../engine/types';
import { ChipStack } from './ChipStack';
import { Dice } from './Dice';
import type { Dice as DicePair } from '../engine/types';
import { hopText } from '../engine/bets';
import { hopSpot, regionIdForBet, spotPosition } from './layouts';
import type { RegionDef, RegionId, TableLayout } from './layouts/types';
import { Puck } from './Puck';
import { RegionArt } from './regionArt';
import { betLabel, fmtMoney, regionAriaLabel } from './text';
import './sim.css';

export interface TableProps {
  layout: TableLayout;
  bets: readonly Bet[];
  point: PointNumber | null;
  /** ids of bets that are not currently working */
  offBetIds?: ReadonlySet<string>;
  /** regions dimmed to 40% (scene allowedBets); they stay focusable and announce why */
  disabledRegions?: ReadonlySet<RegionId>;
  /** the subset of disabledRegions the rules don't offer (announced as "not offered", not "this lesson") */
  unofferedRegions?: ReadonlySet<RegionId>;
  highlightedBets?: readonly BetTypeId[];
  fieldPays?: { 2: number; 12: number };
  /** bets that just lost: ghost stacks slide to the dealer and fade */
  lostBets?: readonly Bet[];
  /** bets that just won: highlight flash, plus a payout stack that slides in from the dealer */
  wonBets?: readonly { bet: Bet; payout: Cents }[];
  /** come / don't-come bets (with their new point) whose chips are sliding from the box to the number */
  travellingBets?: readonly Bet[];
  /** duration of the current chip movement (lose / win / travel), ms; drives the CSS animations */
  chipMs?: number;
  /** which overlay is animating right now; the others sit still at their spot */
  chipPhase?: 'travel' | 'lose' | 'win' | null;
  /** dice overlay while rolling */
  rollingDice?: { dice: DicePair | null; durationMs: number } | null;
  selectedRegion?: RegionId | null;
  onRegionTap?: (id: RegionId) => void;
  /** `betId` is the first bet of that type at the spot; `allIds` lists every bet merged into the stack. */
  onStackTap?: (betId: string, allIds: readonly string[]) => void;
  class?: string;
}

const BONUS_REGIONS: ReadonlySet<RegionId> = new Set<RegionId>(['fire', 'all', 'tall', 'small']);

interface Placed {
  key: string;
  region: RegionDef;
  type: BetTypeId;
  x: number;
  y: number;
  amount: Cents;
  betIds: string[];
  off: boolean;
  /** hop bets: the pair, drawn above the stack */
  caption?: string;
}

/** Where a bet's chips go; each hop pair gets its own slot in the hop region (in placement order). */
function betSpot(layout: TableLayout, region: RegionDef, b: Bet, bets: readonly Bet[]) {
  if (b.type !== 'hop' || !b.hop) return { pos: spotPosition(region, b.type), key: b.type };
  const slot = bets.filter((x) => x.type === 'hop').indexOf(b);
  return { pos: hopSpot(region, slot, layout.chipRadius), key: `hop:${hopText(b.hop)}` };
}

function placeBets(
  layout: TableLayout,
  bets: readonly Bet[],
  offIds: ReadonlySet<string>,
  hiddenIds: ReadonlySet<string>,
) {
  const byRegion = new Map<RegionId, Bet[]>();
  const stacks = new Map<string, Placed>();
  for (const b of bets) {
    const rid = regionIdForBet(b.type, b.point);
    const region = rid ? layout.regions.find((r) => r.id === rid) : undefined;
    if (!region) continue;
    byRegion.set(region.id, [...(byRegion.get(region.id) ?? []), b]);
    // a travelling bet keeps its accessible name here but its chips are drawn by the ghost
    if (hiddenIds.has(b.id)) continue;
    const { pos, key: kind } = betSpot(layout, region, b, bets);
    const key = `${pos.x},${pos.y},${kind}`;
    const prev = stacks.get(key);
    const off = offIds.has(b.id);
    if (prev) {
      prev.amount += b.amount;
      prev.betIds.push(b.id);
      prev.off = prev.off && off;
    } else {
      stacks.set(key, {
        key,
        region,
        type: b.type,
        x: pos.x,
        y: pos.y,
        amount: b.amount,
        betIds: [b.id],
        off,
        ...(b.hop ? { caption: hopText(b.hop) } : {}),
      });
    }
  }
  return { byRegion, stacks: [...stacks.values()] };
}

export function Table({
  layout,
  bets,
  point,
  offBetIds,
  disabledRegions,
  unofferedRegions,
  highlightedBets,
  fieldPays = { 2: 2, 12: 2 },
  lostBets,
  wonBets,
  travellingBets,
  chipMs,
  chipPhase,
  rollingDice,
  selectedRegion,
  onRegionTap,
  onStackTap,
  class: cls,
}: TableProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const feltId = `felt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const empty = useMemo(() => new Set<string>(), []);
  const offIds = offBetIds ?? empty;
  const travelling = travellingBets ?? [];
  const hiddenIds = useMemo(() => new Set(travelling.map((b) => b.id)), [travellingBets]);
  const { byRegion, stacks } = useMemo(
    () => placeBets(layout, bets, offIds, hiddenIds),
    [layout, bets, offIds, hiddenIds],
  );
  const { w, h } = layout.viewBox;
  const hasPuck = layout.puckRadius > 0;
  const puckPos = point ? (layout.puck[point] ?? layout.puck.off) : layout.puck.off;
  const hl = new Set<string>(highlightedBets ?? []);
  // bonus side bets draw their collected numbers as pips inside the cell
  const progressFor = (region: RegionDef): readonly number[] | undefined => {
    if (!BONUS_REGIONS.has(region.id)) return undefined;
    return bets.find((b) => b.type === region.id)?.progress ?? [];
  };
  const wonIds = new Set((wonBets ?? []).map((x) => x.bet.id));

  const moveFocus = (from: Element, dir: 1 | -1) => {
    const all = [...(svgRef.current?.querySelectorAll<SVGGElement>('[data-region]') ?? [])];
    const i = all.indexOf(from as SVGGElement);
    const next = all[(i + dir + all.length) % all.length];
    next?.focus();
  };
  const onKey = (e: JSX.TargetedKeyboardEvent<SVGGElement>, id: RegionId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRegionTap?.(id);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(e.currentTarget, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(e.currentTarget, -1);
    }
  };

  const ghostPos = (b: Bet) => {
    const rid = regionIdForBet(b.type, b.point);
    const region = rid ? layout.regions.find((r) => r.id === rid) : undefined;
    if (!region) return null;
    // a resolved hop is no longer in `bets`: rebuild the pre-roll hop order (bet ids are sequential)
    if (b.type !== 'hop') return spotPosition(region, b.type);
    const prior = [...bets, ...(lostBets ?? []), ...(wonBets ?? []).map((x) => x.bet)]
      .filter((x) => x.type === 'hop')
      .sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)));
    return betSpot(layout, region, b, prior).pos;
  };

  return (
    <div class={`sim-table-wrap sim-table-${layout.id}${cls ? ' ' + cls : ''}`}>
      <svg
        ref={svgRef}
        class="sim-table"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={layout.id === 'center' ? 'Center proposition bets' : 'Craps table'}
      >
        <defs>
          <radialGradient id={feltId} cx="50%" cy="45%" r="75%">
            <stop offset="0%" stop-color="var(--felt-hi)" />
            <stop offset="100%" stop-color="var(--felt-lo)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill={`url(#${feltId})`} />
        {layout.regions.map((region) => {
          const disabled = disabledRegions?.has(region.id) ?? false;
          const rbets = byRegion.get(region.id) ?? [];
          const highlighted = rbets.length === 0 && region.betTypes.some((t) => hl.has(t));
          const { x, y, w: rw, h: rh } = region.rect;
          return (
            <g
              key={region.id}
              class={`sim-region${disabled ? ' is-disabled' : ''}${highlighted ? ' is-highlighted' : ''}${selectedRegion === region.id ? ' is-selected' : ''}`}
              role="button"
              tabindex={0}
              data-region={region.id}
              aria-label={regionAriaLabel(region, {
                bets: rbets,
                offIds,
                disabled,
                notOffered: unofferedRegions?.has(region.id) ?? false,
              })}
              aria-disabled={disabled || undefined}
              onClick={() => onRegionTap?.(region.id)}
              onKeyDown={(e) => onKey(e, region.id)}
            >
              <RegionArt
                region={region}
                ctx={{ fieldPays, point }}
                progress={progressFor(region)}
              />
              <rect class="sim-hit" x={x} y={y} width={rw} height={rh} rx="14" />
              <rect
                class="sim-focus-ring"
                x={x - 4}
                y={y - 4}
                width={rw + 8}
                height={rh + 8}
                rx="18"
              />
              {highlighted ? (
                <rect
                  class="sim-pulse"
                  x={x - 2}
                  y={y - 2}
                  width={rw + 4}
                  height={rh + 4}
                  rx="16"
                />
              ) : null}
            </g>
          );
        })}
        {hasPuck ? (
          <Puck x={puckPos.x} y={puckPos.y} r={layout.puckRadius} on={point !== null} />
        ) : null}
        <g
          class="sim-chips"
          style={chipMs !== undefined ? `--sim-chip-ms: ${Math.max(1, chipMs)}ms` : undefined}
        >
          {stacks.map((s) => {
            const nums = s.betIds.length;
            return (
              <g
                key={s.key}
                class={`sim-stack-hit${s.betIds.some((id) => wonIds.has(id)) ? ' is-won' : ''}`}
                role="button"
                tabindex={0}
                aria-label={`Edit ${s.caption ? `${betLabel(s.type)} ${s.caption}` : betLabel(s.type)} bet, ${fmtMoney(s.amount)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStackTap?.(s.betIds[0]!, s.betIds);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onStackTap?.(s.betIds[0]!, s.betIds);
                  }
                }}
                data-stack={s.betIds[0]}
                data-count={nums}
              >
                <ChipStack
                  x={s.x}
                  y={s.y}
                  amount={s.amount}
                  r={layout.chipRadius}
                  off={s.off}
                  {...(s.caption ? { caption: s.caption } : {})}
                />
              </g>
            );
          })}
          {travelling.map((b) => {
            // from the come / don't-come box to the number the bet now sits on
            const from = ghostPos({ ...b, point: null });
            const to = ghostPos(b);
            return from && to ? (
              <g
                key={'travel-' + b.id}
                class={`sim-ghost sim-ghost-travel${chipPhase === 'travel' ? ' is-moving' : ''}`}
                data-travel={b.id}
                style={`--dx: ${to.x - from.x}px; --dy: ${to.y - from.y}px`}
              >
                <ChipStack x={from.x} y={from.y} amount={b.amount} r={layout.chipRadius} />
              </g>
            ) : null;
          })}
          {(lostBets ?? []).map((b) => {
            const p = ghostPos(b);
            return p ? (
              <g
                key={'lost-' + b.id}
                class={`sim-ghost sim-ghost-lose${chipPhase === 'lose' ? ' is-moving' : ''}`}
                data-lost={b.id}
              >
                <ChipStack x={p.x} y={p.y} amount={b.amount} r={layout.chipRadius} />
              </g>
            ) : null;
          })}
          {(wonBets ?? []).map(({ bet, payout }) => {
            const p = ghostPos(bet);
            if (!p) return null;
            // a winner that comes down keeps its chips on the spot until the payout step ends
            const gone = !bets.some((b) => b.id === bet.id);
            return (
              <g key={'won-' + bet.id} data-won={bet.id}>
                {gone ? (
                  <g class="sim-ghost sim-ghost-settled">
                    <ChipStack x={p.x} y={p.y} amount={bet.amount} r={layout.chipRadius} />
                  </g>
                ) : null}
                {payout > 0 && chipPhase === 'win' ? (
                  <g
                    class="sim-ghost sim-ghost-win is-moving"
                    transform={`translate(${layout.chipRadius * 1.9} ${-layout.chipRadius * 0.6})`}
                  >
                    <ChipStack x={p.x} y={p.y} amount={payout} r={layout.chipRadius * 0.8} />
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {rollingDice ? (
        <div class="sim-dice-overlay" aria-hidden={rollingDice.dice ? undefined : true}>
          <Dice dice={rollingDice.dice} rolling durationMs={rollingDice.durationMs} />
        </div>
      ) : null}
    </div>
  );
}
