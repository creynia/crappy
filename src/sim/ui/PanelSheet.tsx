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
/** A handle press that moves less than this (px) is a tap, not a drag. */
const TAP_SLOP_PX = 6;

/**
 * One bottom sheet (side panel in landscape) for the Session, Auto-roll, Log and Menu panels: tabs
 * switch between them (roving tabindex, arrow keys), a drag handle or Escape dismisses, Tab cycles
 * inside it and focus is handed back to the control that opened it. It is not modal: the table and
 * the tab row stay tappable, and Tab or Escape pressed anywhere on the page still act on the sheet.
 */
export function PanelSheet(p: PanelSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(p.onClose);
  onCloseRef.current = p.onClose;
  const [drag, setDrag] = useState<{ startY: number; dy: number } | null>(null);
  const moved = useRef(false);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const tabId = (id: PanelId) => `${uid}-tab-${id}`;

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

  // Focus trap at the document level: the sheet is not modal, so focus can start on a revealed
  // heading (tabindex -1) or wander to the table on a click; Tab always lands back inside, and
  // Escape closes from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = rootRef.current;
      if (!root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      let target: HTMLElement | undefined;
      if (!(active instanceof HTMLElement) || !root.contains(active)) {
        target = e.shiftKey ? last : first;
      } else {
        const i = nodes.indexOf(active);
        if (i === -1) {
          // inside the sheet but not in the tab order (a heading): continue from its position
          const after = nodes.find(
            (n) => active.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
          target = e.shiftKey
            ? (nodes[(after ? nodes.indexOf(after) : nodes.length) - 1] ?? last)
            : (after ?? first);
        } else if (!e.shiftKey && active === last) target = first;
        else if (e.shiftKey && active === first) target = last;
      }
      if (!target) return;
      e.preventDefault();
      target.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const onTabKey = (e: JSX.TargetedKeyboardEvent<HTMLButtonElement>) => {
    const i = p.tabs.findIndex((t) => t.id === p.active);
    const n = p.tabs.length;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    const id = p.tabs[next]!.id;
    p.onSelect(id);
    const el = rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(id))}`);
    el?.focus();
  };

  const onHandleDown = (e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (p.landscape) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    moved.current = false;
    setDrag({ startY: e.clientY, dy: 0 });
  };
  const onHandleMove = (e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = Math.max(0, e.clientY - drag.startY);
    if (Math.abs(e.clientY - drag.startY) > TAP_SLOP_PX) moved.current = true;
    setDrag({ startY: drag.startY, dy });
  };
  const onHandleUp = () => {
    if (!drag) return;
    const far = drag.dy >= DISMISS_DRAG_PX;
    setDrag(null);
    if (far) p.onClose();
  };
  const onHandleClick = () => {
    // a short drag that settled back is not a tap
    if (moved.current) {
      moved.current = false;
      return;
    }
    p.onClose();
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
        aria-label="Table panels"
        data-testid="panel-sheet"
        style={drag && drag.dy > 0 ? `transform: translateY(${drag.dy}px)` : undefined}
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
            onClick={onHandleClick}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <div class="sim-panel-head">
          <div class="sim-panel-tabs" role="tablist" aria-label="Panels">
            {p.tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={tabId(t.id)}
                class="sim-panel-tab"
                aria-selected={t.id === p.active}
                aria-controls={panelId}
                tabIndex={t.id === p.active ? 0 : -1}
                onClick={() => p.onSelect(t.id)}
                onKeyDown={onTabKey}
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
        <div class="sim-panel-body" role="tabpanel" id={panelId} aria-labelledby={tabId(p.active)}>
          {p.children}
        </div>
      </div>
    </div>
  );
}
