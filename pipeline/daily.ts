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

// Extraction runs as its own process so it loads .env / ANTHROPIC_API_KEY the same way as when run by hand.
execFileSync('pnpm', ['exec', 'tsx', 'pipeline/extract.ts', '--year', String(year)], { stdio: 'inherit' });

await geocodeYears([year]);
await buildData();
