import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBounds } from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 looks for its worker next to its own module, which Vite moves when bundling.
// The worker is self-contained, so serve it as an asset and point MapLibre at it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { CATEGORIES, CATEGORY_META } from '../../shared/categories.ts';
import type { Incident } from '../../shared/types.ts';

maplibregl.setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const BERLIN_CENTER: [number, number] = [13.405, 52.515];

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: LngLatBounds) => void;
}

function toGeoJson(incidents: Incident[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: incidents
      .filter((i) => i.lat !== null && i.lng !== null)
      .map((i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [i.lng as number, i.lat as number] },
        properties: { id: i.id, category: i.category, precision: i.precision },
      })),
  };
}

const categoryColor: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'category'],
  ...CATEGORIES.flatMap((c) => [c, CATEGORY_META[c].color]),
  CATEGORY_META.other.color,
] as unknown as maplibregl.ExpressionSpecification;

export function MapView({ incidents, selectedId, onSelect, onBoundsChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ incidents, onSelect, onBoundsChange });
  latest.current = { incidents, onSelect, onBoundsChange };

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: BERLIN_CENTER,
      zoom: 10,
      minZoom: 8,
      maxBounds: [
        [12.6, 52.2],
        [14.2, 52.85],
      ],
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('incidents', {
        type: 'geojson',
        data: toGeoJson(latest.current.incidents),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'incidents',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#334155',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 200, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'incidents',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'incidents',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': categoryColor,
          'circle-radius': 7,
          // Points placed at a district centre are hollow so they don't look like exact locations.
          'circle-opacity': ['case', ['==', ['get', 'precision'], 'district'], 0.15, 0.9],
          'circle-stroke-width': 2,
          'circle-stroke-color': ['case', ['==', ['get', 'precision'], 'district'], categoryColor, '#ffffff'],
        },
      });
      map.addLayer({
        id: 'selected',
        type: 'circle',
        source: 'incidents',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-stroke-color': '#111827' },
      });

      map.on('click', 'clusters', async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const source = map.getSource('incidents') as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties.id;
        if (id) latest.current.onSelect(String(id));
      });
      for (const layer of ['clusters', 'points']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
      map.on('moveend', () => latest.current.onBoundsChange(map.getBounds()));

      readyRef.current = true;
      latest.current.onBoundsChange(map.getBounds());
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource('incidents') as GeoJSONSource | undefined)?.setData(toGeoJson(incidents));
  }, [incidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setFilter('selected', ['==', ['get', 'id'], selectedId ?? '']);
    const incident = incidents.find((i) => i.id === selectedId);
    if (incident?.lat != null && incident.lng != null) {
      map.easeTo({ center: [incident.lng, incident.lat], zoom: Math.max(map.getZoom(), incident.precision === 'street' ? 15 : 12) });
    }
    // Only react to a new selection, not to every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={container} className="map" role="region" aria-label="Map of incidents" />;
}
