import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { Panels } from './SimControls';

export type PanelId = keyof Panels;

export interface PanelTab {
  id: PanelId;
  label: string;
}

export interface PanelSheetProps {
  /** the panel shown now */
  active: PanelId;
  tabs: readonly PanelTab[];
  onSelect: (id: PanelId) => void;
  onClose: () => void;
  /** landscape: a side panel next to the table, like the bet sheet */
  landscape: boolean;
  /** the roll stays reachable from the sheet */
  roll?: { onRoll: () => void; disabled: boolean; busy: boolean };
  children: ComponentChildren;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Dragging the handle this far down (px) dismisses the sheet. */
export const DISMISS_DRAG_PX = 80;

/**
 * One bottom sheet (side panel in landscape) for the Session, Auto-roll, Log and Menu panels: tabs
 * switch between them, a drag handle or Escape dismisses, Tab cycles inside it and focus is handed
 * back to the control that opened it. It is not modal: the table and the tab row stay tappable.
 */
export function PanelSheet(p: PanelSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [drag, setDrag] = useState<{ startY: number; dy: number } | null>(null);
  const labelId = useId();

  // remember what opened the sheet and hand focus back to it on close
  useEffect(() => {
    opener.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      const el = opener.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    };
  }, []);
  // the menu has no heading of its own to receive focus: start on its first control
  useEffect(() => {
    if (p.active !== 'menu') return;
    const first = rootRef.current?.querySelector<HTMLElement>('.sim-panel-body ' + FOCUSABLE);
    first?.focus({ preventScroll: true });
  }, [p.active]);

  const onKey = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      p.onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!nodes.length) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !rootRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onHandleDown = (e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (p.landscape) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ startY: e.clientY, dy: 0 });
  };
  const onHandleMove = (e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    setDrag({ startY: drag.startY, dy: Math.max(0, e.clientY - drag.startY) });
  };
  const onHandleUp = () => {
    if (!drag) return;
    const far = drag.dy >= DISMISS_DRAG_PX;
    setDrag(null);
    if (far) p.onClose();
  };

  return (
    // The backdrop only positions the sheet: taps go through to the table and the tab row, so the
    // dice and the other panels stay one tap away (the sheet is not modal).
    <div
      class={`sim-sheet-backdrop sim-sheet-${p.landscape ? 'panel' : 'sheet'} sim-panel-backdrop`}
    >
      <div
        ref={rootRef}
        class={`sim-sheet sim-panel-sheet${drag ? ' is-dragging' : ''}`}
        role="dialog"
        aria-labelledby={labelId}
        data-testid="panel-sheet"
        style={drag && drag.dy > 0 ? `transform: translateY(${drag.dy}px)` : undefined}
        onKeyDown={onKey}
      >
        {!p.landscape ? (
          <button
            type="button"
            class="sim-panel-handle"
            aria-label="Close panel (drag down or tap)"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={() => setDrag(null)}
            onClick={() => {
              if (!drag) p.onClose();
            }}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <div class="sim-panel-head">
          <div class="sim-panel-tabs" role="tablist" aria-label="Table panels" id={labelId}>
            {p.tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                class="sim-panel-tab"
                aria-selected={t.id === p.active}
                onClick={() => p.onSelect(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {p.roll ? (
            <button
              type="button"
              class="sim-panel-throw"
              aria-label="Throw the dice"
              disabled={p.roll.disabled}
              onClick={p.roll.onRoll}
            >
              {p.roll.busy ? 'Rolling…' : 'Throw'}
            </button>
          ) : null}
          <button
            type="button"
            class="sim-panel-close"
            aria-label="Close panel"
            onClick={p.onClose}
          >
            ×
          </button>
        </div>
        <div class="sim-panel-body" role="tabpanel">
          {p.children}
        </div>
      </div>
    </div>
  );
}
