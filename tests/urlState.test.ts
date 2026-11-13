import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../shared/categories.ts';
import type { Filters } from '../src/lib/filter.ts';
import { parseUrl, rangeOf, toSearch } from '../src/lib/urlState.ts';

const today = '2026-11-13';
const all = () => new Set(CATEGORIES);
const base: Filters = { from: '2026-10-14', to: today, categories: all(), district: '', query: '' };

describe('url state', () => {
  it('leaves the default view out of the URL', () => {
    expect(toSearch(base, null, today, '2020-01-01')).toBe('');
  });

  it('keeps presets relative and writes the other filters', () => {
    const s = toSearch(
      { from: '2026-11-06', to: today, categories: new Set(['shooting', 'knife'] as const), district: 'Neukölln', query: ' Hermannplatz ' },
      null,
      today,
      '2020-01-01',
    );
    expect(s).toBe('?range=7d&cat=shooting%2Cknife&district=Neuk%C3%B6lln&q=Hermannplatz');
    const back = parseUrl(s);
    expect(back.range).toBe('7d');
    expect([...(back.categories ?? [])]).toEqual(['shooting', 'knife']);
    expect(back.district).toBe('Neukölln');
    expect(back.query).toBe('Hermannplatz');
  });

  it('uses exact dates for a selected incident and for custom ranges', () => {
    expect(toSearch(base, '1735173', today, null)).toBe('?from=2026-10-14&to=2026-11-13&incident=1735173');
    const custom = toSearch({ ...base, from: '2026-05-01', to: '2026-05-31' }, null, today, null);
    expect(parseUrl(custom)).toMatchObject({ range: null, from: '2026-05-01', to: '2026-05-31' });
  });

  it('recognises "all" once the start of the data is known', () => {
    expect(rangeOf('2020-01-01', today, today, '2020-01-01')).toBe('all');
    expect(rangeOf('2020-01-01', today, today, null)).toBeNull();
  });

  it('ignores invalid values', () => {
    const s = parseUrl('?range=5y&cat=nonsense&district=Atlantis&incident=abc&from=2026-13-99&to=x');
    expect(s).toMatchObject({ range: '30d', categories: null, district: '', incident: null, from: null });
  });
});
