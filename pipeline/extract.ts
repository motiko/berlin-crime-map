/**
 * Extract category, location and an English summary from scraped reports, via OpenRouter.
 *
 *   pnpm extract --year 2026               # every report not yet extracted
 *   pnpm extract --year 2026 --limit 100   # dry run: prints tokens and cost per report
 *   pnpm extract --from 2020 --to 2025 --concurrency 8
 *   pnpm extract --ids 1701194,1689852     # specific reports (any year)
 *
 * Needs OPENROUTER_API_KEY in the environment or in .env. OPENROUTER_MODEL overrides the model.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractedReport, RawReport } from '../shared/types.ts';
import { MODEL, extract } from './lib/extraction.ts';
import { RAW_DIR, ROOT, extractedPath, parseArgs, readYear, writeJson, yearsFromArgs, yearsWithData } from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (environment or .env).');
  process.exit(1);
}

const args = parseArgs();
const limit = typeof args.limit === 'string' ? Number(args.limit) : Infinity;
const concurrency = typeof args.concurrency === 'string' ? Number(args.concurrency) : 4;
const ids = typeof args.ids === 'string' ? new Set(args.ids.split(',')) : null;

const years = ids ? await yearsWithData(RAW_DIR) : yearsFromArgs(args);
const todo: { year: number; report: RawReport }[] = [];
for (const year of years) {
  for (const report of await readYear<RawReport>(RAW_DIR, year)) {
    if (ids && !ids.has(report.id)) continue;
    if (!ids && existsSync(extractedPath(year, report.id))) continue;
    todo.push({ year, report });
  }
}
// Newest first, so a limited dry run covers recent reports.
todo.sort((a, b) => b.report.publishedAt.localeCompare(a.report.publishedAt));
const queue = todo.slice(0, limit);
console.log(`${queue.length} reports to extract with ${MODEL} (concurrency ${concurrency})`);

const totals = { done: 0, failed: 0, input: 0, output: 0, cost: 0 };

async function worker() {
  for (;;) {
    const next = queue.shift();
    if (!next) return;
    const { year, report } = next;
    try {
      const result = await extract(report, apiKey as string);
      const { body: _b, fetchedAt: _f, ...listing } = report;
      const extracted: ExtractedReport = {
        ...listing,
        extraction: result.extraction,
        model: result.model,
        extractedAt: new Date().toISOString(),
      };
      await writeJson(extractedPath(year, report.id), extracted);
      totals.done++;
      totals.input += result.inputTokens;
      totals.output += result.outputTokens;
      totals.cost += result.cost;
      if (totals.done % 25 === 0) console.log(`  ${totals.done} done, $${totals.cost.toFixed(4)} so far`);
    } catch (error) {
      totals.failed++;
      console.warn(`  failed ${report.id}: ${(error as Error).message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

console.log(`\ndone: ${totals.done} extracted, ${totals.failed} failed`);
if (totals.done) {
  const per = (n: number) => (n / totals.done).toFixed(0);
  console.log(`tokens: ${totals.input} in + ${totals.output} out (avg ${per(totals.input)} + ${per(totals.output)} per report)`);
  console.log(`cost: $${totals.cost.toFixed(4)} total, $${(totals.cost / totals.done).toFixed(6)} per report`);
}
if (totals.failed) process.exitCode = 1;
