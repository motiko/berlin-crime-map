import { DISTRICT_CENTROIDS, isDistrict } from '../../shared/categories.ts';
import type { ExtractedReport, Precision } from '../../shared/types.ts';

export type GeocodeCache = Record<string, { lat: number; lng: number } | null>;

/** Berlin bounding box for Nominatim: left, top, right, bottom. */
export const BERLIN_VIEWBOX = '13.08,52.68,13.77,52.33';

function district(report: ExtractedReport): string | null {
  const fromPolice = report.location;
  if (isDistrict(fromPolice)) return fromPolice;
  const fromModel = report.extraction.district;
  return isDistrict(fromModel) ? fromModel : null;
}

/**
 * Geocoding queries for a report, most precise first. Street names repeat across Berlin
 * districts (there are many a "Hauptstraße"), so the district is part of the query.
 */
export function geocodeQueries(report: ExtractedReport): string[] {
  const { street, houseNumberOrCrossing, placeName } = report.extraction;
  const d = district(report);
  const suffix = d ? `, ${d}, Berlin` : ', Berlin';
  const queries: string[] = [];

  if (street) {
    const extra = houseNumberOrCrossing?.trim();
    if (extra && /^\d+[a-z]?$/i.test(extra)) queries.push(`${street} ${extra}${suffix}`);
    queries.push(`${street}${suffix}`);
  }
  if (placeName) queries.push(`${placeName}${suffix}`);
  return queries.map((q) => q.replace(/\s+/g, ' ').trim());
}

export function locate(
  report: ExtractedReport,
  cache: GeocodeCache,
): { lat: number | null; lng: number | null; precision: Precision; place: string | null } {
  for (const query of geocodeQueries(report)) {
    const hit = cache[query];
    if (hit) return { ...hit, precision: 'street', place: query.replace(/, Berlin$/, '') };
  }
  const d = district(report);
  if (d) {
    const [lat, lng] = DISTRICT_CENTROIDS[d as keyof typeof DISTRICT_CENTROIDS];
    return { lat, lng, precision: 'district', place: d };
  }
  return { lat: null, lng: null, precision: 'none', place: null };
}
