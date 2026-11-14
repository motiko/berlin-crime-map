/**
 * The police sometimes publish the same press release twice or more (a correction a few
 * minutes later, or a technical repeat). They share title and day and have (nearly) the same
 * text. Different incidents can share a generic title ("Mutmaßlicher Drogenhändler
 * festgenommen"), so the text has to match too.
 */
export interface DedupeInput {
  id: string;
  title: string;
  publishedAt: string;
  body: string;
}

/** Overlap of three-word sequences, 0..1. */
export function textSimilarity(a: string, b: string): number {
  const shingles = (s: string) => {
    const w = s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ');
    const set = new Set<string>();
    for (let i = 0; i + 2 < w.length; i++) set.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return set;
  };
  const sa = shingles(a);
  const sb = shingles(b);
  if (!sa.size || !sb.size) return a.trim() === b.trim() ? 1 : 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / (sa.size + sb.size - shared);
}

export const DUPLICATE_SIMILARITY = 0.6;

/** Ids to drop: every copy except the newest (highest id) of each repeated release. */
export function duplicateIds(reports: DedupeInput[]): Set<string> {
  const groups = new Map<string, DedupeInput[]>();
  for (const r of reports) {
    const key = `${r.title.trim()}|${r.publishedAt.slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const drop = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const newestFirst = [...group].sort((a, b) => Number(b.id) - Number(a.id));
    const kept: DedupeInput[] = [];
    for (const r of newestFirst) {
      if (kept.some((k) => textSimilarity(k.body, r.body) >= DUPLICATE_SIMILARITY)) drop.add(r.id);
      else kept.push(r);
    }
  }
  return drop;
}
