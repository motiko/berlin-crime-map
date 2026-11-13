/**
 * Daily update for the current year: scrape new reports, extract, geocode, rebuild data.
 * Run by .github/workflows/daily.yml.
 */
import { execFileSync } from 'node:child_process';
import { scrapeYear } from './scrape.ts';
import { geocodeYears } from './geocode.ts';
import { buildData } from './build-data.ts';

const year = new Date().getFullYear();
const result = await scrapeYear(year, { incremental: true });
console.log('scrape:', result);

// Extraction runs as its own process so it loads .env / OPENROUTER_API_KEY the same way as when run by hand.
// A few failed reports should not stop the rest from being published; they are retried tomorrow.
try {
  execFileSync('pnpm', ['exec', 'tsx', 'pipeline/extract.ts', '--year', String(year), '--direct'], { stdio: 'inherit' });
} catch {
  console.warn('extract: some reports failed, continuing with the ones that succeeded');
}

await geocodeYears([year]);
await buildData();
