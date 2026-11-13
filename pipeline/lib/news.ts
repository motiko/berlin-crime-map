/**
 * News articles about incidents: search with OpenRouter's web plugin (Exa), then a separate
 * model call checks each candidate against the police report. See docs/news-links/.
 */
import type { ExtractedReport, NewsLink, RawReport } from '../../shared/types.ts';
import { HEADERS } from './extraction.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const NEWS_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5';

/** Berlin outlets first: they are preferred when choosing which links to show. */
export const LOCAL_OUTLETS = [
  'rbb24.de',
  'tagesspiegel.de',
  'berliner-zeitung.de',
  'morgenpost.de',
  'bz-berlin.de',
  'berliner-kurier.de',
  'taz.de',
  'tag24.de',
  'bild.de',
];
/** National outlets; they often run the same dpa wire text, so at most one is shown. */
export const NATIONAL_OUTLETS = ['zeit.de', 'n-tv.de', 'stern.de', 'welt.de', 'spiegel.de', 'rnd.de'];
export const NEWS_DOMAINS = [...LOCAL_OUTLETS, ...NATIONAL_OUTLETS];

export type ArticleType = 'report' | 'follow-up' | 'round-up' | 'live-blog';

export interface Candidate {
  url: string;
  title: string;
  excerpt: string;
}

export interface Verdict {
  url: string;
  same_incident: boolean;
  confidence: 'high' | 'medium' | 'low';
  article_type: ArticleType;
  article_date: string | null;
  reason: string;
}

/** What is stored per incident in data/news/<year>/<id>.json: no article text, only links. */
export interface NewsRecord {
  id: string;
  searches: string[];
  articles: {
    url: string;
    title: string;
    outlet: string;
    type: ArticleType;
    date: string | null;
    confidence: 'high' | 'medium';
    reason: string;
  }[];
}

export const outletOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

async function post(apiKey: string, body: unknown): Promise<{ data: any; cost: number }> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: HEADERS(apiKey), body: JSON.stringify(body) });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 3000 * 2 ** (attempt - 1)));
      continue;
    }
    const data = (await res.json()) as any;
    if (!res.ok || data.error) throw new Error(`OpenRouter ${res.status}: ${data.error?.message ?? 'request failed'}`);
    return { data, cost: data.usage?.cost ?? 0 };
  }
}

/** A short German query: what a headline about this incident would contain. */
export function buildQuery(report: ExtractedReport): string {
  const x = report.extraction;
  const where = [x.street, x.placeName].find(Boolean);
  const district = x.district ?? report.location ?? '';
  const d = new Date(`${(x.incidentDate ?? report.publishedAt).slice(0, 10)}T12:00:00Z`);
  const month = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return [report.title, where, district, 'Berlin', month].filter(Boolean).join(' ');
}

export async function searchNews(query: string, apiKey: string): Promise<{ candidates: Candidate[]; cost: number }> {
  const { data, cost } = await post(apiKey, {
    model: NEWS_MODEL,
    messages: [{ role: 'user', content: query }],
    plugins: [{ id: 'web', engine: 'exa', max_results: 6, include_domains: NEWS_DOMAINS }],
    max_tokens: 16,
    temperature: 0,
    usage: { include: true },
  });
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const a of data.choices?.[0]?.message?.annotations ?? []) {
    const c = a.url_citation;
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    candidates.push({ url: c.url, title: c.title ?? '', excerpt: (c.content ?? '').slice(0, 1500) });
  }
  return { candidates, cost };
}

