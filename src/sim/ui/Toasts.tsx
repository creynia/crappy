import { useEffect } from 'preact/hooks';
import type { ToastTone } from './text';
import './sim.css';

export interface ToastItem {
  id: string;
  text: string;
  tone?: ToastTone;
}
export interface ToastsProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
  /** auto-dismiss after this many ms (see toastDurationMs); omit to keep until dismissed */
  autoDismissMs?: number;
}

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
  return (
    <div class={`sim-toast sim-toast-${t.tone ?? 'info'}`}>
      <span>{t.text}</span>
      <button
        type="button"
        class="sim-toast-x"
        aria-label="Dismiss"
        onClick={() => onDismiss(t.id)}
      >
        ×
      </button>
    </div>
  );
}

export function Toasts({ toasts, onDismiss, autoDismissMs }: ToastsProps) {
  return (
    <div class="sim-toasts" aria-hidden="true">
      {toasts.map((t) => (
        <ToastView key={t.id} t={t} onDismiss={onDismiss} ms={autoDismissMs} />
      ))}
    </div>
  );
}
