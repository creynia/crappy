export interface PuckProps {
  x: number;
  y: number;
  r: number;
  on: boolean;
}

/** ON side is white with a black ON; OFF side is black with a white OFF. Moves with a CSS transform transition. */
export function Puck({ x, y, r, on }: PuckProps) {
  return (
    <g
      class={`sim-puck ${on ? 'is-on' : 'is-off'}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      role="img"
      aria-label={on ? 'Puck: ON' : 'Puck: OFF'}
      data-puck={on ? 'on' : 'off'}
    >
      <ellipse cx={0} cy={r * 0.16} rx={r} ry={r * 0.96} fill="rgba(0,0,0,0.4)" />
      <circle
        r={r}
        fill={on ? '#f8f5ec' : '#16181a'}
        stroke={on ? '#1a1a1a' : '#f8f5ec'}
        stroke-width={r * 0.07}
      />
      <circle
        r={r * 0.82}
        fill="none"
        stroke={on ? '#1a1a1a' : '#f8f5ec'}
        stroke-width={r * 0.035}
      />
      <text
        y={r * 0.2}
        text-anchor="middle"
        font-size={r * 0.62}
        font-weight="900"
        fill={on ? '#111' : '#f8f5ec'}
        letter-spacing="1"
      >
        {on ? 'ON' : 'OFF'}
      </text>
    </g>
  );
}
