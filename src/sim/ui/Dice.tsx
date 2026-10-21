import './sim.css';
import { useEffect, useState } from 'preact/hooks';
import type { Dice as DicePair } from '../engine/types';
import { tumbleFaces } from './animation';
import { diceAriaLabel } from './text';

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [3, 1],
    [1, 3],
    [3, 3],
  ],
  5: [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
  ],
  6: [
    [1, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [1, 3],
    [3, 3],
  ],
};

/** One die face as SVG content in a 0..100 box. */
export function DieFaceSvg({
  value,
  ink = '#b3202a',
  body = '#f8f5ec',
}: {
  value: number;
  ink?: string;
  body?: string;
}) {
  return (
    <g>
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="16"
        fill={body}
        stroke="rgba(0,0,0,0.5)"
        stroke-width="3"
      />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx * 25} cy={cy * 25} r={value === 1 ? 14 : 9.5} fill={ink} />
      ))}
    </g>
  );
}

/** Small standalone die, used in cells and the history strip. */
export function DieIcon({ value, size = 24 }: { value: number; size?: number }) {
  return (
    <svg class="sim-die-icon" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <DieFaceSvg value={value} />
    </svg>
  );
}

export interface DiceProps {
  /** final faces; null shows nothing (or blank dice while rolling) */
  dice: DicePair | null;
  rolling?: boolean;
  /** tumble duration in ms (CSS animation + face cycling) */
  durationMs?: number;
  size?: 'sm' | 'lg';
}

/** Two HTML dice with a CSS 2D tumble (translate + rotate) and 3 random intermediate faces. */
export function Dice({ dice, rolling = false, durationMs = 1000, size = 'lg' }: DiceProps) {
  const [face, setFace] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!rolling) {
      setFace(null);
      return;
    }
    const faces = tumbleFaces();
    let i = 0;
    setFace(faces[0]!);
    const step = Math.max(40, durationMs / (faces.length + 1));
    const t = setInterval(() => {
      i += 1;
      if (i < faces.length) setFace(faces[i]!);
      else setFace(null);
    }, step);
    return () => clearInterval(t);
  }, [rolling, durationMs]);

  const shown: readonly [number, number] | null = rolling ? (face ?? dice) : dice;
  const label = dice && !rolling ? diceAriaLabel(dice) : rolling ? 'Dice rolling' : 'No roll yet';
  return (
    <div
      class={`sim-dice sim-dice-${size}${rolling ? ' is-rolling' : ''}`}
      role="img"
      aria-label={label}
      style={{ '--sim-tumble': `${durationMs}ms` }}
    >
      {[0, 1].map((i) => (
        <span class={`sim-die sim-die-${i}`} key={i}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            {shown ? (
              <DieFaceSvg value={shown[i]!} />
            ) : (
              <rect
                x="4"
                y="4"
                width="92"
                height="92"
                rx="16"
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.4)"
                stroke-width="3"
              />
            )}
          </svg>
        </span>
      ))}
    </div>
  );
}