const CHECK_PROMPT = `You compare a Berlin police press release with news articles found by a web search, and decide for each article whether it reports on the SAME incident (same event, place and date; a later article about the same case, e.g. an arrest, charges or a verdict, also counts).
Be strict: a similar crime at another place or date is not the same incident. Many articles are round-ups or about other cases. Only answer same_incident=true when place, date and circumstances fit. If the excerpt is too thin to tell, answer false with low confidence.
article_type: "report" if the article is mainly about this incident; "follow-up" if it is mainly about a later development of the same case (arrest, charges, trial, verdict); "round-up" if it covers several incidents (a chronicle, a list, a weekly summary, a news overview page); "live-blog" if it is a news ticker or live blog.
article_date: the publication date only if it is visible in the excerpt (e.g. "Stand: 09.02.2026" or "12.07.2026, 15:55 Uhr"), as YYYY-MM-DD; otherwise null. Never use the incident date as the article date.
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
              article_type: { type: 'string', enum: ['report', 'follow-up', 'round-up', 'live-blog'] },
              article_date: { type: ['string', 'null'] },
              reason: { type: 'string', description: 'One short sentence' },
            },
            required: ['url', 'same_incident', 'confidence', 'article_type', 'article_date', 'reason'],
          },
        },
      },
      required: ['verdicts'],
    },
  },
};

export async function checkNews(
  report: ExtractedReport,
  raw: RawReport,
  candidates: Candidate[],
  apiKey: string,
): Promise<{ verdicts: Verdict[]; cost: number }> {
  if (!candidates.length) return { verdicts: [], cost: 0 };
  const x = report.extraction;
  const police = [
    `Published: ${report.publishedAt}`,
    `Incident date: ${x.incidentDate ?? 'unknown'}`,
    `Place: ${[x.street, x.houseNumberOrCrossing, x.placeName, x.district].filter(Boolean).join(', ')}`,
    `Title: ${report.title}`,
    `Text: ${raw.body.slice(0, 2500)}`,
  ].join('\n');
  const articles = candidates.map((c, i) => `Article ${i + 1}\nURL: ${c.url}\nTitle: ${c.title}\nExcerpt: ${c.excerpt}`).join('\n\n');
  const { data, cost } = await post(apiKey, {
    model: NEWS_MODEL,
    messages: [
      { role: 'system', content: CHECK_PROMPT },
      { role: 'user', content: `POLICE REPORT\n${police}\n\nARTICLES\n${articles}` },
    ],
    tools: [CHECK_TOOL],
    tool_choice: { type: 'function', function: { name: 'record_verdicts' } },
    max_tokens: 1800,
    temperature: 0,
    usage: { include: true },
  });
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  const verdicts: Verdict[] = call ? (JSON.parse(call.function.arguments).verdicts ?? []) : [];
  return { verdicts, cost };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Strip the site name: everything after " | ", and a trailing " - n-tv.de" or " - WELT". */
export function cleanTitle(title: string): string {
  return title
    .split(' | ')[0]
    .replace(/\s+-\s+(n-tv\.de|WELT|STERN\.de|DIE ZEIT)$/i, '')
    .replace(/\s*\.\.\.$/, '…')
    .trim();
}

/** Merge accepted verdicts into the stored articles (a re-check can add new ones). */
export function mergeArticles(record: NewsRecord, candidates: Candidate[], verdicts: Verdict[]): void {
  const byUrl = new Map(candidates.map((c) => [c.url, c]));
  const known = new Set(record.articles.map((a) => a.url));
  for (const v of verdicts) {
    const c = byUrl.get(v.url);
    if (!c || !v.same_incident || v.confidence === 'low' || known.has(v.url)) continue;
    record.articles.push({
      url: v.url,
      title: cleanTitle(c.title),
      outlet: outletOf(v.url),
      type: v.article_type,
      date: v.article_date && DATE.test(v.article_date) ? v.article_date : null,
      confidence: v.confidence,
      reason: v.reason,
    });
  }
}

/**
 * The links the site shows: up to 3 articles about the incident (local outlets first, at
 * most one national outlet, since those mostly repeat the same dpa text), and up to 2
 * round-ups or live blogs as "also mentioned in" (outlet and date only).
 */
export function linksToShow(record: NewsRecord): NewsLink[] {
  const rank = (outlet: string) => {
    const i = LOCAL_OUTLETS.indexOf(outlet);
    return i >= 0 ? i : LOCAL_OUTLETS.length + NATIONAL_OUTLETS.indexOf(outlet);
  };
  const order = (a: NewsRecord['articles'][number], b: NewsRecord['articles'][number]) =>
    (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) || rank(a.outlet) - rank(b.outlet);

  const reports: NewsLink[] = [];
  const outlets = new Set<string>();
  // The same dpa text runs on several sites under the same headline: show it once.
  const headline = (t: string) => t.toLowerCase().replace(/^[^:]{1,25}:\s*/, '').replace(/[^a-zäöüß0-9]+/g, ' ').trim();
  const headlines = new Set<string>();
  let national = 0;
  for (const a of record.articles.filter((x) => x.type === 'report' || x.type === 'follow-up').sort(order)) {
    if (reports.length >= 3 || outlets.has(a.outlet) || headlines.has(headline(a.title))) continue;
    const isNational = NATIONAL_OUTLETS.includes(a.outlet);
    if (isNational && national >= 1) continue;
    if (isNational) national++;
    outlets.add(a.outlet);
    headlines.add(headline(a.title));
    reports.push({ url: a.url, title: a.title, outlet: a.outlet, date: a.date, kind: 'article' });
  }
  const mentions = record.articles
    .filter((x) => x.type === 'round-up' || x.type === 'live-blog')
    .sort(order)
    .slice(0, 2)
    .map((a): NewsLink => ({ url: a.url, title: null, outlet: a.outlet, date: a.date, kind: 'mention' }));
  return [...reports, ...mentions];
}
