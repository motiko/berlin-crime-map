import type { Category } from './categories.ts';

/** One row from an archive listing page. */
export interface ListingEntry {
  id: string;
  url: string;
  /** ISO local date-time, e.g. 2026-07-06T11:20 */
  publishedAt: string;
  title: string;
  /** "Ereignisort" as printed by the police: a district or e.g. "berlinweit". */
  location: string | null;
}

/** A fetched report. Stored in data/raw (gitignored, never published). */
export interface RawReport extends ListingEntry {
  body: string;
  fetchedAt: string;
}

/** What the model extracts from one report. Stored in data/extracted. */
export interface Extraction {
  category: Category;
  incidentDate: string | null;
  street: string | null;
  houseNumberOrCrossing: string | null;
  placeName: string | null;
  district: string | null;
  summaryEn: string;
  injured: number | null;
  dead: number | null;
  weaponType: string | null;
}

export interface ExtractedReport extends ListingEntry {
  extraction: Extraction;
  model: string;
  extractedAt: string;
}

export type Precision = 'street' | 'district' | 'none';

/** One published incident, as served to the browser in public/data/<year>.json. */
export interface Incident {
  id: string;
  /** ISO date (YYYY-MM-DD): the incident date when known, otherwise the publication date. */
  date: string;
  publishedAt: string;
  category: Category;
  title: string;
  summary: string;
  location: string | null;
  place: string | null;
  lat: number | null;
  lng: number | null;
  precision: Precision;
  injured: number | null;
  dead: number | null;
  url: string;
}

export interface DataIndex {
  updatedAt: string;
  years: { year: number; count: number }[];
}
