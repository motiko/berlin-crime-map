import type { Category } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';

export interface Filters {
  from: string;
  to: string;
  categories: Set<Category>;
  district: string;
  query: string;
}

/** All date math is in UTC on plain YYYY-MM-DD strings, so DST changes can't shift a day. */
export function isoDaysAgo(days: number, from: string = new Date().toISOString().slice(0, 10)): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function applyFilters(incidents: Incident[], f: Filters): Incident[] {
  const q = f.query.trim().toLowerCase();
  return incidents.filter(
    (i) =>
      i.date >= f.from &&
      i.date <= f.to &&
      f.categories.has(i.category) &&
      (!f.district || i.location === f.district) &&
      (!q || `${i.title} ${i.summary} ${i.place ?? ''}`.toLowerCase().includes(q)),
  );
}

export function countByCategory(incidents: Incident[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const i of incidents) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  return counts;
}

export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Day heading for the incident log, e.g. "Thu 12 Nov"; the year is added when it isn't the current one. */
export function formatDay(iso: string, currentYear = new Date().getFullYear()): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === currentYear ? {} : { year: 'numeric' }),
  });
}

/** The police's German labels for reports that are not tied to one district. */
const AREA_LABELS: Record<string, string> = {
  bezirksübergreifend: 'Several districts',
  berlinweit: 'Across Berlin',
  'Berlin/Brandenburg': 'Berlin and Brandenburg',
  bundeslandübergreifend: 'Berlin and other states',
  bundesweit: 'Across Germany',
};

/** Where an incident happened, in English: the street if known, otherwise the area. */
export function placeLabel(incident: { place: string | null; location: string | null }): string {
  if (incident.place) return incident.place;
  if (!incident.location) return 'Berlin';
  return AREA_LABELS[incident.location] ?? incident.location;
}
