/**
 * Category regression check: re-extract hand-checked reports and compare with the expected
 * category. Run it after changing the prompt, the category definitions or the model.
 *
 *   pnpm eval
 *
 * Needs the raw reports locally (data/raw, from `pnpm scrape`) and OPENROUTER_API_KEY.
 * Costs well under one cent. Exits 1 if any case is wrong.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Category } from '../shared/categories.ts';
import type { RawReport } from '../shared/types.ts';
import { MODEL, extract } from './lib/extraction.ts';
import { RAW_DIR, ROOT, readJson, yearsWithData } from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (environment or .env).');
  process.exit(1);
}

interface Case {
  id: string;
  /** The right category, or several when more than one is defensible. */
  expected: Category | Category[];
  why: string;
  /** Optional wording checks on the English summary (case-insensitive regular expressions). */
  summaryMatches?: string;
  summaryNotMatches?: string;
}
const { cases } = await readJson<{ cases: Case[] }>(join(ROOT, 'tests/eval/categories.json'));
const years = await yearsWithData(RAW_DIR);

let wrong = 0;
let missing = 0;
let cost = 0;
console.log(`${cases.length} cases with ${MODEL}\n`);
await Promise.all(
  cases.map(async (c) => {
    const year = years.find((y) => existsSync(join(RAW_DIR, String(y), `${c.id}.json`)));
    if (year === undefined) {
      missing++;
      console.log(`  skip  ${c.id}  raw report not found locally`);
      return;
    }
    const report = await readJson<RawReport>(join(RAW_DIR, String(year), `${c.id}.json`));
    const result = await extract(report, apiKey);
    cost += result.cost;
    const got = result.extraction.category;
    const summary = result.extraction.summaryEn;
    const problems = [
      ![c.expected].flat().includes(got) && `expected ${[c.expected].flat().join(' or ')}, got ${got}`,
      c.summaryMatches && !new RegExp(c.summaryMatches, 'i').test(summary) && `summary lacks /${c.summaryMatches}/`,
      c.summaryNotMatches && new RegExp(c.summaryNotMatches, 'i').test(summary) && `summary has /${c.summaryNotMatches}/`,
    ].filter(Boolean);
    if (problems.length) wrong++;
    console.log(`  ${problems.length ? 'WRONG' : 'ok   '} ${c.id}  ${problems.length ? problems.join('; ') : got}  (${c.why})`);
    if (problems.length && (c.summaryMatches || c.summaryNotMatches)) console.log(`        summary: ${summary}`);
  }),
);

console.log(`\n${cases.length - wrong - missing} ok, ${wrong} wrong, ${missing} skipped; cost $${cost.toFixed(4)}`);
if (wrong) process.exitCode = 1;
