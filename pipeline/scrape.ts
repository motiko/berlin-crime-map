/**
 * Scrape Berlin police press releases for one or more years.
 *
 *   pnpm scrape --year 2026                 # full year, skipping reports we already have
 *   pnpm scrape --year 2026 --incremental   # stop at the first page where everything is known (daily runs)
 *   pnpm scrape --from 2020 --to 2025       # several years
 *   pnpm scrape --year 2026 --limit 100     # at most 100 new reports (dry run)
 *
 * Requests are sequential with a pause between them, because berlin.de answers parallel
 * requests with HTTP 429. Each report is written as soon as it is fetched, so a run can be
 * stopped and resumed at any time.
 */
import { existsSync } from 'node:fs';
import type { ListingEntry, RawReport } from '../shared/types.ts';
import { politeGet } from './lib/http.ts';
import { parseListing, parsePageCount, parseReportBody } from './lib/parse.ts';
import { extractedPath, parseArgs, rawPath, writeJson, yearsFromArgs } from './lib/store.ts';

const listingUrl = (year: number, page: number) =>
  page === 1
    ? `https://www.berlin.de/polizei/polizeimeldungen/archiv/${year}/`
    : `https://www.berlin.de/polizei/polizeimeldungen/archiv/${year}/?page_at_1_1=${page}`;

const isKnown = (year: number, id: string) => existsSync(rawPath(year, id)) || existsSync(extractedPath(year, id));

async function listYear(year: number, incremental: boolean): Promise<ListingEntry[]> {
  const first = await politeGet(listingUrl(year, 1));
  const pages = parsePageCount(first);
  const entries: ListingEntry[] = [];

  for (let page = 1; page <= pages; page++) {
    const html = page === 1 ? first : await politeGet(listingUrl(year, page));
    const pageEntries = parseListing(html);
    entries.push(...pageEntries);
    const unknown = pageEntries.filter((e) => !isKnown(year, e.id)).length;
    console.log(`${year} page ${page}/${pages}: ${pageEntries.length} entries, ${unknown} new`);
    if (incremental && unknown === 0) break;
  }
  return entries;
}

export async function scrapeYear(year: number, opts: { incremental?: boolean; limit?: number } = {}) {
  const entries = await listYear(year, !!opts.incremental);
  const missing = entries.filter((e) => !isKnown(year, e.id)).slice(0, opts.limit ?? Infinity);
  console.log(`${year}: fetching ${missing.length} new reports`);

  let failed = 0;
  for (const [i, entry] of missing.entries()) {
    try {
      const body = parseReportBody(await politeGet(entry.url));
      const report: RawReport = { ...entry, body, fetchedAt: new Date().toISOString() };
      await writeJson(rawPath(year, entry.id), report);
      if ((i + 1) % 25 === 0 || i === missing.length - 1) console.log(`  ${i + 1}/${missing.length}`);
    } catch (error) {
      failed++;
      console.warn(`  skipped ${entry.id} (${entry.title}): ${(error as Error).message}`);
    }
  }
  return { listed: entries.length, fetched: missing.length - failed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const limit = typeof args.limit === 'string' ? Number(args.limit) : undefined;
  for (const year of yearsFromArgs(args)) {
    const result = await scrapeYear(year, { incremental: !!args.incremental, limit });
    console.log(`${year}: done`, result);
  }
}
