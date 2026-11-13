/**
 * Fetch the 12 Berlin district (Bezirk) boundaries from OpenStreetMap via Nominatim and
 * write them, simplified, to public/data/districts.geojson. Boundaries rarely change, so
 * this is a one-off: rerun only to refresh them.
 *
 *   pnpm districts
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import { join } from 'node:path';
import { DISTRICTS } from '../shared/categories.ts';
import { USER_AGENT, sleep } from './lib/http.ts';
import { PUBLIC_DATA, writeJson } from './lib/store.ts';

interface NominatimHit {
  category: string;
  addresstype: string;
  osm_id: number;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

const round = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(round) : typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value;

const features = [];
for (const name of DISTRICTS) {
  const params = new URLSearchParams({
    q: `${name}, Berlin`,
    format: 'jsonv2',
    polygon_geojson: '1',
    polygon_threshold: '0.0003',
    limit: '5',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': USER_AGENT } });
  const hits = (await res.json()) as NominatimHit[];
  // Most districts are tagged "borough". Spandau's is "city_district", and its first hit is the
  // smaller locality (Ortsteil) of the same name, tagged "suburb", which must be skipped.
  const hit = hits.find((h) => h.category === 'boundary' && ['borough', 'city_district'].includes(h.addresstype));
  if (!hit) throw new Error(`No boundary found for ${name}`);
  features.push({
    type: 'Feature',
    properties: { name, osmRelation: hit.osm_id },
    geometry: { type: hit.geojson.type, coordinates: round(hit.geojson.coordinates) },
  });
  console.log(`${name}: relation ${hit.osm_id}, ${hit.geojson.type}`);
  await sleep(1100);
}

await writeJson(join(PUBLIC_DATA, 'districts.geojson'), { type: 'FeatureCollection', features }, false);
console.log(`wrote ${features.length} districts`);
