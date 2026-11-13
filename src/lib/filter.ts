import type { Category } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';

export interface Filters {
  from: string;
  to: string;
  categories: Set<Category>;
  district: string;
  query: string;
}

export function isoDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
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
