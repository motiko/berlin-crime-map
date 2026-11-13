import { useState } from 'react';
import { CATEGORY_META } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';
import { formatDate } from '../lib/filter.ts';

interface Props {
  incidents: Incident[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PAGE = 100;

export function IncidentList({ incidents, total, selectedId, onSelect }: Props) {
  const [shown, setShown] = useState(PAGE);

  return (
    <section className="list" aria-label="Incidents">
      <p className="list-head">
        {incidents.length === total
          ? `${total} incidents`
          : `${incidents.length} of ${total} incidents in the map view`}
      </p>
      {incidents.length === 0 ? (
        <p className="empty">No incidents match these filters. Try a longer time range or zoom out.</p>
      ) : (
        <ol>
          {incidents.slice(0, shown).map((i) => (
            <li key={i.id}>
              <button type="button" className="item" aria-current={i.id === selectedId} onClick={() => onSelect(i.id)}>
                <span className="dot" style={{ background: CATEGORY_META[i.category].color }} aria-hidden />
                <span className="item-body">
                  <span className="item-summary">{i.summary}</span>
                  <span className="item-meta">
                    {formatDate(i.date)} · {i.place ?? i.location ?? 'Berlin'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {incidents.length > shown && (
        <button type="button" className="more" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({incidents.length - shown} left)
        </button>
      )}
    </section>
  );
}
