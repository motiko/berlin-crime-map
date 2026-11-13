import { CATEGORY_META } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';
import { formatDate, placeLabel } from '../lib/filter.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface Props {
  incident: Incident;
  onClose: () => void;
}

const PRECISION_NOTE = {
  street: null,
  district: 'Shown at the district centre: the report names no street.',
  none: 'Not on the map: the report covers several districts or places outside Berlin.',
} as const;

export function IncidentCard({ incident, onClose }: Props) {
  const meta = CATEGORY_META[incident.category];
  const harm = [
    incident.dead ? `${incident.dead} dead` : null,
    incident.injured ? `${incident.injured} injured` : null,
  ].filter(Boolean);

  return (
    <article className="card" aria-labelledby={`card-${incident.id}`}>
      <header>
        <span className="badge">
          <CategoryIcon category={incident.category} size={20} />
          {meta.label}
        </span>
        <button type="button" className="close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>
      <h2 id={`card-${incident.id}`}>{incident.summary}</h2>
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
    </article>
  );
}
