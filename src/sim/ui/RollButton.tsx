import './sim.css';

export interface RollButtonProps {
  onRoll: () => void;
  disabled?: boolean;
  rolling?: boolean;
  /** e.g. "Expected cost: $0.42" */
  costText?: string;
  /** id of the element that says why Roll is locked */
  describedBy?: string;
  /** optional long press (dev mode: set dice) */
  onLongPress?: () => void;
}

export function RollButton({
  onRoll,
  disabled,
  rolling,
  costText,
  describedBy,
  onLongPress,
}: RollButtonProps) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  const down = () => {
    if (!onLongPress) return;
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      onLongPress();
    }, 600);
  };
  const up = () => clearTimeout(timer);
  return (
    <button
      type="button"
      class="sim-roll"
      disabled={disabled}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onClick={() => {
        if (fired) return;
        onRoll();
      }}
    >
      <span class="sim-roll-label">{rolling ? 'Rolling…' : 'Roll'}</span>
      {costText ? <span class="sim-roll-cost">{costText}</span> : null}
    </button>
  );
}
