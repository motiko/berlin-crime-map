import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  germanDateTimeToIso,
  parseListing,
  parsePageCount,
  parseReportBody,
  reportIdFromUrl,
} from '../pipeline/lib/parse.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('parseListing', () => {
  const entries = parseListing(fixture('listing.html'));

  it('reads all 50 entries of an archive page', () => {
    expect(entries).toHaveLength(50);
  });

  it('reads date, title, district and absolute URL', () => {
    expect(entries[0]).toEqual({
      id: '1729665',
      url: 'https://www.berlin.de/polizei/polizeimeldungen/2026/pressemitteilung.1729665.php',
      publishedAt: '2026-10-22T12:21',
      title: 'Nachbarschaftsstreit in Mehrfamilienhaus',
      location: 'Neukölln',
    });
  });

  it('keeps non-ASCII characters and dashes in titles', () => {
    expect(entries.find((e) => e.id === '1729649')?.title).toBe('Verkehrsunfall – Rollerfahrer verletzt');
  });
});

describe('parsePageCount', () => {
  it('reads the total from the pager', () => {
    expect(parsePageCount(fixture('listing.html'))).toBe(27);
  });

  it('defaults to 1 without a pager', () => {
    expect(parsePageCount('<html></html>')).toBe(1);
  });
});

describe('parseReportBody', () => {
  it('returns the report text without the contact box', () => {
    const body = parseReportBody(fixture('report.html'));
    expect(body.startsWith('Nr. 0812')).toBe(true);
    expect(body).toContain('Meinekestraße');
    expect(body).not.toContain('Polizei Berlin\n');
    expect(body).not.toMatch(/<[a-z]/i);
  });
});

describe('helpers', () => {
  it('converts German date-times', () => {
    expect(germanDateTimeToIso('06.07.2026 11:20 Uhr')).toBe('2026-07-06T11:20');
    expect(germanDateTimeToIso('01.01.2026')).toBe('2026-01-01T00:00');
  });

  it('extracts the report id', () => {
    expect(reportIdFromUrl('/polizei/polizeimeldungen/2025/pressemitteilung.1625253.php')).toBe('1625253');
  });

  it('decodes entities', () => {
    expect(decodeEntities('A &#8211; B &amp; C &uuml;')).toBe('A – B & C ü');
  });
});
