import type { DataIndex, Incident } from '../../shared/types.ts';

const yearCache = new Map<number, Promise<Incident[]>>();

export async function loadIndex(): Promise<DataIndex> {
  const res = await fetch('/data/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load data index (${res.status})`);
  return res.json();
}

export function loadYear(year: number): Promise<Incident[]> {
  let pending = yearCache.get(year);
  if (!pending) {
    pending = fetch(`/data/${year}.json`).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${year} (${res.status})`);
      return res.json() as Promise<Incident[]>;
    });
    pending.catch(() => yearCache.delete(year));
    yearCache.set(year, pending);
  }
  return pending;
}

/** Load every available year that overlaps [from, to] (ISO dates). */
export async function loadRange(index: DataIndex, from: string, to: string): Promise<Incident[]> {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const years = index.years.map((y) => y.year).filter((y) => y >= fromYear && y <= toYear);
  const chunks = await Promise.all(years.map(loadYear));
  return chunks.flat();
}
