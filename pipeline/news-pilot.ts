/**
 * Pilot: find news articles about incidents, via OpenRouter's web search (Exa).
 * Documented in docs/news-links/. Nothing here feeds the site yet.
 *
 *   pnpm news-pilot                          # 2026 shootings and homicides
 *   pnpm news-pilot --categories shooting --limit 10
 *   pnpm news-pilot --ids 1701194,1689852
 *   pnpm news-pilot --report                 # only summarise saved results
 *
 * For each incident, two calls:
 *   1. search: a short German query with the web plugin; only the returned results
 *      (url_citation annotations: url, title, excerpt) are used.
 *   2. check: a plain model call compares the police report with each candidate and
 *      decides whether it is the same incident (forced tool call).
 *
 * Results go to data/news-pilot/<id>.json (gitignored: they contain article excerpts).
 * Stops when the cost reaches --budget dollars (default 5). Rerunning skips incidents
 * that already have a result.
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORY_META } from '../shared/categories.ts';
import type { ExtractedReport, RawReport } from '../shared/types.ts';
import { HEADERS } from './lib/extraction.ts';
import { DATA, EXTRACTED_DIR, RAW_DIR, ROOT, parseArgs, readJson, readYear, writeJson } from './lib/store.ts';

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set (environment or .env).');
  process.exit(1);
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5';
export const OUT_DIR = join(DATA, 'news-pilot');

/** German-language outlets that cover Berlin crime. Kept broad for the pilot, to see which ones match. */
export const NEWS_DOMAINS = [
  'rbb24.de',
  'tagesspiegel.de',
  'berliner-zeitung.de',
  'morgenpost.de',
  'bz-berlin.de',
  'berliner-kurier.de',
  'taz.de',
  'bild.de',
  'tag24.de',
  'spiegel.de',
  'zeit.de',
  'welt.de',
  'n-tv.de',
  'stern.de',
  'rnd.de',
];

const args = parseArgs();
const budget = typeof args.budget === 'string' ? Number(args.budget) : 5;
const limit = typeof args.limit === 'string' ? Number(args.limit) : Infinity;
const categories = typeof args.categories === 'string' ? args.categories.split(',') : ['shooting', 'homicide'];
const ids = typeof args.ids === 'string' ? new Set(args.ids.split(',')) : null;
const year = typeof args.year === 'string' ? Number(args.year) : 2026;

interface Candidate {
  url: string;
  title: string;
  excerpt: string;
}

interface Verdict {
  url: string;
  same_incident: boolean;
  confidence: 'high' | 'medium' | 'low';
  article_date: string | null;
  reason: string;
}

export interface PilotResult {
  id: string;
  category: string;
  date: string;
  title: string;
  query: string;
  candidates: Candidate[];
  verdicts: Verdict[];
  /** Candidates judged the same incident with high or medium confidence. */
  matches: { url: string; title: string; outlet: string; confidence: string; article_date: string | null; reason: string }[];
  cost: { search: number; check: number };
  checkedAt: string;
}

const outlet = (url: string) => new URL(url).hostname.replace(/^www\./, '');

async function post(body: unknown): Promise<{ data: any; cost: number }> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: HEADERS(apiKey as string), body: JSON.stringify(body) });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
      continue;
    }
    const data = (await res.json()) as any;
    if (!res.ok || data.error) throw new Error(`OpenRouter ${res.status}: ${data.error?.message ?? 'request failed'}`);
    return { data, cost: data.usage?.cost ?? 0 };
  }
}

/** A short German query: what a newsroom headline about this incident would contain. */
function buildQuery(report: ExtractedReport): string {
  const x = report.extraction;
  const where = [x.street, x.placeName].find(Boolean);
  const district = x.district ?? report.location ?? '';
  const d = new Date(`${(x.incidentDate ?? report.publishedAt).slice(0, 10)}T12:00:00Z`);
  const month = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return [report.title, where, district, 'Berlin', month].filter(Boolean).join(' ');
}

async function search(query: string): Promise<{ candidates: Candidate[]; cost: number }> {
  const { data, cost } = await post({
    model: MODEL,
    messages: [{ role: 'user', content: query }],
    plugins: [{ id: 'web', engine: 'exa', max_results: 6, include_domains: NEWS_DOMAINS }],
    max_tokens: 16,
    temperature: 0,
    usage: { include: true },
  });
  const annotations: any[] = data.choices?.[0]?.message?.annotations ?? [];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const a of annotations) {
    const c = a.url_citation;
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    candidates.push({ url: c.url, title: c.title ?? '', excerpt: (c.content ?? '').slice(0, 1500) });
  }
  return { candidates, cost };
}

const CHECK_PROMPT = `You compare a Berlin police press release with news articles found by a web search, and decide for each article whether it reports on the SAME incident (same event, place and date; a later article about the same case, e.g. an arrest or a verdict, also counts).
Be strict: a similar crime at another place or date is not the same incident. Many articles are round-ups or about other cases. Only answer same_incident=true when place, date and circumstances fit. If the article excerpt is too thin to tell, answer false with low confidence.
Call the record_verdicts tool once, with one entry per article, using the article URLs exactly as given.`;

const CHECK_TOOL = {
  type: 'function',
  function: {
    name: 'record_verdicts',
    description: 'Record, for each article, whether it is about the same incident as the police report.',
    parameters: {
      type: 'object',
      properties: {
        verdicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              same_incident: { type: 'boolean' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              article_date: { type: ['string', 'null'], description: 'Publication date of the article if visible, YYYY-MM-DD' },
              reason: { type: 'string', description: 'One short sentence' },
            },
            required: ['url', 'same_incident', 'confidence', 'article_date', 'reason'],
          },
        },
      },
      required: ['verdicts'],
    },
  },
};

