import type { ListingEntry } from '../../shared/types.ts';

const BASE = 'https://www.berlin.de';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** "06.07.2026 11:20" -> "2026-07-06T11:20" */
export function germanDateTimeToIso(value: string): string {
  const m = value.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) throw new Error(`Unparseable date: ${value}`);
  const [, d, mo, y, h = '00', mi = '00'] = m;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function reportIdFromUrl(url: string): string {
  const m = url.match(/pressemitteilung\.(\d+)\.php/);
  if (!m) throw new Error(`No report id in URL: ${url}`);
  return m[1];
}

const LISTING_ITEM =
  /<div class="cell nowrap date">([^<]+?)<\/div>\s*<div class="cell text">\s*<a href="([^"]+)"\s*>([\s\S]*?)<\/a>(?:\s*<span class="category"><strong>Ereignisort: <\/strong>([^<]*)<\/span>)?/g;

export function parseListing(html: string): ListingEntry[] {
  const entries: ListingEntry[] = [];
  for (const m of html.matchAll(LISTING_ITEM)) {
    const [, date, href, title, location] = m;
    const url = href.startsWith('http') ? href : BASE + href;
    entries.push({
      id: reportIdFromUrl(url),
      url,
      publishedAt: germanDateTimeToIso(date),
      title: stripTags(title),
      location: location?.trim() ? decodeEntities(location.trim()) : null,
    });
  }
  return entries;
}

/** Total number of pages, from the pager text "3 / 27". Returns 1 when there is no pager. */
export function parsePageCount(html: string): number {
  const pager = html.match(/>\s*(\d+) \/ (\d+)\s*</);
  return pager ? Number(pager[2]) : 1;
}

/** The report body: the first "textile" block after the page title. */
export function parseReportBody(html: string): string {
  const titleAt = html.indexOf('<h1 class="title"');
  const start = html.indexOf('<div class="textile">', Math.max(titleAt, 0));
  if (start === -1) throw new Error('Report body not found');
  const end = html.indexOf('</div>', start);
  return stripTags(html.slice(start + '<div class="textile">'.length, end));
}
