/**
 * Geocode extracted reports with OpenStreetMap Nominatim, caching every query.
 *
 *   pnpm geocode --year 2026
 *   pnpm geocode --from 2020 --to 2026
 *
 * Follows the Nominatim usage policy: at most one request per second, an identifying
 * User-Agent, and results cached so the same street is never looked up twice.
 */
import { existsSync } from 'node:fs';
import type { ExtractedReport } from '../shared/types.ts';
import { USER_AGENT, sleep } from './lib/http.ts';
import { BERLIN_VIEWBOX, type GeocodeCache, geocodeQueries } from './lib/geo.ts';
import { EXTRACTED_DIR, GEOCODE_CACHE, parseArgs, readJson, readYear, writeJson, yearsFromArgs } from './lib/store.ts';

async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'de',
    viewbox: BERLIN_VIEWBOX,
    bounded: '1',
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' },
    });
    if (res.ok) {
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      return hit ? { lat: Number(Number(hit.lat).toFixed(5)), lng: Number(Number(hit.lon).toFixed(5)) } : null;
    }
    await sleep(5000 * attempt);
  }
  throw new Error(`Nominatim failed for ${query}`);
}

export async function geocodeYears(years: number[]) {
  const cache: GeocodeCache = existsSync(GEOCODE_CACHE) ? await readJson<GeocodeCache>(GEOCODE_CACHE) : {};
  let looked = 0;

  for (const year of years) {
    const reports = await readYear<ExtractedReport>(EXTRACTED_DIR, year);
    for (const report of reports) {
      for (const query of geocodeQueries(report)) {
        if (query in cache) {
          if (cache[query]) break; // already resolved at this precision
          continue;
        }
        cache[query] = await nominatim(query);
        looked++;
        await sleep(1100);
        if (looked % 50 === 0) {
          await writeJson(GEOCODE_CACHE, cache);
          console.log(`  ${looked} lookups`);
        }
        if (cache[query]) break;
      }
    }
    console.log(`${year}: ${reports.length} reports checked`);
  }
  await writeJson(GEOCODE_CACHE, sortKeys(cache));
  console.log(`geocoding done: ${looked} new lookups, ${Object.keys(cache).length} cached queries`);
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'de')));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await geocodeYears(yearsFromArgs(parseArgs()));
}
