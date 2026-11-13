# Berlin Crime Map

A map of the [Berlin police press releases](https://www.berlin.de/polizei/polizeimeldungen/) (Polizeimeldungen), with a category, a location and a short English summary for each report. It updates every morning.

Live: https://berlin-crime-map.vercel.app

> Press releases are a selection the police choose to publish, not all crime. Counts on this map are not crime statistics.

## How it works

```
berlin.de archive ──scrape──▶ data/raw (local only)
                  ──extract (Claude)──▶ data/extracted/<year>/<id>.json
                  ──geocode (OSM Nominatim)──▶ data/geocode-cache.json
                  ──build-data──▶ public/data/<year>.json ──▶ static site (Vite + React + MapLibre)
```

- **Scrape** (`pipeline/scrape.ts`): reads the yearly archive listings and each new report, one request at a time with a pause between them. berlin.de rate-limits parallel requests.
- **Extract** (`pipeline/extract.ts`): Claude (`claude-haiku-5-5`) reads each German report and returns the category, street, date, harm counts and a two-sentence English summary without personal names.
- **Geocode** (`pipeline/geocode.ts`): places streets with OpenStreetMap Nominatim at one request per second, caching every query. Reports without a street are drawn as hollow dots at the district centre.
- **Build** (`pipeline/build-data.ts`): writes the per-year JSON files the site loads. The full German report text is not republished; every entry links to the original.

The site is fully static. Map tiles come from [OpenFreeMap](https://openfreemap.org).

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # parser tests
pnpm typecheck
pnpm build
```

## Data pipeline

Set `ANTHROPIC_API_KEY` in your environment or in a `.env` file (gitignored).

```bash
pnpm daily                                  # current year: scrape new, extract, geocode, build
pnpm scrape --year 2026 --limit 100         # fetch at most 100 new reports
pnpm extract --year 2026 --limit 100        # extract them and print token usage per report
pnpm geocode --year 2026
pnpm build-data
```

### Backfill

The archive goes back to 2020 in the current format. Scraping is slow by design (about 3.5 s per request, so several hours per year). Every step is resumable: rerun the same command after an interruption.

```bash
pnpm backfill --from 2020 --to 2025
# Extraction runs as one Message Batch (half price). If the process stops while waiting:
pnpm extract --resume-batch <batch id printed earlier>
```

## Automation

`.github/workflows/daily.yml` runs `pnpm daily` at 06:00 UTC and commits new data. Vercel redeploys on every push to `main`. The workflow needs the repository secret `ANTHROPIC_API_KEY`.
