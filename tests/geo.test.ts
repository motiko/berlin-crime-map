import { describe, expect, it } from 'vitest';
import type { ExtractedReport } from '../shared/types.ts';
import { type DistrictOutlines, locate, metresOutside, usablePlaceName } from '../pipeline/lib/geo.ts';

describe('usablePlaceName', () => {
  it.each([
    'Görlitzer Park',
    'U-Bahnhof Hermannplatz',
    'James-Simon-Park',
    'Park-Klinik Weißensee',
    'Einkaufszentrum Alexa',
    'Hauptbahnhof',
  ])('keeps the named place %s', (name) => expect(usablePlaceName(name)).toBe(name));

  it.each([
    'Schulhof',
    'Café',
    'Hotel in Charlottenburg',
    'Grundschule in Hellersdorf',
    'Koranschule in Kreuzberg',
    'Filiale der Berliner Volksbank',
    'Supermarkt-Parkplatz in Buch',
    'Mutter-Kind-Einrichtung',
    'psychiatrische Ambulanz',
    'Nachtbus N8',
    'U-Bahn Linie U2 (Richtung Pankow)',
    'Warschauer Brücke, Alexanderplatz, Görlitzer Park/Wrangelkiez, Kottbusser Tor',
    'U-Bahnhöfe Westhafen und Zoologischer Garten',
  ])('rejects %s', (name) => expect(usablePlaceName(name)).toBeNull());

  it('takes the named place out of a generic one', () => {
    expect(usablePlaceName('Spielplatz im Volkspark Humboldthain')).toBe('Volkspark Humboldthain');
    expect(usablePlaceName('Imbiss im S-Bahnhof Adlershof')).toBe('S-Bahnhof Adlershof');
    expect(usablePlaceName('S- und U-Bahnhof Alexanderplatz')).toBe('Bahnhof Alexanderplatz');
    expect(usablePlaceName('Polizeipräsidium, Foyer')).toBe('Polizeipräsidium');
  });
});

describe('locate', () => {
  // A square "district" around 13.40–13.42 E, 52.50–52.52 N.
  const square: [number, number][] = [[13.4, 52.5], [13.42, 52.5], [13.42, 52.52], [13.4, 52.52], [13.4, 52.5]];
  const outlines: DistrictOutlines = new Map([['Mitte', [square]]]);
  const report = (placeName: string | null, street: string | null = null) =>
    ({
      id: '1',
      location: 'Mitte',
      extraction: { street, houseNumberOrCrossing: null, placeName, district: 'Mitte' },
    }) as unknown as ExtractedReport;

  it('measures distance outside a district', () => {
    expect(metresOutside([13.41, 52.51], [square])).toBe(0);
    expect(metresOutside([13.43, 52.51], [square])).toBeGreaterThan(600);
  });

  it('uses a hit inside the district', () => {
    const where = locate(report('Görlitzer Park'), { 'Görlitzer Park, Mitte, Berlin': { lat: 52.51, lng: 13.41 } }, outlines);
    expect(where.precision).toBe('street');
  });

  it('falls back to the district centre when the hit is far outside the district', () => {
    const where = locate(report(null, 'Hauptstraße'), { 'Hauptstraße, Mitte, Berlin': { lat: 52.6, lng: 13.3 } }, outlines);
    expect(where.precision).toBe('district');
  });

  it('never geocodes a generic place name', () => {
    const where = locate(report('Schulhof'), { 'Schulhof, Mitte, Berlin': { lat: 52.51, lng: 13.41 } }, outlines);
    expect(where.precision).toBe('district');
  });
});
