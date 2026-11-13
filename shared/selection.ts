/**
 * Legend-style multi-select:
 * - with everything selected, clicking an item shows only that item;
 * - otherwise a click adds or removes the item;
 * - removing the last item, or adding back the last missing one, returns to "all".
 */
export function nextSelection<T>(all: readonly T[], current: ReadonlySet<T>, clicked: T): Set<T> {
  if (current.size === all.length) return new Set([clicked]);
  const next = new Set(current);
  if (next.has(clicked)) next.delete(clicked);
  else next.add(clicked);
  return next.size === 0 ? new Set(all) : next;
}
