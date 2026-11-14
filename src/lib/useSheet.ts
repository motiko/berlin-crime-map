import { useCallback, useEffect, useRef, useState } from 'react';

export type SheetState = 'peek' | 'half' | 'full';

const PHONE = '(max-width: 760px)';

/** Height in px of each snap point. Peek shows the filter bar and the incident count line. */
function heights(peekPx: number): Record<SheetState, number> {
  const vh = window.innerHeight;
  return { peek: peekPx + 44, half: Math.round(vh * 0.5), full: vh - 56 };
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/**
 * The incident panel as a bottom sheet on phones: drag the grip to resize it, it snaps to
 * peek, half or full height; tapping the grip steps up (and back down from full).
 * `peekRef` is the part that stays visible when collapsed.
 */
export function useSheet(initial: SheetState) {
  const [state, setState] = useState<SheetState>(initial);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [peekPx, setPeekPx] = useState(180);
  const drag = useRef<{ y: number; h: number; moved: boolean; t: number } | null>(null);

  useEffect(() => {
    const el = peekRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPeekPx(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = dragHeight ?? heights(peekPx)[state];

  const step = useCallback(() => setState((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'half')), []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, h: heights(peekPx)[state], moved: false, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const h = heights(peekPx);
    setDragHeight(Math.max(h.peek, Math.min(h.full, d.h - dy)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      step();
      return;
    }
    const h = heights(peekPx);
    const current = Math.max(h.peek, Math.min(h.full, d.h - (e.clientY - d.y)));
    const velocity = (d.y - e.clientY) / Math.max(1, performance.now() - d.t); // px/ms, up is positive
    const order: SheetState[] = ['peek', 'half', 'full'];
    let next = order.reduce((best, s) => (Math.abs(h[s] - current) < Math.abs(h[best] - current) ? s : best), state);
    // A quick flick moves at least one step in its direction, even if it did not travel far.
    if (Math.abs(velocity) > 0.5) {
      const dir = velocity > 0 ? 1 : -1;
      const flicked = Math.max(0, Math.min(2, order.indexOf(state) + dir));
      if ((order.indexOf(next) - flicked) * dir < 0) next = order[flicked];
    }
    setDragHeight(null);
    setState(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setState((s) => (s === 'peek' ? 'half' : 'full'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setState((s) => (s === 'full' ? 'half' : 'peek'));
    }
  };

  return {
    state,
    setState,
    height,
    dragging: dragHeight !== null,
    peekRef,
    peekPx,
    gripProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      // Enter / Space on the grip button (pointer taps are handled in onPointerUp).
      onClick: (e: React.MouseEvent) => e.detail === 0 && step(),
    },
  };
}
