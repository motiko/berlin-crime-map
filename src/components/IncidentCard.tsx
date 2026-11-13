import { useEffect } from 'react';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import { CATEGORY_META } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';
import { formatDate, placeLabel } from '../lib/filter.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface Props {
  incident: Incident;
  /** Position in the list the user is browsing (1-based), or null if it isn't in it. */
  position: { index: number; total: number } | null;
  onNewer: (() => void) | null;
  onOlder: (() => void) | null;
  onClose: () => void;
}

const PRECISION_NOTE = {
  street: null,
  district: 'Shown at the district centre: the report names no street.',
  none: 'Not on the map: the report covers several districts or places outside Berlin.',
} as const;

/** Details of the selected incident, floating over the map (a bottom sheet on phones). */
export function IncidentCard({ incident, position, onNewer, onOlder, onClose }: Props) {
  const meta = CATEGORY_META[incident.category];
  const harm = [
    incident.dead ? `${incident.dead} dead` : null,
    incident.injured ? `${incident.injured} injured` : null,
  ].filter(Boolean);

  // Escape closes; [ and ] step through the list, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, select, textarea, dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === '[' && onNewer) onNewer();
      else if (e.key === ']' && onOlder) onOlder();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNewer, onOlder]);

  return (
    <article className="card" aria-labelledby="card-title" aria-live="polite">
      <header className="card-head">
        <span className="badge">
          <CategoryIcon category={incident.category} size={20} />
          {meta.label}
        </span>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close details" title="Close (Esc)">
          <X size={18} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="card-body">
        <h2 id="card-title">{incident.summary}</h2>
        <dl>
          <dt>Date</dt>
          <dd>{formatDate(incident.date)}</dd>
          <dt>Where</dt>
          <dd>{placeLabel(incident)}</dd>
          {harm.length > 0 && (
            <>
              <dt>Harm</dt>
              <dd>{harm.join(', ')}</dd>
            </>
          )}
          <dt>Original title</dt>
          <dd lang="de">{incident.title}</dd>
        </dl>
        {PRECISION_NOTE[incident.precision] && <p className="note">{PRECISION_NOTE[incident.precision]}</p>}
        <a className="source" href={incident.url} target="_blank" rel="noreferrer">
          Read the police report (German) ↗
        </a>
      </div>

      <footer className="card-nav">
        <button type="button" className="step" onClick={onNewer ?? undefined} disabled={!onNewer} title="Newer incident ([)">
          <CaretLeft size={16} weight="bold" aria-hidden />
          Newer
        </button>
        {position && (
          <span className="card-pos">
            {position.index.toLocaleString('en-GB')} of {position.total.toLocaleString('en-GB')}
          </span>
        )}
        <button type="button" className="step" onClick={onOlder ?? undefined} disabled={!onOlder} title="Older incident (])">
          Older
          <CaretRight size={16} weight="bold" aria-hidden />
        </button>
      </footer>
    </article>
  );
}
