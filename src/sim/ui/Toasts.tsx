import { useEffect, useRef, useState } from 'preact/hooks';
import type { ToastTone } from './text';
import './sim.css';

export interface ToastItem {
  id: string;
  text: string;
  tone?: ToastTone;
  /** a roll's result toast (hidden, not dismissed, while the odds nudge is up) */
  roll?: boolean;
}
export interface ToastsProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
  /** auto-dismiss after this many ms (see toastDurationMs); omit to keep until dismissed */
  autoDismissMs?: number;
  /** keep the toasts (and their timers) but do not show them, e.g. while a prompt takes their place */
  hidden?: boolean;
}

const SWIPE_PX = 60;
const TAP_PX = 10;

function ToastView({
  t,
  onDismiss,
  ms,
}: {
  t: ToastItem;
  onDismiss: (id: string) => void;
  ms?: number;
}) {
  useEffect(() => {
    if (!ms) return;
    const h = setTimeout(() => onDismiss(t.id), ms);
    return () => clearTimeout(h);
  }, [t.id, ms]);
  // swipe sideways to dismiss: follow the finger, then go if far enough
  const [dx, setDx] = useState(0);
  const start = useRef<{ id: number; x: number } | null>(null);
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { id: e.pointerId, x: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (start.current?.id === e.pointerId) setDx(e.clientX - start.current.x);
  };
  const onUp = (e: PointerEvent) => {
    if (start.current?.id !== e.pointerId) return;
    const moved = e.clientX - start.current.x;
    start.current = null;
    // a swipe, or a tap that barely moved, dismisses
    if (Math.abs(moved) > SWIPE_PX || Math.abs(moved) < TAP_PX) onDismiss(t.id);
    else setDx(0);
  };
  return (
    <div
      class={`sim-toast sim-toast-${t.tone ?? 'info'}`}
      style={
        dx
          ? { transform: `translateX(${dx}px)`, opacity: 1 - Math.min(0.6, Math.abs(dx) / 200) }
          : undefined
      }
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <span>{t.text}</span>
      <button
        type="button"
        class="sim-toast-x"
        aria-label={`Dismiss: ${t.text}`}
        onClick={() => onDismiss(t.id)}
      >
        ×
      </button>
    </div>
  );
}

export function Toasts({ toasts, onDismiss, autoDismissMs, hidden }: ToastsProps) {
  return (
    <div class="sim-toasts" hidden={hidden}>
      {toasts.map((t) => (
        <ToastView key={t.id} t={t} onDismiss={onDismiss} ms={autoDismissMs} />
      ))}
    </div>
  );
}
