/**
 * One-off historical import. Resumable: rerun the same command after an interruption.
 *
 *   pnpm backfill --from 2020 --to 2025
 *   pnpm backfill --from 2020 --to 2025 --skip-scrape   # reports already downloaded
 *
 * Steps: scrape every year (about 3.5 s per request, so hours per year), extract all new
 * reports via the OpenRouter Batch API (about half price, up to 24 h), geocode, rebuild the public data.
 */
import { execFileSync } from 'node:child_process';
import { scrapeYear } from './scrape.ts';
import { geocodeYears } from './geocode.ts';
import { buildData } from './build-data.ts';
import { parseArgs, yearsFromArgs } from './lib/store.ts';

const args = parseArgs();
const years = yearsFromArgs(args);

if (!args['skip-scrape']) {
  for (const year of years) console.log(`${year}:`, await scrapeYear(year));
}

execFileSync(
  'pnpm',
  ['exec', 'tsx', 'pipeline/extract.ts', '--from', String(years[0]), '--to', String(years.at(-1)), '--batch'],
  { stdio: 'inherit' },
);

await geocodeYears(years);
await buildData();
