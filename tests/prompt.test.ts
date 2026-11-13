import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_META } from '../shared/categories.ts';
import { SYSTEM_PROMPT, gangWording } from '../pipeline/lib/extraction.ts';
import evalSet from './eval/categories.json' with { type: 'json' };
import overrides from '../pipeline/overrides.json' with { type: 'json' };

describe('extraction prompt', () => {
  it('defines every category for the model', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_META[c].definition.length).toBeGreaterThan(20);
      expect(SYSTEM_PROMPT).toContain(`- ${c}: ${CATEGORY_META[c].definition}`);
    }
  });

  it('separates theft from robbery and threats from robbery', () => {
    expect(CATEGORY_META.robbery.definition).toMatch(/NOT robbery/);
    expect(CATEGORY_META.burglary.definition).toMatch(/Taschendiebstahl/);
    expect(CATEGORY_META.assault.definition).toMatch(/Bedrohung/);
    expect(SYSTEM_PROMPT).toMatch(/resisting arrest/);
  });

  it('eval cases name real categories', () => {
    for (const c of evalSet.cases) for (const e of [c.expected].flat()) expect(CATEGORIES).toContain(e);
  });

  it('overrides name real categories and give a reason', () => {
    for (const o of Object.values(overrides.reports) as { category?: string; why: string }[]) {
      if (o.category) expect(CATEGORIES).toContain(o.category);
      expect(o.why.length).toBeGreaterThan(10);
    }
  });

  it('translates criminal Gruppierung / kriminelle Vereinigung as gang, after extraction', () => {
    expect(gangWording('Police arrested a member of a group suspected of shootings.', 'gegen eine Gruppierung', 'shooting')).toBe(
      'Police arrested a member of a gang suspected of shootings.',
    );
    expect(gangWording('Searches against a suspected criminal group.', 'Bildung einer kriminellen Vereinigung', 'raid')).toBe(
      'Searches against a suspected criminal gang.',
    );
    // kept: political camps, groups of people, reports without these words
    expect(gangWording('Two groups clashed.', 'zwischen zwei Gruppierungen', 'political')).toBe('Two groups clashed.');
    expect(gangWording('A group of teenagers attacked a man.', 'eine Gruppierung', 'assault')).toBe('A group of teenagers attacked a man.');
    expect(gangWording('A group attacked two men.', 'eine Personengruppe', 'assault')).toBe('A group attacked two men.');
  });
});
