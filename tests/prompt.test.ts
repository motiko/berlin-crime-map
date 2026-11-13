import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_META } from '../shared/categories.ts';
import { SYSTEM_PROMPT } from '../pipeline/lib/extraction.ts';
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
    for (const c of evalSet.cases) expect(CATEGORIES).toContain(c.expected);
  });

  it('overrides name real categories and give a reason', () => {
    for (const o of Object.values(overrides.reports) as { category?: string; why: string }[]) {
      if (o.category) expect(CATEGORIES).toContain(o.category);
      expect(o.why.length).toBeGreaterThan(10);
    }
  });
});
