/**
 * Extract category, location and an English summary from scraped reports, via OpenRouter.
 *
 *   pnpm extract --year 2026                 # batch if more than 50 reports, else direct calls
 *   pnpm extract --from 2020 --to 2025       # backfill: submitted as batches (about half price)
 *   pnpm extract --year 2026 --limit 100 --direct   # dry run with immediate results and cost
 *   pnpm extract --ids 1701194,1689852 --direct     # specific reports (any year)
 *   pnpm extract --collect                   # only wait for and save batches submitted earlier
 *   pnpm extract --year 2026 --force         # re-extract reports that were already extracted
 *
 * Batches can take up to 24 hours. Submitted batches are recorded in data/batches/, so the
 * command can be stopped and rerun: it collects pending batches and never resubmits a
 * report that is already in one.
 *
 * Needs OPENROUTER_API_KEY in the environment or in .env. OPENROUTER_MODEL overrides the model.
 */
import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractedReport, RawReport } from '../shared/types.ts';
import { FINAL, flaggedRequestId, getBatch, submitBatch } from './lib/batch.ts';
import { type ExtractResult, MODEL, extract, finalize, parseChatResponse } from './lib/extraction.ts';
import { sleep } from './lib/http.ts';
import {
  BATCH_DIR,
  RAW_DIR,
  ROOT,
  extractedPath,
  parseArgs,
  readJson,
  readYear,
  writeJson,
  yearsFromArgs,
  yearsWithData,
} from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (environment or .env).');
  process.exit(1);
}

const BATCH_THRESHOLD = 50;

interface BatchRecord {
  id: string;
  model: string;
  submittedAt: string;
  /** report id -> year folder */
  items: Record<string, number>;
}

const args = parseArgs();
const limit = typeof args.limit === 'string' ? Number(args.limit) : Infinity;
const concurrency = typeof args.concurrency === 'string' ? Number(args.concurrency) : 4;
const batchSize = typeof args['batch-size'] === 'string' ? Number(args['batch-size']) : 1000;
const ids = typeof args.ids === 'string' ? new Set(args.ids.split(',')) : null;

const totals = { done: 0, failed: 0, input: 0, output: 0, cost: 0 };

async function save(year: number, report: RawReport, result: ExtractResult) {
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
}

async function pendingBatches(): Promise<BatchRecord[]> {
  if (!existsSync(BATCH_DIR)) return [];
  const files = (await readdir(BATCH_DIR)).filter((f) => f.endsWith('.json'));
  return Promise.all(files.map((f) => readJson<BatchRecord>(join(BATCH_DIR, f))));
}

/** Wait for every recorded batch to finish and save its results. */
async function collectAll() {
  let pending = await pendingBatches();
  while (pending.length) {
    for (const record of pending) {
      let batch;
      try {
        batch = await getBatch(record.id, apiKey as string);
      } catch (error) {
        // A just-submitted batch can return 404 for a while before it becomes visible.
        const ageMin = (Date.now() - Date.parse(record.submittedAt)) / 60_000;
        const message = (error as Error).message;
        if (message.includes(' 404') && ageMin > 30) {
          console.warn(`  batch ${record.id} still unknown after 30 min; dropping it so its reports are resubmitted`);
          await rm(join(BATCH_DIR, `${record.id}.json`));
        } else {
          console.warn(`  batch ${record.id}: ${message.slice(0, 200)} (will retry)`);
        }
        continue;
      }
      const c = batch.request_counts ?? {};
      console.log(`batch ${record.id}: ${batch.status} ${JSON.stringify(c)}`);
      if (!FINAL.includes(batch.status)) continue;

      for (const item of batch.results ?? []) {
        const year = record.items[item.custom_id];
        if (year === undefined) continue;
        try {
          if (item.error || !item.response || item.response.status_code >= 400) {
            throw new Error(item.error?.message ?? `status ${item.response?.status_code}`);
          }
          const report = await readJson<RawReport>(join(RAW_DIR, String(year), `${item.custom_id}.json`));
          await save(year, report, finalize(parseChatResponse(item.response.body), report));
        } catch (error) {
          totals.failed++;
          console.warn(`  failed ${item.custom_id}: ${(error as Error).message}`);
        }
      }
      totals.cost += batch.usage?.cost ?? 0;
      await rm(join(BATCH_DIR, `${record.id}.json`));
      if (batch.status !== 'completed') await recoverFailedBatch(record, batch);
    }
    pending = await pendingBatches();
    if (pending.length) await sleep(60_000);
  }
}

