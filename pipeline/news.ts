/**
 * Find news articles about recent serious incidents and store the links in
 * data/news/<year>/<id>.json (links and headlines only, no article text).
 * See docs/news-links/README.md.
 *
 *   pnpm news                         # last 30 days: shooting, homicide, knife, explosion
 *   pnpm news --days 90 --categories shooting,homicide
 *   pnpm news --ids 1701194
 *   pnpm news --dry-run               # list what would be searched, no cost
 *
 * Each incident is searched when it first appears and once more at least 3 days after the
 * police report (articles often appear later). Results from the pilot (data/news-pilot) are
 * reused instead of searching again. Stops at --budget dollars (default 1).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractedReport, RawReport } from '../shared/types.ts';
import { type Candidate, type NewsRecord, buildQuery, checkNews, mergeArticles, searchNews } from './lib/news.ts';
import { DATA, EXTRACTED_DIR, RAW_DIR, ROOT, parseArgs, readJson, readYear, writeJson } from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

export const NEWS_DIR = join(DATA, 'news');
const PILOT_DIR = join(DATA, 'news-pilot');
export const DEFAULT_CATEGORIES = ['shooting', 'homicide', 'knife', 'explosion'];
const RECHECK_AFTER_DAYS = 3;

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;

export interface NewsOptions {
  days?: number;
  categories?: string[];
  ids?: Set<string> | null;
  budget?: number;
  dryRun?: boolean;
  now?: Date;
}

/** Whether an incident is due for a (first or second) search. */
export function isDue(record: NewsRecord | null, publishedAt: string, now: Date): boolean {
  if (!record || record.searches.length === 0) return true;
  if (record.searches.length >= 2) return false;
  const first = record.searches[0];
  // A second search once the police report is at least 3 days old, if the first came earlier.
  return daysBetween(publishedAt, first) < RECHECK_AFTER_DAYS && daysBetween(publishedAt, now.toISOString()) >= RECHECK_AFTER_DAYS;
}

export async function updateNews(opts: NewsOptions = {}): Promise<{ searched: number; cost: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const now = opts.now ?? new Date();
  const days = opts.days ?? 30;
  const categories = opts.categories ?? DEFAULT_CATEGORIES;
  const budget = opts.budget ?? 1;
  const since = new Date(now.getTime() - days * DAY).toISOString().slice(0, 10);

  const years = [...new Set([now.getUTCFullYear(), Number(since.slice(0, 4))])];
  const due: { year: number; report: ExtractedReport; record: NewsRecord | null }[] = [];
  for (const year of years) {
    for (const report of await readYear<ExtractedReport>(EXTRACTED_DIR, year)) {
      const date = report.extraction.incidentDate ?? report.publishedAt.slice(0, 10);
      if (opts.ids ? !opts.ids.has(report.id) : !categories.includes(report.extraction.category) || date < since) continue;
      const path = join(NEWS_DIR, String(year), `${report.id}.json`);
      const record = existsSync(path) ? await readJson<NewsRecord>(path) : null;
      if (opts.ids || isDue(record, report.publishedAt, now)) due.push({ year, report, record });
    }
  }
  due.sort((a, b) => b.report.publishedAt.localeCompare(a.report.publishedAt));
  console.log(`news: ${due.length} incidents due (${opts.ids ? 'by id' : `${categories.join(', ')}, since ${since}`})`);
  if (opts.dryRun) {
    for (const d of due) console.log(`  ${d.report.id} ${d.report.extraction.category} ${d.report.title}`);
    return { searched: 0, cost: 0 };
  }
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (environment or .env).');

  let cost = 0;
  let searched = 0;
  for (const { year, report, record: existing } of due) {
    if (cost >= budget) {
      console.warn(`news: budget of $${budget} reached; the rest is searched next run`);
      break;
    }
    const record: NewsRecord = existing ?? { id: report.id, searches: [], articles: [] };
    try {
      const raw = await readJson<RawReport>(join(RAW_DIR, String(year), `${report.id}.json`));
      // The pilot already searched some incidents; reuse its results for the first search.
      const pilotPath = join(PILOT_DIR, `${report.id}.json`);
      let candidates: Candidate[];
      let searchedAt = now.toISOString();
      if (!record.searches.length && existsSync(pilotPath)) {
        const pilot = await readJson<{ candidates: Candidate[]; checkedAt: string }>(pilotPath);
        candidates = pilot.candidates;
        searchedAt = pilot.checkedAt;
      } else {
        const s = await searchNews(buildQuery(report), apiKey);
        candidates = s.candidates;
        cost += s.cost;
      }
      const c = await checkNews(report, raw, candidates, apiKey);
      cost += c.cost;
      mergeArticles(record, candidates, c.verdicts);
      record.searches.push(searchedAt);
      await writeJson(join(NEWS_DIR, String(year), `${report.id}.json`), record);
      searched++;
      console.log(`  ${report.id} ${candidates.length} candidates, ${record.articles.length} articles  ($${cost.toFixed(3)})`);
    } catch (error) {
      console.warn(`  failed ${report.id}: ${(error as Error).message.slice(0, 200)}`);
    }
  }
  console.log(`news: ${searched} incidents searched, $${cost.toFixed(3)}`);
  return { searched, cost };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  await updateNews({
    days: typeof args.days === 'string' ? Number(args.days) : undefined,
    categories: typeof args.categories === 'string' ? args.categories.split(',') : undefined,
    ids: typeof args.ids === 'string' ? new Set(args.ids.split(',')) : null,
    budget: typeof args.budget === 'string' ? Number(args.budget) : undefined,
    dryRun: !!args['dry-run'],
  });
}
