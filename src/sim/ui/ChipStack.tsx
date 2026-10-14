import type { Cents } from '../engine/types';
import { fmtMoney } from './text';

export const CHIP_DENOMS: readonly Cents[] = [100, 500, 2500, 10000, 50000, 100000];

interface ChipStyle {
  fill: string;
  side: string;
  spot: string;
  ink: string;
  face: string;
}
const CHIP_STYLES: Record<number, ChipStyle> = {
  100: { fill: '#f1efe8', side: '#b9b6a8', spot: '#2f5fa8', ink: '#1f3d6e', face: '#fbfaf6' },
  500: { fill: '#c62d2d', side: '#7c1717', spot: '#ffffff', ink: '#ffffff', face: '#d94545' },
  2500: { fill: '#1f8a45', side: '#0f5128', spot: '#ffffff', ink: '#ffffff', face: '#2aa05a' },
  10000: { fill: '#26262b', side: '#0a0a0c', spot: '#ffffff', ink: '#ffffff', face: '#37373d' },
  50000: { fill: '#6f2f9a', side: '#40195c', spot: '#ffffff', ink: '#ffffff', face: '#8745b5' },
  100000: { fill: '#e0a81d', side: '#8c6609', spot: '#ffffff', ink: '#3a2a00', face: '#efbd3a' },
};

/** Largest standard denomination <= value (min $1). Used to pick a chip colour. */
export function chipDenomFor(value: Cents): Cents {
  let best: Cents = CHIP_DENOMS[0]!;
  for (const d of CHIP_DENOMS) if (d <= value) best = d;
  return best;
}

export function chipLabel(value: Cents): string {
  const dollars = value / 100;
  if (dollars >= 1000 && dollars % 1000 === 0) return `${dollars / 1000}K`;
  return Number.isInteger(dollars) ? `${dollars}` : dollars.toFixed(2);
}

/** Greedy chip breakdown, largest first. Remainder under $1 is shown as a $1 chip. */
export function chipBreakdown(amount: Cents): Cents[] {
  const out: Cents[] = [];
  let rest = Math.max(0, Math.round(amount));
  for (const d of [...CHIP_DENOMS].reverse()) {
    while (rest >= d) {
      out.push(d);
      rest -= d;
      if (out.length > 60) return out;
    }
  }
  if (rest > 0 || out.length === 0) out.push(100);
  return out;
}

/** A single chip face as SVG content centred on (0,0). */
export function ChipFace({ denom, r, label }: { denom: Cents; r: number; label?: string }) {
  const st = CHIP_STYLES[chipDenomFor(denom)]!;
  const ring = r * 0.86;
  const circ = 2 * Math.PI * ring;
  const dash = circ / 16;
  return (
    <g class="sim-chip-face">
      <circle r={r} fill={st.fill} stroke="rgba(0,0,0,0.45)" stroke-width={r * 0.05} />
      <circle
        r={ring}
        fill="none"
        stroke={st.spot}
        stroke-width={r * 0.26}
        stroke-dasharray={`${dash * 0.55} ${dash * 0.45}`}
        opacity={0.95}
      />
      <circle r={r * 0.66} fill={st.face} stroke={st.spot} stroke-width={r * 0.04} opacity={0.98} />
      <text
        y={r * 0.17}
        text-anchor="middle"
        font-size={r * (label && label.length > 3 ? 0.46 : 0.58)}
        font-weight="800"
        fill={st.ink}
        class="sim-chip-text"
      >
        {label ?? chipLabel(denom)}
      </text>
    </g>
  );
}

export interface ChipStackProps {
  x: number;
  y: number;
  amount: Cents;
  r?: number;
  /** bet is not working (e.g. place bets on the come-out) */
  off?: boolean;
  /** show a "$12" badge under the stack (default true) */
  badge?: boolean;
  class?: string;
}

const STACK_LIMIT = 5;

/** Up to 5 chips (offset -6 units each) plus an amount badge. Purely decorative: the region label announces the bet. */
export function ChipStack({ x, y, amount, r = 34, off, badge = true, class: cls }: ChipStackProps) {
  const chips = chipBreakdown(amount).slice(0, STACK_LIMIT);
  const bottomFirst = [...chips].reverse(); // largest at the bottom
  const thick = Math.max(4, r * 0.14);
  const text = fmtMoney(amount);
  const bw = Math.max(r * 1.5, text.length * r * 0.34 + r * 0.5);
  return (
    <g
      class={`sim-stack${off ? ' is-off' : ''}${cls ? ' ' + cls : ''}`}
      transform={`translate(${x} ${y})`}
      aria-hidden="true"
      data-amount={amount}
    >
      <ellipse cx={0} cy={r * 0.15} rx={r * 1.02} ry={r * 0.98} fill="rgba(0,0,0,0.35)" />
      {bottomFirst.map((d, i) => {
        const st = CHIP_STYLES[chipDenomFor(d)]!;
        const dy = -i * 6;
        return (
          <g key={i} transform={`translate(0 ${dy})`}>
            <circle r={r} cy={thick} fill={st.side} />
            <ChipFace denom={d} r={r} />
          </g>
        );
      })}
      {badge ? (
        <g transform={`translate(0 ${r + thick - 2})`} class="sim-stack-badge">
          <rect
            x={-bw / 2}
            y={-r * 0.42}
            width={bw}
            height={r * 0.84}
            rx={r * 0.42}
            fill="rgba(10,20,15,0.88)"
            stroke="#f8f5ec"
            stroke-width="2"
          />
          <text text-anchor="middle" y={r * 0.2} font-size={r * 0.58} font-weight="800" fill="#fff">
            {text}
          </text>
        </g>
      ) : null}
      {off ? (
        <g transform={`translate(${r * 0.7} ${-r * 0.7})`}>
          <rect
            x={-r * 0.6}
            y={-r * 0.3}
            width={r * 1.2}
            height={r * 0.6}
            rx={r * 0.15}
            fill="#111"
            stroke="#f5c542"
            stroke-width="2"
          />
          <text
            text-anchor="middle"
            y={r * 0.17}
            font-size={r * 0.42}
            font-weight="800"
            fill="#f5c542"
          >
            OFF
          </text>
        </g>
      ) : null}
    </g>
  );
}
