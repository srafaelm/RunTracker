import { useState, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { MapMouseEvent, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as polyline from '@mapbox/polyline';
import { usePlannedRoutes, useCreatePlannedRoute, useDeletePlannedRoute, useProfile } from '../../hooks/useQueries';
import { exportRouteGpx } from '../../utils/routeExport';
import { plannedRoutesApi } from '../../api/client';
import type { FeatureCollection, LineString } from 'geojson';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistanceKm(pts: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += haversineKm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return d;
}

function formatDist(km: number): string {
  return km >= 1 ? `${km.toFixed(2)} km` : `${(km * 1000).toFixed(0)} m`;
}

export default function RouteCreatorPage() {
  // waypoints stored as [lat, lng]
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const mapRef = useRef<MapRef>(null);

  // Generate route state
  const [genDistance, setGenDistance] = useState(10);
  const [genSeed, setGenSeed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genSource, setGenSource] = useState<'ors' | 'geometric' | null>(null);
  const [genError, setGenError] = useState('');

  function flyToCurrentLocation() {
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 });
      },
      () => setLocationError('Location access denied or unavailable.'),
    );
  }

  async function handleGenerate(seed: number) {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    setGenerating(true);
    setGenError('');
    setGenSource(null);
    try {
      const { data } = await plannedRoutesApi.generate({
        startLat: center.lat,
        startLng: center.lng,
        targetDistanceM: genDistance * 1000,
        seed,
      });
      setWaypoints(data.waypoints as [number, number][]);
      setGenSource(data.source as 'ors' | 'geometric');
      setSavedMessage('');
    } catch {
      setGenError('Route generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  const { data: profile } = useProfile();
  const { data: savedRoutes } = usePlannedRoutes();
  const createRoute = useCreatePlannedRoute();
  const deleteRoute = useDeletePlannedRoute();

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const { lat, lng } = e.lngLat;
    setWaypoints((prev) => [...prev, [lat, lng]]);
    setSavedMessage('');
  }, []);

  const removeWaypoint = (i: number) => {
    setWaypoints((prev) => prev.filter((_, idx) => idx !== i));
  };

  const clearRoute = () => {
    setWaypoints([]);
    setSavedMessage('');
  };

  const distanceKm = useMemo(() => totalDistanceKm(waypoints), [waypoints]);
  const distanceM = distanceKm * 1000;

  // GeoJSON line for the drawn route
  const routeGeoJson: FeatureCollection<LineString> = useMemo(() => ({
    type: 'FeatureCollection',
    features: waypoints.length >= 2
      ? [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            // GeoJSON uses [lng, lat]
            coordinates: waypoints.map(([lat, lng]) => [lng, lat]),
          },
          properties: {},
        }]
      : [],
  }), [waypoints]);

  const handleSave = async () => {
    if (!name.trim() || waypoints.length < 2) return;
    setSaving(true);
    try {
      const encoded = polyline.encode(waypoints);
      await createRoute.mutateAsync({
        name: name.trim(),
        distanceM,
        encodedPolyline: encoded,
      });
      setSavedMessage(`"${name.trim()}" saved!`);
      setName('');
      setWaypoints([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 shrink-0 bg-white dark:bg-gray-800 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Route Creator</h1>
            <button
              onClick={flyToCurrentLocation}
              title="Go to my location"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              My Location
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Click on the map to add waypoints</p>
          {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
        </div>

        {/* Current route builder */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Waypoints: {waypoints.length}
            </span>
            {waypoints.length > 0 && (
              <span className="text-sm font-semibold text-primary-600">
                {formatDist(distanceKm)}
              </span>
            )}
          </div>

          {waypoints.length > 0 && (
            <ol className="max-h-40 overflow-y-auto mb-3 space-y-1">
              {waypoints.map((pt, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
                  <span>{i + 1}. {pt[0].toFixed(4)}, {pt[1].toFixed(4)}</span>
                  <button
                    onClick={() => removeWaypoint(i)}
                    className="ml-2 text-red-400 hover:text-red-600"
                    aria-label="Remove waypoint"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route name…"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm mb-2 focus:border-primary-500 focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || waypoints.length < 2}
              className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Route'}
            </button>
            <button
              onClick={() => exportRouteGpx(name.trim() || 'route', waypoints)}
              disabled={waypoints.length < 2}
              title="Export current route as GPX"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              GPX
            </button>
            <button
              onClick={clearRoute}
              disabled={waypoints.length === 0}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {savedMessage && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">{savedMessage}</p>
          )}
        </div>

        {/* Generate Route */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Generate Route</h2>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Distance (km)</label>
            <input
              type="number"
              min={1}
              max={200}
              step={0.5}
              value={genDistance}
              onChange={(e) => setGenDistance(Math.max(1, parseFloat(e.target.value) || 1))}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Uses current map center as start point
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setGenSeed(0); handleGenerate(0); }}
              disabled={generating}
              className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <button
              onClick={() => { const next = genSeed + 1; setGenSeed(next); handleGenerate(next); }}
              disabled={generating || genSource === null}
              title="Generate a different route with the same distance"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↻ Alt
            </button>
          </div>
          {genError && <p className="mt-2 text-xs text-red-500">{genError}</p>}
          {genSource === 'geometric' && (
            <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
              Geometric fallback — add an ORS API key for road-following routes.
            </p>
          )}
          {genSource === 'ors' && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              Road-following route generated.
            </p>
          )}
        </div>

        {/* Saved routes list */}
        <div className="p-4 flex-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Saved Routes ({savedRoutes?.length ?? 0})
          </h2>
          {(!savedRoutes || savedRoutes.length === 0) ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No saved routes yet.</p>
          ) : (
            <ul className="space-y-2">
              {savedRoutes.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDist(r.distanceM / 1000)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => {
                        const pts = r.encodedPolyline ? polyline.decode(r.encodedPolyline) as [number, number][] : [];
                        exportRouteGpx(r.name, pts);
                      }}
                      disabled={!r.encodedPolyline}
                      title="Export as GPX"
                      className="text-blue-500 hover:text-blue-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      GPX
                    </button>
                    <button
                      onClick={() => deleteRoute.mutate(r.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          initialViewState={{
            latitude: profile?.homeLat ?? 51.9225,
            longitude: profile?.homeLng ?? 4.4792,
            zoom: 12,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          onClick={handleMapClick}
          cursor="crosshair"
        >
          {/* Drawn route line */}
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.85 }}
            />
          </Source>

          {/* Waypoint markers */}
          {waypoints.map(([lat, lng], i) => (
            <Marker key={i} latitude={lat} longitude={lng} anchor="center">
              <div
                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow"
                style={{ backgroundColor: i === 0 ? '#22c55e' : i === waypoints.length - 1 ? '#ef4444' : '#3b82f6', fontSize: 9 }}
              >
                {i + 1}
              </div>
            </Marker>
          ))}
        </Map>

        {waypoints.length === 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
            Click anywhere on the map to start building a route
          </div>
        )}
      </div>
    </div>
  );
}
