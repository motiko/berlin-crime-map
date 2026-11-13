/**
 * Extract category, location and an English summary from scraped reports with Claude.
 *
 *   pnpm extract --year 2026               # one API call per new report (daily runs)
 *   pnpm extract --year 2026 --limit 100   # dry run: also prints token usage and a cost projection
 *   pnpm extract --from 2020 --to 2025 --batch          # Message Batches API (50% cheaper) for the backfill
 *   pnpm extract --resume-batch msgbatch_...            # collect the results of a batch submitted earlier
 *
 * Needs ANTHROPIC_API_KEY in the environment (or in .env).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedReport, RawReport } from '../shared/types.ts';
import { sleep } from './lib/http.ts';
import { MODEL, buildRequest, readExtraction } from './lib/extraction.ts';
import { BATCH_DIR, RAW_DIR, ROOT, extractedPath, parseArgs, readJson, readYear, writeJson, yearsFromArgs } from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const client = new Anthropic();

interface Usage {
  input: number;
  output: number;
  calls: number;
}

async function pending(years: number[], limit?: number) {
  const todo: { year: number; report: RawReport }[] = [];
  for (const year of years) {
    for (const report of await readYear<RawReport>(RAW_DIR, year)) {
      if (!existsSync(extractedPath(year, report.id))) todo.push({ year, report });
    }
  }
  return todo.slice(0, limit ?? Infinity);
}

async function save(year: number, report: RawReport, message: Anthropic.Message) {
  const { body: _body, fetchedAt: _fetchedAt, ...listing } = report;
  const extracted: ExtractedReport = {
    ...listing,
    extraction: readExtraction(message),
    model: message.model,
    extractedAt: new Date().toISOString(),
  };
  await writeJson(extractedPath(year, report.id), extracted);
}

async function extractDirect(todo: { year: number; report: RawReport }[]): Promise<Usage> {
  const usage: Usage = { input: 0, output: 0, calls: 0 };
  for (const [i, { year, report }] of todo.entries()) {
    try {
      const message = await client.messages.create(buildRequest(report));
      await save(year, report, message);
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.calls++;
    } catch (error) {
      console.warn(`  failed ${report.id}: ${(error as Error).message}`);
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) console.log(`  ${i + 1}/${todo.length}`);
  }
  return usage;
}

async function collectBatch(batchId: string): Promise<Usage> {
  const metaPath = join(BATCH_DIR, `${batchId}.json`);
  const meta = await readJson<{ items: Record<string, { year: number; id: string }> }>(metaPath);

  for (;;) {
    const batch = await client.messages.batches.retrieve(batchId);
    const c = batch.request_counts;
    console.log(`batch ${batchId}: ${batch.processing_status} (ok ${c.succeeded}, processing ${c.processing}, errored ${c.errored})`);
    if (batch.processing_status === 'ended') break;
    await sleep(60_000);
  }

  const usage: Usage = { input: 0, output: 0, calls: 0 };
  for await (const result of await client.messages.batches.results(batchId)) {
    const item = meta.items[result.custom_id];
    if (!item) continue;
    if (result.result.type !== 'succeeded') {
      console.warn(`  ${item.id}: ${result.result.type}`);
      continue;
    }
    const report = await readJson<RawReport>(join(RAW_DIR, String(item.year), `${item.id}.json`));
    try {
      await save(item.year, report, result.result.message);
      usage.input += result.result.message.usage.input_tokens;
      usage.output += result.result.message.usage.output_tokens;
      usage.calls++;
    } catch (error) {
      console.warn(`  ${item.id}: ${(error as Error).message}`);
    }
  }
  return usage;
}

async function extractBatch(todo: { year: number; report: RawReport }[]): Promise<Usage> {
  const items: Record<string, { year: number; id: string }> = {};
  const requests = todo.map(({ year, report }) => {
    const customId = `r${report.id}`;
    items[customId] = { year, id: report.id };
    return { custom_id: customId, params: buildRequest(report) };
  });
  const batch = await client.messages.batches.create({ requests });
  await writeJson(join(BATCH_DIR, `${batch.id}.json`), { createdAt: new Date().toISOString(), items });
  console.log(`submitted batch ${batch.id} with ${requests.length} requests`);
  console.log(`if this process stops, collect results later with: pnpm extract --resume-batch ${batch.id}`);
  return collectBatch(batch.id);
}

function report(usage: Usage, batch: boolean) {
  if (!usage.calls) return;
  const perIn = Math.round(usage.input / usage.calls);
  const perOut = Math.round(usage.output / usage.calls);
  console.log(`\n${MODEL}${batch ? ' (batch)' : ''}: ${usage.calls} reports, ${usage.input} input + ${usage.output} output tokens`);
  console.log(`average per report: ${perIn} input + ${perOut} output tokens`);
  console.log('multiply by the current per-token prices on https://claude.com/pricing to estimate cost.');
}

const args = parseArgs();
if (typeof args['resume-batch'] === 'string') {
  report(await collectBatch(args['resume-batch']), true);
} else {
  const limit = typeof args.limit === 'string' ? Number(args.limit) : undefined;
  const todo = await pending(yearsFromArgs(args), limit);
  console.log(`${todo.length} reports to extract`);
  if (todo.length) {
    const batch = !!args.batch;
    report(batch ? await extractBatch(todo) : await extractDirect(todo), batch);
  }
}