async function check(report: ExtractedReport, raw: RawReport, candidates: Candidate[]): Promise<{ verdicts: Verdict[]; cost: number }> {
  if (!candidates.length) return { verdicts: [], cost: 0 };
  const x = report.extraction;
  const police = [
    `Published: ${report.publishedAt}`,
    `Incident date: ${x.incidentDate ?? 'unknown'}`,
    `Place: ${[x.street, x.houseNumberOrCrossing, x.placeName, x.district].filter(Boolean).join(', ')}`,
    `Title: ${report.title}`,
    `Text: ${raw.body.slice(0, 2500)}`,
  ].join('\n');
  const articles = candidates
    .map((c, i) => `Article ${i + 1}\nURL: ${c.url}\nTitle: ${c.title}\nExcerpt: ${c.excerpt}`)
    .join('\n\n');
  const { data, cost } = await post({
    model: MODEL,
    messages: [
      { role: 'system', content: CHECK_PROMPT },
      { role: 'user', content: `POLICE REPORT\n${police}\n\nARTICLES\n${articles}` },
    ],
    tools: [CHECK_TOOL],
    tool_choice: { type: 'function', function: { name: 'record_verdicts' } },
    max_tokens: 1500,
    temperature: 0,
    usage: { include: true },
  });
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  const verdicts: Verdict[] = call ? JSON.parse(call.function.arguments).verdicts ?? [] : [];
  return { verdicts, cost };
}

async function runPilot() {
  const reports = (await readYear<ExtractedReport>(EXTRACTED_DIR, year))
    .filter((r) => (ids ? ids.has(r.id) : categories.includes(r.extraction.category)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
  console.log(`${reports.length} incidents (${ids ? 'by id' : categories.join(', ')}, ${year}); budget $${budget}`);

  let spent = 0;
  let done = 0;
  for (const report of reports) {
    const out = join(OUT_DIR, `${report.id}.json`);
    if (existsSync(out)) continue;
    if (spent >= budget) {
      console.warn(`budget of $${budget} reached; stopping`);
      break;
    }
    try {
      const raw = await readJson<RawReport>(join(RAW_DIR, String(year), `${report.id}.json`));
      const query = buildQuery(report);
      const s = await search(query);
      const c = await check(report, raw, s.candidates);
      spent += s.cost + c.cost;
      const byUrl = new Map(s.candidates.map((cand) => [cand.url, cand]));
      const matches = c.verdicts
        .filter((v) => v.same_incident && v.confidence !== 'low' && byUrl.has(v.url))
        .map((v) => ({
          url: v.url,
          title: byUrl.get(v.url)!.title,
          outlet: outlet(v.url),
          confidence: v.confidence,
          article_date: v.article_date,
          reason: v.reason,
        }));
      const result: PilotResult = {
        id: report.id,
        category: report.extraction.category,
        date: report.extraction.incidentDate ?? report.publishedAt.slice(0, 10),
        title: report.title,
        query,
        candidates: s.candidates,
        verdicts: c.verdicts,
        matches,
        cost: { search: s.cost, check: c.cost },
        checkedAt: new Date().toISOString(),
      };
      await writeJson(out, result);
      done++;
      console.log(`  ${report.id} ${s.candidates.length} candidates, ${matches.length} matches  ($${spent.toFixed(3)})`);
    } catch (error) {
      console.warn(`  failed ${report.id}: ${(error as Error).message.slice(0, 200)}`);
    }
  }
  console.log(`\n${done} incidents searched, $${spent.toFixed(3)} spent this run`);
}

async function report() {
  if (!existsSync(OUT_DIR)) return;
  const results = await Promise.all(
    (await readdir(OUT_DIR)).filter((f) => f.endsWith('.json')).map((f) => readJson<PilotResult>(join(OUT_DIR, f))),
  );
  const withMatch = results.filter((r) => r.matches.length);
  const cost = results.reduce((s, r) => s + r.cost.search + r.cost.check, 0);
  const outlets = new Map<string, number>();
  for (const r of results) for (const m of r.matches) outlets.set(m.outlet, (outlets.get(m.outlet) ?? 0) + 1);
  const cands = results.reduce((s, r) => s + r.candidates.length, 0);
  console.log(`incidents: ${results.length}`);
  for (const cat of new Set(results.map((r) => r.category))) {
    const rs = results.filter((r) => r.category === cat);
    console.log(`  ${CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label ?? cat}: ${rs.filter((r) => r.matches.length).length} of ${rs.length} with at least one article`);
  }
  console.log(`with at least one article: ${withMatch.length} (${Math.round((100 * withMatch.length) / Math.max(1, results.length))}%)`);
  console.log(`candidates: ${cands} (avg ${(cands / Math.max(1, results.length)).toFixed(1)}), matches: ${results.reduce((s, r) => s + r.matches.length, 0)}`);
  console.log(`cost: $${cost.toFixed(3)} total, $${(cost / Math.max(1, results.length)).toFixed(4)} per incident`);
  console.log('matches per outlet:', Object.fromEntries([...outlets].sort((a, b) => b[1] - a[1])));
}

if (args.report) await report();
else {
  await runPilot();
  await report();
}
