import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
 * Words that describe a kind of place rather than name one ("Schulhof", "Hotel in
 * Charlottenburg"). Nominatim would match some random school yard or hotel in the district.
 */
const GENERIC_PLACE = new RegExp(
  '^(' +
    [
      'ambulanz', 'apotheke', 'bar', 'bus', 'café', 'cafe', 'diskothek', 'einrichtung',
      'filiale', 'gaststätte', 'gelände', 'geschäft', 'grundschule', 'grünanlage', 'hinterhof', 'hotel',
      'hotelzimmer', 'imbiss', 'jugendzentrum', 'kita', 'kiosk', 'kleingartenanlage', 'klinik', 'klinikum',
      'krankenhaus', 'kulturhaus', 'laden', 'lokal', 'nähe', 'oberstufenzentrum', 'parkanlage',
      'parkhaus', 'parkplatz', 'pension', 'praxis', 'restaurant', 'schnellrestaurant', 'schulhof', 'schule',
      'spielplatz', 'sporthalle', 'späti', 'straßendurchbruch', 'supermarkt', 'tankstelle', 'tiefgarage',
      'trainingsraum', 'treppenhaus', 'unterkunft', 'wahlkreisbüro', 'wohnung', 'wohnhaus',
    ].join('|') +
    ')$',
  'i',
);

/**
 * The place name if it can be geocoded on its own, else null: a named place such as
 * "Görlitzer Park" or "U-Bahnhof Hermannplatz", not a kind of place ("Schulhof", "Bar in
 * Wilmersdorf"), a list of several places, or a bus or train line.
 */
export function usablePlaceName(name: string | null | undefined): string | null {
  let n = name?.trim().replace(/\b[SU]- und [SU]-Bahnhof/, 'Bahnhof');
  if (!n) return null;
  // "Spielplatz im Volkspark Humboldthain", "Imbiss im S-Bahnhof Adlershof": use the named place.
  const within = n.match(/^\S+ (?:im|am) (\p{Lu}.*)$/u);
  if (within && GENERIC_PLACE.test(n.split(' ')[0])) n = within[1];
  // Several places ("Warschauer Brücke, Alexanderplatz, …", "Westhafen und Zoologischer Garten").
  if (/\s(und|and|between|zwischen)\s|\/|\s[–-]\s|,.*,/i.test(n)) return null;
  // Lines and vehicles, not places ("U-Bahn Linie U2", "Nachtbus N8", "U-Bahnstrecke der U5").
  if (/\b(linie|line|nachtbus|strecke|richtung|route)\b|^(bus|nachtbus)\b|bahnstrecke/i.test(n)) return null;
  const first = n.split(/[\s,]/)[0];
  // "Hotel in Charlottenburg", "Spielplatz im …", "Filiale der Berliner Volksbank", "Café".
  if (GENERIC_PLACE.test(first)) return null;
  // A compound starting or ending with a generic word: "Supermarkt-Parkplatz", "Mutter-Kind-Einrichtung".
  // Not named parks and schools: "James-Simon-Park", "Anna-Seghers-Schule".
  const parts = first.split('-');
  if (parts.length > 1 && (GENERIC_PLACE.test(parts[0]) || /^(einrichtung|parkplatz|unterkunft)$/i.test(parts.at(-1)!))) return null;
  // One word ending in a generic word: "Koranschule", "Gemeinschaftsunterkunft …".
  if (!first.includes('-') && /.(unterkunft|schule|zimmer|einrichtung|ambulanz|parkplatz|spielplatz)$/i.test(first)) return null;
  // Lower-case start: a description ("psychiatrische Ambulanz"), not a name.
  if (/^[a-zäöüß]/.test(n)) return null;
  // Keep only the part before a comma ("Polizeipräsidium, Foyer").
  return n.split(',')[0].trim();
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
  const place = usablePlaceName(placeName);
  if (place) queries.push(`${place}${suffix}`);
  return queries.map((q) => q.replace(/\s+/g, ' ').trim());
}

type Ring = [number, number][];
export type DistrictOutlines = Map<string, Ring[]>;

let outlines: DistrictOutlines | null = null;
/** District outlines from public/data/districts.geojson (written by `pnpm districts`). */
export function districtOutlines(): DistrictOutlines {
  if (!outlines) {
    const file = join(import.meta.dirname, '../../public/data/districts.geojson');
    const geo = JSON.parse(readFileSync(file, 'utf8')) as {
      features: { properties: { name: string }; geometry: { type: string; coordinates: any } }[];
    };
    outlines = new Map();
    for (const f of geo.features) {
      const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      outlines.set(f.properties.name, polys.map((p) => p[0]));
    }
  }
  return outlines;
}

function insideRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Approximate distance in metres from a point to a district outline (0 when inside). */
export function metresOutside(point: [number, number], rings: Ring[]): number {
  if (rings.some((r) => insideRing(point, r))) return 0;
  const m = (p: [number, number]) => [p[0] * 68_000, p[1] * 111_000]; // degrees to metres at Berlin
  const [px, py] = m(point);
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = m(ring[i - 1]);
      const [bx, by] = m(ring[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
  }
  return best;
}

/**
 * A geocoded point must lie in the report's district, within this margin (the outlines are
 * simplified, and streets run along borders). Otherwise Nominatim found something else with
 * that name, and the report falls back to the district centre. In 2026 no correct point was
 * more than 60 m outside its district.
 */
export const DISTRICT_MARGIN_M = 500;

export function locate(
  report: ExtractedReport,
  cache: GeocodeCache,
  districts: DistrictOutlines = districtOutlines(),
): { lat: number | null; lng: number | null; precision: Precision; place: string | null } {
  const d = district(report);
  const rings = d ? districts.get(d) : [...districts.values()].flat();
  for (const query of geocodeQueries(report)) {
    const hit = cache[query];
    if (!hit) continue;
    if (rings && metresOutside([hit.lng, hit.lat], rings) > DISTRICT_MARGIN_M) continue;
    return { ...hit, precision: 'street', place: query.replace(/, Berlin$/, '') };
  }
  if (d) {
    const [lat, lng] = DISTRICT_CENTROIDS[d as keyof typeof DISTRICT_CENTROIDS];
    return { lat, lng, precision: 'district', place: d };
  }
  return { lat: null, lng: null, precision: 'none', place: null };
}
