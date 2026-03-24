import { useMemo, useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useActivities } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import ActivityFilters from '../../components/ActivityFilters';
import { SportType } from '../../types';
import * as polyline from '@mapbox/polyline';
import type { FeatureCollection, LineString, Point } from 'geojson';

type ViewMode = 'routes' | 'heatmap';

export default function MapExplorerPage() {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [sportType, setSportType] = useState<SportType | undefined>(SportType.Run);
  const [viewMode, setViewMode] = useState<ViewMode>('routes');

  const { data, isLoading } = useActivities({
    page: 1,
    pageSize: 1000,
    sportType,
    from: year ? `${year}-01-01` : undefined,
    to: year ? `${year}-12-31` : undefined,
  });

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const geoJsonData: FeatureCollection<LineString> = useMemo(() => {
    const features = (data?.items ?? [])
      .filter((a) => a.summaryPolyline)
      .map((a, idx) => {
        const coords = polyline.decode(a.summaryPolyline!).map(([lat, lng]) => [lng, lat]);
        return {
          type: 'Feature' as const,
          id: idx,
          geometry: { type: 'LineString' as const, coordinates: coords },
          properties: { name: a.name, date: a.startDate, distance: a.distance, pace: a.averagePaceMinPerKm },
        };
      });
    return { type: 'FeatureCollection', features };
  }, [data]);

  // For heatmap: sample every 5th point from all routes
  const heatmapData: FeatureCollection<Point> = useMemo(() => {
    const features: FeatureCollection<Point>['features'] = [];
    for (const f of geoJsonData.features) {
      const coords = (f.geometry as LineString).coordinates;
      for (let i = 0; i < coords.length; i += 5) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords[i] },
          properties: {},
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [geoJsonData]);

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      {/* Filters */}
      <div className="absolute top-4 left-4 z-10 bg-[#20201f]-lg p-3 flex flex-col gap-3">
        <ActivityFilters sportType={sportType} onSportTypeChange={setSportType} />
        <div>
          <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1">Year</label>
          <select
            value={year ?? ''}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-md border border-[#484847]/30 dark:bg-[#131313] dark:text-[#adaaaa] px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">All time</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1">View</label>
          <div className="flex rounded-md border border-[#484847]/30 overflow-hidden">
            {(['routes', 'heatmap'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-primary-600 text-white'
                    : 'bg-[#20201f] text-gray-600 dark:text-[#adaaaa] hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#767575] dark:text-gray-500">{geoJsonData.features.length} routes</p>
      </div>

      <Map
        initialViewState={{ latitude: 52, longitude: 5, zoom: 8 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      >
        {viewMode === 'routes' && (
          <Source id="routes" type="geojson" data={geoJsonData}>
            <Layer
              id="route-lines"
              type="line"
              paint={{ 'line-color': '#81ecff', 'line-width': 3, 'line-opacity': 1 }}
            />
          </Source>
        )}

        {viewMode === 'heatmap' && (
          <Source id="heatmap-pts" type="geojson" data={heatmapData}>
            <Layer
              id="heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': 0.5,
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 14, 2],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,255,0)',
                  0.2, 'rgba(65,105,225,0.6)',
                  0.4, 'rgba(0,128,0,0.7)',
                  0.6, 'rgba(255,165,0,0.8)',
                  0.8, 'rgba(255,69,0,0.9)',
                  1, 'rgba(255,0,0,1)',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 14, 20],
                'heatmap-opacity': 0.85,
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}






