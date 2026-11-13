import { describe, expect, it } from 'vitest';
import { nextSelection } from '../shared/selection.ts';

const ALL = ['shooting', 'knife', 'traffic'] as const;
const sel = (...items: (typeof ALL)[number][]) => new Set(items);

describe('nextSelection', () => {
  it('shows only the clicked item when everything is selected', () => {
    expect(nextSelection(ALL, sel(...ALL), 'knife')).toEqual(sel('knife'));
  });

  it('adds an unselected item', () => {
    expect(nextSelection(ALL, sel('knife'), 'shooting')).toEqual(sel('knife', 'shooting'));
  });

  it('removes a selected item', () => {
    expect(nextSelection(ALL, sel('knife', 'shooting'), 'knife')).toEqual(sel('shooting'));
  });

  it('returns to all instead of an empty selection', () => {
    expect(nextSelection(ALL, sel('knife'), 'knife')).toEqual(sel(...ALL));
  });

  it('adding the last missing item selects all', () => {
    expect(nextSelection(ALL, sel('knife', 'shooting'), 'traffic')).toEqual(sel(...ALL));
  });
});
