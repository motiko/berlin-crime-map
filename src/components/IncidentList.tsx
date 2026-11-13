import { useEffect, useRef, useState } from 'react';
import type { Incident } from '../../shared/types.ts';
import { formatDay, placeLabel } from '../lib/filter.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface Props {
  /** Sorted newest first. */
  incidents: Incident[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PAGE = 100;

/** Split a newest-first list into runs of the same day. */
function byDay(incidents: Incident[]): { day: string; items: Incident[] }[] {
  const days: { day: string; items: Incident[] }[] = [];
  for (const incident of incidents) {
    const day = incident.date.slice(0, 10);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(incident);
    else days.push({ day, items: [incident] });
  }
  return days;
}

export function IncidentList({ incidents, total, selectedId, onSelect }: Props) {
  const [shown, setShown] = useState(PAGE);
  const listRef = useRef<HTMLElement>(null);

  // Bring the selected incident into the list (picked on the map or with Newer / Older).
  const selectedIndex = selectedId ? incidents.findIndex((i) => i.id === selectedId) : -1;
  if (selectedIndex >= shown) setShown(Math.ceil((selectedIndex + 1) / PAGE) * PAGE);
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
  const days = byDay(incidents.slice(0, shown));
  // Count from the full list, so a day cut off by paging still shows its real total.
  const perDay = new Map<string, number>();
  for (const i of incidents) perDay.set(i.date.slice(0, 10), (perDay.get(i.date.slice(0, 10)) ?? 0) + 1);

  return (
    <section ref={listRef} className="list" aria-labelledby="list-label">
      <h2 id="list-label" className="list-head">
        {incidents.length === total
          ? `${total.toLocaleString('en-GB')} incidents`
          : `${incidents.length.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} incidents in the map view`}
      </h2>
      {incidents.length === 0 ? (
        <p className="empty">Nothing matches these filters here. Choose a longer time range, zoom out or show all categories.</p>
      ) : (
        days.map(({ day, items }) => (
          <section key={day} className="day" aria-label={formatDay(day)}>
            <h3 className="day-stamp">
              <time dateTime={day}>{formatDay(day)}</time>
              <span className="day-count">{perDay.get(day)}</span>
            </h3>
            <ol>
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" className="item" aria-current={i.id === selectedId} onClick={() => onSelect(i.id)}>
                    <CategoryIcon category={i.category} />
                    <span className="item-body">
                      <span className="item-summary">{i.summary}</span>
                      <span className="item-meta">{placeLabel(i)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
      {incidents.length > shown && (
        <button type="button" className="more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, incidents.length - shown)} more
        </button>
      )}
    </section>
  );
}
