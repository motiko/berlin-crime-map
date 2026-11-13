import { describe, expect, it } from 'vitest';
import { type NewsRecord, cleanTitle, linksToShow } from '../pipeline/lib/news.ts';
import { isDue } from '../pipeline/news.ts';

const art = (outlet: string, type: NewsRecord['articles'][number]['type'], confidence: 'high' | 'medium' = 'high') => ({
  url: `https://www.${outlet}/${outlet}-${type}`,
  title: `Headline ${outlet}`,
  outlet,
  type,
  date: '2026-11-10',
  confidence,
  reason: 'same',
});

describe('news links', () => {
  it('shows up to 3 articles, local outlets first, one national outlet at most', () => {
    const record: NewsRecord = {
      id: '1',
      searches: [],
      articles: [art('zeit.de', 'report'), art('n-tv.de', 'report'), art('stern.de', 'report'), art('bz-berlin.de', 'report'), art('rbb24.de', 'follow-up', 'medium')],
    };
    const links = linksToShow(record);
    expect(links.map((l) => l.outlet)).toEqual(['bz-berlin.de', 'zeit.de', 'rbb24.de']);
    expect(links.every((l) => l.kind === 'article')).toBe(true);
  });

  it('shows a syndicated headline only once', () => {
    const a = { ...art('tagesspiegel.de', 'report'), title: 'Kriminalität: Unbekannte sprengen Geldautomaten in Berlin-Lichtenberg' };
    const b = { ...art('stern.de', 'report'), title: 'Kriminalität: Unbekannte sprengen Geldautomaten in Berlin-Lichtenberg' };
    const c = { ...art('bz-berlin.de', 'report'), title: 'Heftige Explosion: Geldautomat bei Kaufland gesprengt' };
    expect(linksToShow({ id: '1', searches: [], articles: [a, b, c] }).map((l) => l.outlet)).toEqual(['tagesspiegel.de', 'bz-berlin.de']);
  });

  it('lists round-ups and live blogs as mentions without a headline', () => {
    const links = linksToShow({ id: '1', searches: [], articles: [art('tagesspiegel.de', 'round-up'), art('morgenpost.de', 'live-blog'), art('bz-berlin.de', 'round-up')] });
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.kind === 'mention' && l.title === null)).toBe(true);
  });

  it('strips site names but keeps headline dashes', () => {
    expect(cleanTitle('Tödliche Schüsse am Bahnhof Zoo: Polizei sucht Zeugen | Polizei | BZ-BERLIN.de')).toBe('Tödliche Schüsse am Bahnhof Zoo: Polizei sucht Zeugen');
    expect(cleanTitle('Streit in Berlin endet mit Schussverletzung – Täter flüchtig - n-tv.de')).toBe('Streit in Berlin endet mit Schussverletzung – Täter flüchtig');
    expect(cleanTitle('Mann angeschossen - Polizei sucht Zeugen')).toBe('Mann angeschossen - Polizei sucht Zeugen');
  });

  it('searches new incidents, and once more 3 days after the police report', () => {
    const now = new Date('2026-11-13T06:00:00Z');
    expect(isDue(null, '2026-11-12T10:00', now)).toBe(true);
    const early: NewsRecord = { id: '1', searches: ['2026-11-12T12:00:00Z'], articles: [] };
    expect(isDue(early, '2026-11-12T10:00', now)).toBe(false); // too soon for the second search
    expect(isDue(early, '2026-11-12T10:00', new Date('2026-11-15T12:00:00Z'))).toBe(true);
    expect(isDue({ ...early, searches: [...early.searches, '2026-11-15T12:00:00Z'] }, '2026-11-12T10:00', new Date('2026-11-20'))).toBe(false);
    const late: NewsRecord = { id: '1', searches: ['2026-11-12T12:00:00Z'], articles: [] };
    expect(isDue(late, '2026-11-01T10:00', now)).toBe(false); // first search already came after 3 days
  });
});
