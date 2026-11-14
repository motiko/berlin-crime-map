import { describe, expect, it } from 'vitest';
import { duplicateIds, textSimilarity } from '../pipeline/lib/dedupe.ts';

const text = 'Ein Mann wurde gestern Abend in Kreuzberg durch einen Messerstich verletzt. Der Tatverdächtige flüchtete in den Görlitzer Park und wurde dort festgenommen.';
const other = 'Bei einer Durchsuchung in Neukölln fanden Einsatzkräfte Betäubungsmittel und Bargeld. Ein 31-Jähriger wurde vorläufig festgenommen.';

describe('duplicateIds', () => {
  it('keeps only the newest copy of a repeated release', () => {
    const drop = duplicateIds([
      { id: '100', title: 'Mann mit Messer verletzt', publishedAt: '2023-05-01T10:00', body: text },
      { id: '102', title: 'Mann mit Messer verletzt', publishedAt: '2023-05-01T10:01', body: text.replace('gestern Abend', 'gestern Nachmittag') },
    ]);
    expect([...drop]).toEqual(['100']);
  });

  it('keeps different incidents that share a generic title', () => {
    const drop = duplicateIds([
      { id: '1', title: 'Festnahme', publishedAt: '2024-01-01T09:00', body: text },
      { id: '2', title: 'Festnahme', publishedAt: '2024-01-01T15:00', body: other },
    ]);
    expect(drop.size).toBe(0);
  });

  it('keeps the same text on different days', () => {
    const drop = duplicateIds([
      { id: '1', title: 'A', publishedAt: '2024-01-01T09:00', body: text },
      { id: '2', title: 'A', publishedAt: '2024-01-02T09:00', body: text },
    ]);
    expect(drop.size).toBe(0);
  });

  it('measures text overlap', () => {
    expect(textSimilarity(text, text)).toBe(1);
    expect(textSimilarity(text, other)).toBeLessThan(0.1);
  });
});