/**
 * A batch that ended without results for some reports. If moderation flagged one request,
 * resubmit the others as a new batch and try the flagged one with a direct call; otherwise
 * count the missing reports as failed (they are picked up again by the next run).
 */
async function recoverFailedBatch(record: BatchRecord, batch: Awaited<ReturnType<typeof getBatch>>) {
  const done = new Set((batch.results ?? []).map((r) => r.custom_id));
  const missing = Object.entries(record.items).filter(([id]) => !done.has(id));
  if (!missing.length) return;
  console.warn(`  batch ${record.id} ended as ${batch.status}: ${batch.error?.message ?? 'no error message'}`);

  const flagged = flaggedRequestId(batch);
  const load = (id: string, year: number) =>
    readJson<RawReport>(join(RAW_DIR, String(year), `${id}.json`)).then((report) => ({ year, report }));
  if (flagged && record.items[flagged] !== undefined && missing.length > 1) {
    const rest = await Promise.all(missing.filter(([id]) => id !== flagged).map(([id, year]) => load(id, year)));
    console.warn(`  report ${flagged} was flagged; resubmitting the other ${rest.length} and trying it directly`);
    await submitAll(rest);
    await runDirect([await load(flagged, record.items[flagged])]);
    return;
  }
  if (flagged && missing.length === 1) {
    await runDirect([await load(flagged, record.items[flagged])]);
    return;
  }
  totals.failed += missing.length;
  console.warn(`  ${missing.length} reports not extracted; rerun the command to resubmit them`);
}

async function runDirect(queue: { year: number; report: RawReport }[]) {
  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      try {
        const result = await extract(next.report, apiKey as string);
        await save(next.year, next.report, result);
        totals.cost += result.cost;
        if (totals.done % 25 === 0) console.log(`  ${totals.done} done, $${totals.cost.toFixed(4)} so far`);
      } catch (error) {
        totals.failed++;
        console.warn(`  failed ${next.report.id}: ${(error as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
}

async function submitAll(queue: { year: number; report: RawReport }[]) {
  for (let i = 0; i < queue.length; i += batchSize) {
    const chunk = queue.slice(i, i + batchSize);
    const batch = await submitBatch(
      chunk.map((q) => q.report),
      apiKey as string,
    );
    const record: BatchRecord = {
      id: batch.id,
      model: MODEL,
      submittedAt: new Date().toISOString(),
      items: Object.fromEntries(chunk.map((q) => [q.report.id, q.year])),
    };
    await writeJson(join(BATCH_DIR, `${batch.id}.json`), record);
    console.log(`submitted batch ${batch.id} with ${chunk.length} reports (${batch.status})`);
  }
}

// Reports already waiting in a submitted batch must not be sent again.
const inFlight = new Set((await pendingBatches()).flatMap((b) => Object.keys(b.items)));

if (!args.collect) {
  const years = ids ? await yearsWithData(RAW_DIR) : yearsFromArgs(args);
  const todo: { year: number; report: RawReport }[] = [];
  for (const year of years) {
    for (const report of await readYear<RawReport>(RAW_DIR, year)) {
      if (ids && !ids.has(report.id)) continue;
      if (!ids && !args.force && existsSync(extractedPath(year, report.id))) continue;
      if (inFlight.has(report.id)) continue;
      todo.push({ year, report });
    }
  }
  // Newest first, so a limited dry run covers recent reports.
  todo.sort((a, b) => b.report.publishedAt.localeCompare(a.report.publishedAt));
  const queue = todo.slice(0, limit);

  const useBatch = args.direct ? false : args.batch ? true : queue.length > BATCH_THRESHOLD;
  console.log(`${queue.length} reports to extract with ${MODEL} via ${useBatch ? 'batch API' : 'direct calls'}`);
  if (inFlight.size) console.log(`${inFlight.size} reports already in submitted batches`);

  if (useBatch) await submitAll(queue);
  else await runDirect(queue);
}

await collectAll();

console.log(`\ndone: ${totals.done} extracted, ${totals.failed} failed`);
if (totals.done) {
  const per = (n: number) => (n / totals.done).toFixed(0);
  console.log(`tokens: ${totals.input} in + ${totals.output} out (avg ${per(totals.input)} + ${per(totals.output)} per report)`);
  console.log(`cost: $${totals.cost.toFixed(4)} total, $${(totals.cost / totals.done).toFixed(6)} per report`);
}
if (totals.failed) process.exitCode = 1;
