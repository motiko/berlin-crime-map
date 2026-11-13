import { useEffect, useMemo, useState } from 'react';
import type { LngLatBounds } from 'maplibre-gl';
import { CATEGORIES, type Category } from '../shared/categories.ts';
import { nextSelection } from '../shared/selection.ts';
import type { DataIndex, Incident } from '../shared/types.ts';
import { About } from './components/About.tsx';
import { Filters } from './components/Filters.tsx';
import { IncidentCard } from './components/IncidentCard.tsx';
import { IncidentList } from './components/IncidentList.tsx';
import { MapView } from './components/MapView.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { loadIndex, loadRange } from './lib/data.ts';
import { type Filters as FilterState, applyFilters, countByCategory, formatDate, isoDaysAgo } from './lib/filter.ts';

const today = new Date().toISOString().slice(0, 10);

export function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    from: isoDaysAgo(30),
    to: today,
    categories: new Set(CATEGORIES),
    district: '',
    query: '',
  });
  const [bounds, setBounds] = useState<LngLatBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, [attempt]);

  useEffect(() => {
    if (!index) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRange(index, filters.from, filters.to)
      .then((data) => !cancelled && setIncidents(data))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [index, filters.from, filters.to, attempt]);

  const filtered = useMemo(() => applyFilters(incidents, filters), [incidents, filters]);
  const counts = useMemo(
    () => countByCategory(applyFilters(incidents, { ...filters, categories: new Set(CATEGORIES) })),
    [incidents, filters],
  );
  const inView = useMemo(() => {
    const visible = bounds
      ? filtered.filter((i) => i.lat === null || i.lng === null || bounds.contains([i.lng, i.lat]))
      : filtered;
    return [...visible].sort((a, b) => b.date.localeCompare(a.date) || b.publishedAt.localeCompare(a.publishedAt));
  }, [filtered, bounds]);
  const selected = selectedId ? (incidents.find((i) => i.id === selectedId) ?? null) : null;

  const minDate = index?.years.length ? `${index.years[0].year}-01-01` : today;

  const setCategories = (categories: Set<Category>) => setFilters((f) => ({ ...f, categories }));

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <div>
            <h1>Berlin Crime Map</h1>
            <p className="tagline">Every Berlin police press release, placed on the map.</p>
            {index && <p className="updated">Updated {formatDate(index.updatedAt)}</p>}
          </div>
          <button type="button" className="link" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </header>

        <Filters value={filters} minDate={minDate} maxDate={today} onChange={setFilters} />
        <StatsBar
          counts={counts}
          selected={filters.categories}
          onSelect={(c) => setCategories(nextSelection(CATEGORIES, filters.categories, c))}
          onAll={() => setCategories(new Set(CATEGORIES))}
        />

        {selected && <IncidentCard incident={selected} onClose={() => setSelectedId(null)} />}

        {error ? (
          <div className="error" role="alert">
            <p>Could not load the data: {error}</p>
            <button type="button" className="primary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="skeleton" aria-busy="true" aria-label="Loading incidents">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : (
          <IncidentList incidents={inView} total={filtered.length} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </aside>

      <main className="map-wrap">
        <MapView incidents={filtered} selectedId={selectedId} district={filters.district} onSelect={setSelectedId} onBoundsChange={setBounds} />
      </main>

      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
