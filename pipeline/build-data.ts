/**
 * Build the public data files the web app loads:
 *   public/data/<year>.json   incidents for one year
 *   public/data/index.json    available years, counts, last update
 *
 * Only our own derived data is published (category, location, English summary) together
 * with the original title and a link. The full German report text is not republished.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DataIndex, ExtractedReport, Incident } from '../shared/types.ts';
import { type GeocodeCache, locate } from './lib/geo.ts';
import { type NewsRecord, linksToShow } from './lib/news.ts';
import { DATA, EXTRACTED_DIR, GEOCODE_CACHE, PUBLIC_DATA, ROOT, readJson, readYear, writeJson, yearsWithData } from './lib/store.ts';

/** Hand-checked corrections for single reports (pipeline/overrides.json). */
export interface Override {
  category?: Incident['category'];
  injured?: number | null;
  dead?: number | null;
  summaryEn?: string;
  why: string;
}
export const OVERRIDES_FILE = join(ROOT, 'pipeline/overrides.json');

export function toIncident(report: ExtractedReport, cache: GeocodeCache, override?: Override, news?: NewsRecord): Incident {
  const x = { ...report.extraction, ...(override && { ...override, why: undefined }) };
  const where = locate(report, cache);
  const validDate = x.incidentDate && /^\d{4}-\d{2}-\d{2}$/.test(x.incidentDate) ? x.incidentDate : null;
  return {
    id: report.id,
    date: validDate ?? report.publishedAt.slice(0, 10),
    publishedAt: report.publishedAt,
    category: x.category,
    title: report.title,
    summary: x.summaryEn,
    location: report.location,
    place: where.place,
    lat: where.lat,
    lng: where.lng,
    precision: where.precision,
    injured: x.injured,
    dead: x.dead,
    url: report.url,
    ...(news && { news: linksToShow(news) }),
  };
}

export async function buildData() {
  const cache: GeocodeCache = existsSync(GEOCODE_CACHE) ? await readJson<GeocodeCache>(GEOCODE_CACHE) : {};
  const index: DataIndex = { updatedAt: new Date().toISOString(), years: [] };
  const overrides = existsSync(OVERRIDES_FILE)
    ? (await readJson<{ reports: Record<string, Override> }>(OVERRIDES_FILE)).reports
    : {};

  for (const year of await yearsWithData(EXTRACTED_DIR)) {
    const newsDir = join(DATA, 'news', String(year));
    const news = new Map(
      existsSync(newsDir) ? (await readYear<NewsRecord>(join(DATA, 'news'), year)).map((n) => [n.id, n] as const) : [],
    );
    const incidents = (await readYear<ExtractedReport>(EXTRACTED_DIR, year))
      .map((r) => toIncident(r, cache, overrides[r.id], news.get(r.id)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    await writeJson(join(PUBLIC_DATA, `${year}.json`), incidents, false);
    index.years.push({ year, count: incidents.length });
    const located = incidents.filter((i) => i.precision === 'street').length;
    console.log(`${year}: ${incidents.length} incidents, ${located} at street level`);
  }
  await writeJson(join(PUBLIC_DATA, 'index.json'), index);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildData();
}
