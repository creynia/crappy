import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import type { PointNumber } from '../engine/types';
import { DieFaceSvg } from './Dice';
import { HOP_BAND } from './layouts/hopSlots';
import { BOX_BAR, NOT_OFFERED, NUMBER_WORD } from './layouts/shared';
import type { RegionDef } from './layouts/types';

export interface ArtCtx {
  fieldPays: { 2: number; 12: number };
  point: PointNumber | null;
}

const WHITE = '#f4f1e6';
const YELLOW = '#f5c542';
const RED = '#e0392f';

function multWord(n: number): string {
  return n === 2 ? 'DOUBLE' : n === 3 ? 'TRIPLE' : `${n} TO 1`;
}

function Dice2({ x, y, a, b, s }: { x: number; y: number; a: number; b: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 100})`}>
      <g>
        <DieFaceSvg value={a} />
      </g>
      <g transform="translate(112 0)">
        <DieFaceSvg value={b} />
      </g>
    </g>
  );
}

/** The printed odds area of a line bet: a dashed circle at the region's `odds` chip spot. */
function OddsArea({ region, label }: { region: RegionDef; label: string }) {
  const p = region.chipSpots.odds;
  if (!p) return null;
  const r = region.rect.h * 0.33;
  return (
    <g class="sim-odds-area" data-odds-area={region.id}>
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill="rgba(0,0,0,0.12)"
        stroke={WHITE}
        stroke-width="2"
        stroke-dasharray="7 5"
        opacity="0.8"
      />
      {label.split(' ').map((word, i, all) => (
        <text
          key={word}
          x={p.x}
          y={p.y + r * 0.13 + (i - (all.length - 1) / 2) * r * 0.42}
          class="sim-tiny"
          font-size={r * 0.36}
          text-anchor="middle"
          fill={YELLOW}
        >
          {word}
        </text>
      ))}
    </g>
  );
}

function outline(r: RegionDef, stroke: string, fill: string, rx = 14): JSX.Element {
  const { x, y, w, h } = r.rect;
  if (r.shape === 'pass-arc') {
    const big = Math.min(70, h / 2);
    const d = `M ${x + 14} ${y} H ${x + w - 14} Q ${x + w} ${y} ${x + w} ${y + 14} V ${y + h - big} Q ${x + w} ${y + h} ${x + w - big} ${y + h} H ${x + big} Q ${x} ${y + h} ${x} ${y + h - big} V ${y + 14} Q ${x} ${y} ${x + 14} ${y} Z`;
    return (
      <g>
        <path d={d} fill={fill} stroke={stroke} stroke-width="3.5" />
        <path
          d={`M ${x + 14} ${y + 14} H ${x + w - 14} V ${y + h - big - 6} Q ${x + w - 14} ${y + h - 14} ${x + w - big - 6} ${y + h - 14} H ${x + big + 6} Q ${x + 14} ${y + h - 14} ${x + 14} ${y + h - big - 6} Z`}
          fill="none"
          stroke={stroke}
          stroke-width="1.5"
          opacity="0.55"
        />
      </g>
    );
  }
  return (
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} stroke-width="3.5" />
  );
}

const BONUS_PIPS: Record<'fire' | 'all' | 'tall' | 'small', readonly number[]> = {
  fire: [4, 5, 6, 8, 9, 10],
  all: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
  tall: [8, 9, 10, 11, 12],
  small: [2, 3, 4, 5, 6],
};

/** Bonus side-bet cell: title, paytable line and one pip per number still to collect / collected. */
function BonusArt({ region, progress }: { region: RegionDef; progress: readonly number[] }) {
  const { x, y, w, h } = region.rect;
  const id = region.id as keyof typeof BONUS_PIPS;
  const pips = BONUS_PIPS[id];
  const fire = id === 'fire';
  const accent = fire ? '#ff9a3c' : YELLOW;
  const have = new Set(progress);
  const left = x + 24;
  const right = x + w * 0.72;
  const perRow = pips.length > 6 ? Math.ceil(pips.length / 2) : pips.length;
  const rows = Math.ceil(pips.length / perRow);
  const step = (right - left) / perRow;
  const r = Math.min(rows > 1 ? 15 : 16, step * 0.42);
  const rowY = (row: number) => (rows > 1 ? y + h * (0.64 + row * 0.23) : y + h * 0.78);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill={fire ? 'rgba(200,70,20,0.3)' : 'rgba(20,20,20,0.22)'}
        stroke={accent}
        stroke-width="3.5"
      />
      <text
        x={left}
        y={y + h * 0.3}
        class="sim-label"
        font-size={h * 0.24}
        text-anchor="start"
        fill={accent}
      >
        {region.label.toUpperCase()}
      </text>
      <text
        x={left}
        y={y + h * (rows > 1 ? 0.47 : 0.52)}
        class="sim-tiny"
        font-size={h * 0.12}
        text-anchor="start"
        fill={WHITE}
        opacity="0.9"
      >
        {(region.sublabel ?? '').toUpperCase()}
      </text>
      <g class="sim-pips" aria-hidden="true">
        {pips.map((n, i) => {
          const px = left + step * (i % perRow) + r;
          const py = rowY(Math.floor(i / perRow));
          const on = have.has(n);
          return (
            <g key={n} class={on ? 'is-hit' : ''}>
              <circle
                cx={px}
                cy={py}
                r={r}
                fill={on ? accent : 'rgba(0,0,0,0.25)'}
                stroke={on ? accent : WHITE}
                stroke-width="2"
                opacity={on ? 1 : 0.7}
              />
              <text
                x={px}
                y={py + r * 0.4}
                class="sim-tiny"
                font-size={r * 1.15}
                text-anchor="middle"
                fill={on ? '#1a1a1a' : WHITE}
                font-weight={on ? 700 : 400}
              >
                {n}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

/** The don't-side "BAR 12" print, or NOT OFFERED on a table without a don't side (crapless). */
function barText(region: RegionDef): string {
  return region.sublabel === NOT_OFFERED ? 'NOT OFFERED' : 'BAR 12';
}

/** Visual content of a betting region: borders, numerals, printed labels. No interaction here. */
function RegionArtImpl({
  region,
  ctx,
  progress,
}: {
  region: RegionDef;
  ctx: ArtCtx;
  /** bonus side bets: numbers collected so far (undefined for every other region) */
  progress?: readonly number[];
}) {
  const { x, y, w, h } = region.rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const id = region.id;
  if (id === 'fire' || id === 'all' || id === 'tall' || id === 'small')
    return <BonusArt region={region} progress={progress ?? []} />;

  if (id.startsWith('box-')) {
    const n = Number(id.slice(4)) as PointNumber;
    const word = NUMBER_WORD[n];
    const fs = word.length > 2 ? h * 0.17 : h * 0.34;
    const isPoint = ctx.point === n;
    return (
      <g>
        {outline(region, WHITE, isPoint ? 'rgba(245,197,66,0.14)' : 'rgba(0,0,0,0.07)')}
        {/* top bar: don't come and lay bets */}
        <rect
          class="sim-box-bar"
          x={x + 6}
          y={y + 6}
          width={w - 12}
          height={h * BOX_BAR - 6}
          rx="9"
          fill="rgba(0,0,0,0.14)"
        />
        <line
          x1={x + 8}
          x2={x + w - 8}
          y1={y + h * BOX_BAR}
          y2={y + h * BOX_BAR}
          stroke={WHITE}
          stroke-width="1.5"
          opacity="0.45"
        />
        <text
          x={cx}
          y={y + h * 0.47 + fs * 0.34}
          class="sim-num"
          font-size={fs}
          text-anchor="middle"
          fill={WHITE}
        >
          {word}
        </text>
        <text
          x={cx}
          y={y + h * 0.63}
          class="sim-tiny"
          font-size={h * 0.062}
          text-anchor="middle"
          fill={WHITE}
          opacity="0.75"
        >
          {(region.sublabel ?? '').toUpperCase().replace('PLACE PAYS', 'PAYS')}
        </text>
      </g>
    );
  }

  switch (id) {
    case 'pass':
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          <text
            x={cx + w * 0.06}
            y={cy + h * 0.12}
            class="sim-label"
            font-size={h * 0.4}
            text-anchor="middle"
            fill={WHITE}
          >
            PASS LINE
          </text>
          <OddsArea region={region} label="ODDS" />
        </g>
      );
    case 'dont-pass': {
      const s = Math.min(48, h * 0.45);
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          <text
            x={cx + w * 0.04}
            y={cy + h * 0.06}
            class="sim-label"
            font-size={h * 0.33}
            text-anchor="middle"
            fill={WHITE}
          >
            DON'T PASS BAR
          </text>
          <Dice2 x={cx + w * 0.28} y={cy - s / 2 + 1} a={6} b={6} s={s} />
          <text
            x={cx + w * 0.04}
            y={y + h - 11}
            class="sim-tiny"
            font-size={h * 0.14}
            text-anchor="middle"
            fill={YELLOW}
          >
            {barText(region)}
          </text>
          <OddsArea region={region} label="LAY ODDS" />
        </g>
      );
    }
    case 'come':
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          <text
            x={cx - w * 0.04}
            y={cy + h * 0.17}
            class="sim-label"
            font-size={h * 0.5}
            text-anchor="middle"
            fill={WHITE}
          >
            COME
          </text>
          <path
            d={`M ${x + w * 0.2} ${cy} l 18 -18 l 18 18 l -18 18 Z`}
            fill="none"
            stroke={WHITE}
            stroke-width="2.5"
          />
          <path
            d={`M ${x + w - w * 0.2 - 36} ${cy} l 18 -18 l 18 18 l -18 18 Z`}
            fill="none"
            stroke={WHITE}
            stroke-width="2.5"
          />
        </g>
      );
    case 'dont-come': {
      const tall = h > w * 0.8;
      const s = tall ? Math.min(34, h * 0.16) : Math.min(30, h * 0.27);
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          {tall ? (
            <>
              <text
                x={cx}
                y={y + h * 0.2}
                class="sim-label"
                font-size={h * 0.14}
                text-anchor="middle"
                fill={WHITE}
              >
                DON'T
              </text>
              <text
                x={cx}
                y={y + h * 0.34}
                class="sim-label"
                font-size={h * 0.14}
                text-anchor="middle"
                fill={WHITE}
              >
                COME
              </text>
              <Dice2 x={cx - s - 6} y={y + h * 0.76} a={6} b={6} s={s} />
              <text
                x={cx}
                y={y + h - 6}
                class="sim-tiny"
                font-size={h * 0.06}
                text-anchor="middle"
                fill={YELLOW}
              >
                {barText(region)}
              </text>
            </>
          ) : (
            <>
              <text
                x={x + 20}
                y={cy + h * 0.1}
                class="sim-label"
                font-size={h * 0.28}
                text-anchor="start"
                textLength={w * 0.5}
                lengthAdjust="spacingAndGlyphs"
                fill={WHITE}
              >
                DON'T COME
              </text>
              <Dice2 x={x + w * 0.64} y={cy - s / 2 - 8} a={6} b={6} s={s} />
              <text
                x={x + w * 0.64 + s}
                y={y + h - 12}
                class="sim-tiny"
                font-size={h * 0.13}
                text-anchor="middle"
                fill={YELLOW}
              >
                {barText(region)}
              </text>
            </>
          )}
        </g>
      );
    }
    case 'field': {
      const nums = [2, 3, 4, 9, 10, 11, 12];
      const step = (w - 140) / (nums.length - 1);
      const fs = Math.min(h * 0.3, 44);
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          {nums.map((n, i) => {
            const nx = x + 70 + i * step;
            const special = n === 2 || n === 12;
            return (
              <g key={n}>
                {special ? (
                  <circle
                    cx={nx}
                    cy={y + h * 0.3}
                    r={fs * 0.95}
                    fill="none"
                    stroke={YELLOW}
                    stroke-width="3"
                  />
                ) : null}
                <text
                  x={nx}
                  y={y + h * 0.3 + fs * 0.35}
                  class="sim-num"
                  font-size={fs}
                  text-anchor="middle"
                  fill={special ? YELLOW : WHITE}
                >
                  {n}
                </text>
                {special ? (
                  <text
                    x={nx}
                    y={y + h * 0.3 + fs * 1.55}
                    class="sim-tiny"
                    font-size={fs * 0.4}
                    text-anchor="middle"
                    fill={YELLOW}
                  >
                    {multWord(ctx.fieldPays[n])}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text
            x={x + w * 0.36}
            y={y + h * 0.88}
            class="sim-label"
            font-size={h * 0.22}
            text-anchor="middle"
            fill={WHITE}
            letter-spacing="8"
          >
            FIELD
          </text>
        </g>
      );
    }
    case 'big-6':
    case 'big-8': {
      const n = id === 'big-6' ? '6' : '8';
      return (
        <g>
          {outline(region, WHITE, 'rgba(0,0,0,0.05)')}
          <text
            x={x + w * 0.2}
            y={y + h * 0.84}
            class="sim-num"
            font-size={h * 0.8}
            text-anchor="middle"
            fill={RED}
            opacity="0.9"
          >
            {n}
          </text>
          <text
            x={x + w * 0.2}
            y={y + h * 0.2}
            class="sim-label"
            font-size={h * 0.17}
            text-anchor="middle"
            fill={WHITE}
          >
            BIG
          </text>
          <text
            x={x + w * 0.68}
            y={y + h * 0.92}
            class="sim-tiny"
            font-size={h * 0.11}
            text-anchor="middle"
            fill={WHITE}
            opacity="0.8"
          >
            PAYS 1 TO 1
          </text>
        </g>
      );
    }
  }

  // ---- hop bets (I035): title in a top band, the rest holds one chip stack per pair ----
  if (id === 'hop') {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="14"
          fill="rgba(20,20,20,0.22)"
          stroke={WHITE}
          stroke-width="3.5"
        />
        <text x={x + 28} y={y + 42} class="sim-label" font-size="36" fill={WHITE}>
          HOP BETS
        </text>
        {/* the title band never holds chips, so it stays a tap target for a new hop */}
        <g opacity="0.9">
          <rect
            x={x + 236}
            y={y + 12}
            width={150}
            height={34}
            rx={17}
            fill="none"
            stroke={WHITE}
            stroke-width="2"
          />
          <text
            x={x + 311}
            y={y + 35}
            class="sim-tiny"
            font-size="17"
            text-anchor="middle"
            fill={WHITE}
          >
            + ADD A HOP
          </text>
        </g>
        <text
          x={x + w - 28}
          y={y + 40}
          class="sim-tiny"
          font-size="17"
          text-anchor="end"
          fill={WHITE}
        >
          {(region.sublabel ?? '').toUpperCase()}
        </text>
        <line
          x1={x + 20}
          x2={x + w - 20}
          y1={y + HOP_BAND}
          y2={y + HOP_BAND}
          stroke={WHITE}
          stroke-opacity="0.25"
          stroke-width="2"
        />
      </g>
    );
  }

  // ---- center (proposition) cells ----
  const hard = /^hard-(\d+)$/.exec(id);
  let dice: [number, number] | null = null;
  let title = region.label.toUpperCase();
  let accent = YELLOW;
  let fill = 'rgba(160,20,20,0.28)';
  if (hard) {
    const half = Number(hard[1]) / 2;
    dice = [half, half];
    title = `HARD ${hard[1]}`;
  } else if (id === 'any-7') {
    title = 'ANY SEVEN';
    fill = 'rgba(190,28,28,0.55)';
    accent = '#fff3c4';
  } else if (id === 'aces-2') dice = [1, 1];
  else if (id === 'ace-deuce-3') dice = [1, 2];
  else if (id === 'yo-11') dice = [5, 6];
  else if (id === 'boxcars-12') dice = [6, 6];
  else if (id === 'any-craps') {
    title = 'ANY CRAPS';
    fill = 'rgba(190,28,28,0.45)';
  } else {
    fill = 'rgba(20,20,20,0.22)';
    accent = WHITE;
  }
  const wideCell = w > 700;
  const smallCell = w < 250; // the four one-roll number cells
  const tx = wideCell ? x + w * 0.42 : hard ? x + w * 0.58 : smallCell ? cx : x + w * 0.38;
  const ds = hard ? Math.min(h * 0.34, 40) : Math.min(h * 0.3, 34);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill={fill}
        stroke={accent}
        stroke-width="3.5"
      />
      <text
        x={tx}
        y={y + h * (smallCell ? 0.32 : 0.46)}
        class="sim-label"
        font-size={wideCell ? h * 0.36 : smallCell ? h * 0.2 : hard ? h * 0.3 : h * 0.26}
        text-anchor="middle"
        fill={accent}
      >
        {title}
      </text>
      <text
        x={smallCell ? x + w * 0.07 : tx}
        y={y + h * (smallCell ? 0.9 : 0.8)}
        class="sim-tiny"
        font-size={h * (smallCell ? 0.12 : 0.15)}
        text-anchor={smallCell ? 'start' : 'middle'}
        fill={WHITE}
      >
        {(region.sublabel ?? '').toUpperCase()}
      </text>
      {dice ? (
        hard ? (
          <Dice2 x={x + w * 0.06} y={cy - ds / 2} a={dice[0]} b={dice[1]} s={ds} />
        ) : (
          <Dice2 x={x + w * 0.08} y={y + h * 0.46} a={dice[0]} b={dice[1]} s={ds} />
        )
      ) : null}
    </g>
  );
}

export const RegionArt = memo(
  RegionArtImpl,
  (a, b) =>
    a.region === b.region &&
    a.ctx.point === b.ctx.point &&
    a.ctx.fieldPays[2] === b.ctx.fieldPays[2] &&
    a.ctx.fieldPays[12] === b.ctx.fieldPays[12] &&
    (a.progress ?? []).join() === (b.progress ?? []).join(),
);
