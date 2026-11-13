import { CATEGORIES, type Category, isDistrict } from '../../shared/categories.ts';
import { type Filters, isoDaysAgo } from './filter.ts';

/**
 * Filters and the selected incident in the URL, so links are shareable.
 *
 *   ?range=7d&cat=shooting,knife&district=Neukölln&q=Hermannplatz
 *   ?from=2026-05-01&to=2026-05-31&incident=1735173
 *
 * A preset range is kept relative ("last 7 days" stays current). A link to an incident gets
 * exact dates, so it still finds the incident after the preset window has moved on.
 */

export const RANGES = { '7d': 7, '30d': 30, '1y': 365 } as const;
export type Range = keyof typeof RANGES | 'all';
export const DEFAULT_RANGE: Range = '30d';

export interface UrlState {
  /** A preset range, or null when the URL gives explicit dates. */
  range: Range | null;
  from: string | null;
  to: string | null;
  categories: Set<Category> | null;
  district: string;
  query: string;
  incident: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const range = p.get('range');
  const from = p.get('from');
  const to = p.get('to');
  const explicit = from && to && DATE.test(from) && DATE.test(to) && from <= to;
  const cats = (p.get('cat') ?? '')
    .split(',')
    .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  const district = p.get('district') ?? '';
  const incident = p.get('incident');
  return {
    range: explicit ? null : range === 'all' || (range && range in RANGES) ? (range as Range) : DEFAULT_RANGE,
    from: explicit ? from : null,
    to: explicit ? to : null,
    categories: cats.length ? new Set(cats) : null,
    district: isDistrict(district) ? district : '',
    query: (p.get('q') ?? '').slice(0, 100),
    incident: incident && /^\d+$/.test(incident) ? incident : null,
  };
}

/** The preset a date range matches, if any. `minDate` is the start of the data ("all"). */
export function rangeOf(from: string, to: string, today: string, minDate: string | null): Range | null {
  if (to !== today) return null;
  if (minDate && from === minDate) return 'all';
  for (const [key, days] of Object.entries(RANGES)) if (from === isoDaysAgo(days, today)) return key as Range;
  return null;
}

export function toSearch(f: Filters, selectedId: string | null, today: string, minDate: string | null): string {
  const p = new URLSearchParams();
  const range = rangeOf(f.from, f.to, today, minDate);
  if (range && !selectedId) {
    if (range !== DEFAULT_RANGE) p.set('range', range);
  } else {
    p.set('from', f.from);
    p.set('to', f.to);
  }
  if (f.categories.size < CATEGORIES.length) p.set('cat', CATEGORIES.filter((c) => f.categories.has(c)).join(','));
  if (f.district) p.set('district', f.district);
  if (f.query.trim()) p.set('q', f.query.trim());
  if (selectedId) p.set('incident', selectedId);
  const s = p.toString();
  return s ? `?${s}` : '';
}
