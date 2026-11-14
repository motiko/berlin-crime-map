import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  id: string;
  open: boolean;
  /** Matching incidents with the current filters, for the close button. */
  count: number;
  onClose: () => void;
  /** The Filters button: clicks on it toggle the panel instead of counting as "outside". */
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

/**
 * Dates, district and categories. On wide screens a panel that drops down over the list,
 * so the list keeps its place; on phones a full-screen sheet. Changes apply at once; the
 * button only closes it, and says how many incidents the filters leave.
 */
export function FilterPanel({ id, open, count, onClose, toggleRef, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || toggleRef.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer);
    // With a mouse, start in the first field. Not on touch screens: it would pop up the date picker.
    if (window.matchMedia('(pointer: fine)').matches) {
      ref.current?.querySelector<HTMLElement>('.filter-panel-body input, .filter-panel-body select')?.focus({ preventScroll: true });
    }
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, toggleRef]);

  if (!open) return null;
  // Closing with a button or Esc returns focus to the Filters button; a click elsewhere does not.
  const close = () => {
    onClose();
    toggleRef.current?.focus();
  };
  return (
    <div ref={ref} id={id} className="filter-panel" role="dialog" aria-label="Filters">
      <div className="filter-panel-head">
        <h2>Filters</h2>
        <button type="button" className="icon-button" onClick={close} aria-label="Close filters">
          ✕
        </button>
      </div>
      <div className="filter-panel-body">{children}</div>
      <div className="filter-panel-foot">
        <button type="button" className="primary wide" onClick={close}>
          {count === 0 ? 'No incidents match' : `Show ${count.toLocaleString('en-GB')} ${count === 1 ? 'incident' : 'incidents'}`}
        </button>
      </div>
    </div>
  );
}
