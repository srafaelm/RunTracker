import { useParams, Link } from 'react-router-dom';
import { useCityDetail, useCityGeoJson, useCityStreets } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as polyline from '@mapbox/polyline';
import { useMemo, useState } from 'react';
import { citiesApi } from '../../api/client';
import type { RouteSuggestion } from '../../types';

function streetStatus(isCompleted: boolean, pct: number): string {
  if (isCompleted) return 'Complete';
  if (pct > 0) return `In Progress`;
  return 'Not Started';
}

function streetStatusClass(isCompleted: boolean, pct: number): string {
  if (isCompleted) return 'text-green-600 dark:text-green-400 font-medium';
  if (pct > 0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-400 dark:text-gray-500';
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function CityDetailPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const { data: city, isLoading: cityLoading } = useCityDetail(cityId!);
  const { data: geoJson, isLoading: geoLoading } = useCityGeoJson(cityId!);

  const [showStreets, setShowStreets] = useState(false);
  const [streetPage, setStreetPage] = useState(1);
  const { data: streets } = useCityStreets(cityId!, { page: streetPage, pageSize: 20 });

  // Route suggestion state
  const [routeSuggestion, setRouteSuggestion] = useState<RouteSuggestion | null>(null);
  const [suggestingRoute, setSuggestingRoute] = useState(false);
  const [showRouteSuggestion, setShowRouteSuggestion] = useState(false);

  // Split GeoJSON into completed / in-progress / unvisited layers
  const { completedData, inProgressData, unvisitedData, bounds, centroid } = useMemo(() => {
    const completed: typeof geoJson = { type: 'FeatureCollection', features: [] };
    const inProgress: typeof geoJson = { type: 'FeatureCollection', features: [] };
    const unvisited: typeof geoJson = { type: 'FeatureCollection', features: [] };

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    let sumLat = 0, sumLon = 0, coordCount = 0;

    if (geoJson?.features) {
      for (const feature of geoJson.features) {
        const pct = feature.properties.completionPercentage;
        if (feature.properties.isCompleted) {
          completed.features.push(feature);
        } else if (pct > 0) {
          inProgress.features.push(feature);
        } else {
          unvisited.features.push(feature);
        }

        for (const [lng, lat] of feature.geometry.coordinates) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          sumLat += lat; sumLon += lng; coordCount++;
        }
      }
    }

    const b = minLng !== Infinity
      ? [[minLng - 0.005, minLat - 0.005], [maxLng + 0.005, maxLat + 0.005]] as [[number, number], [number, number]]
      : null;

    const ctr = coordCount > 0 ? { lat: sumLat / coordCount, lon: sumLon / coordCount } : null;

    return { completedData: completed, inProgressData: inProgress, unvisitedData: unvisited, bounds: b, centroid: ctr };
  }, [geoJson]);

  // Decode route suggestion polyline into GeoJSON
  const routeGeoJson = useMemo(() => {
    if (!routeSuggestion?.encodedPolyline) return null;
    const coords = polyline.decode(routeSuggestion.encodedPolyline).map(([lat, lng]) => [lng, lat]);
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: coords },
        properties: {},
      }],
    };
  }, [routeSuggestion]);

  async function handleSuggestRoute() {
    if (suggestingRoute || !cityId) return;
    setSuggestingRoute(true);
    try {
      const res = await citiesApi.getRouteSuggestion(
        cityId,
        centroid?.lat,
        centroid?.lon,
        8,
      );
      setRouteSuggestion(res.data);
      setShowRouteSuggestion(true);
    } catch {
      // no uncompleted streets nearby
      setRouteSuggestion(null);
    } finally {
      setSuggestingRoute(false);
    }
  }

  if (cityLoading || geoLoading) return <LoadingSpinner size="lg" />;
  if (!city) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">City not found</div>;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to="/streets" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0">
            ← Back
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{city.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {city.region ? `${city.region}, ` : ''}{city.country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div className="text-right">
            <p className="text-xl sm:text-2xl font-bold text-primary-600">
              {city.completionPercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">
              {city.completedStreets}/{city.totalStreets} streets
            </p>
          </div>
          <div className="hidden sm:block w-32">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full"
                style={{ width: `${Math.min(city.completionPercentage, 100)}%` }}
              />
            </div>
          </div>
          <button
            onClick={handleSuggestRoute}
            disabled={suggestingRoute}
            title="Suggest a coverage run through unvisited streets"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {suggestingRoute ? 'Suggesting…' : 'Suggest Route'}
          </button>
          <button
            onClick={() => setShowStreets((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              showStreets
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Streets
            {showStreets ? ' ↓' : ' ↑'}
          </button>
        </div>
      </div>

      {/* Route suggestion info bar */}
      {showRouteSuggestion && routeSuggestion && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-orange-800 dark:text-orange-200">
            Suggested route: <strong>{fmtDist(routeSuggestion.distanceM)}</strong> covering{' '}
            <strong>{routeSuggestion.streetCount}</strong> unvisited streets
          </span>
          <button
            onClick={() => setShowRouteSuggestion(false)}
            className="text-orange-500 hover:text-orange-700 dark:text-orange-400 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute bottom-6 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-green-500 inline-block" /> Completed
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-yellow-500 inline-block" /> In progress
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-gray-400 inline-block" /> Not visited
        </div>
        {showRouteSuggestion && (
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-orange-500 inline-block" /> Suggested route
          </div>
        )}
        {geoJson && (
          <p className="text-xs text-gray-400 mt-2">
            {geoJson.features.length} streets loaded
          </p>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <Map
          initialViewState={
            bounds
              ? { bounds, fitBoundsOptions: { padding: 40 } }
              : { latitude: 52, longitude: 5, zoom: 12 }
          }
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
        >
          {/* Unvisited streets (gray) */}
          <Source id="unvisited" type="geojson" data={unvisitedData}>
            <Layer
              id="unvisited-lines"
              type="line"
              paint={{ 'line-color': '#9ca3af', 'line-width': 2, 'line-opacity': 0.5 }}
            />
          </Source>

          {/* In-progress streets (yellow) */}
          <Source id="in-progress" type="geojson" data={inProgressData}>
            <Layer
              id="in-progress-lines"
              type="line"
              paint={{ 'line-color': '#eab308', 'line-width': 3, 'line-opacity': 0.8 }}
            />
          </Source>

          {/* Completed streets (green) */}
          <Source id="completed" type="geojson" data={completedData}>
            <Layer
              id="completed-lines"
              type="line"
              paint={{ 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.9 }}
            />
          </Source>

          {/* Suggested route (orange dashed) */}
          {showRouteSuggestion && routeGeoJson && (
            <Source id="route-suggestion" type="geojson" data={routeGeoJson}>
              <Layer
                id="route-suggestion-line"
                type="line"
                paint={{
                  'line-color': '#f97316',
                  'line-width': 4,
                  'line-opacity': 0.9,
                  'line-dasharray': [2, 1],
                }}
              />
            </Source>
          )}
        </Map>
      </div>

      {/* Streets panel */}
      {showStreets && (
        <div className="h-64 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Street</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {streets?.items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-gray-900 dark:text-white font-medium truncate max-w-xs">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 capitalize">{s.highwayType}</td>
                    <td className={`px-4 py-2 ${streetStatusClass(s.isCompleted, s.completionPercentage)}`}>
                      {streetStatus(s.isCompleted, s.completionPercentage)}
                      {!s.isCompleted && s.completionPercentage > 0 && (
                        <span className="ml-1 text-xs">({s.completionPercentage.toFixed(0)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {s.completedNodes}/{s.nodeCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {streets && streets.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <span>Page {streets.pageNumber} of {streets.totalPages} · {streets.totalCount} streets</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStreetPage((p) => Math.max(1, p - 1))}
                  disabled={!streets.hasPreviousPage}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setStreetPage((p) => p + 1)}
                  disabled={!streets.hasNextPage}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
