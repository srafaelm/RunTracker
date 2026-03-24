import { useState, useMemo } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTileStats, useTileGeoJson, useAdvancedExploration } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import { tilesApi } from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';

const N = 32768; // 2^15 zoom tiles

function tileToLatLon(tileX: number, tileY: number) {
  const lon = (tileX / N) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / N))) * (180 / Math.PI);
  return { lat, lon };
}

function tileToPolygonCoords(tileX: number, tileY: number) {
  const w = (tileX / N) * 360 - 180;
  const e = ((tileX + 1) / N) * 360 - 180;
  const n = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / N))) * (180 / Math.PI);
  const s = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / N))) * (180 / Math.PI);
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

function scoreLabel(score: number) {
  if (score >= 100000) return 'Master Explorer';
  if (score >= 50000) return 'Expert Explorer';
  if (score >= 20000) return 'Seasoned Explorer';
  if (score >= 5000) return 'Explorer';
  if (score >= 1000) return 'Adventurer';
  return 'Beginner';
}

export default function TilesPage() {
  const { data: stats, isLoading: statsLoading } = useTileStats();
  const { data: geoJson, isLoading: geoLoading } = useTileGeoJson();
  const { data: advanced, isLoading: advLoading } = useAdvancedExploration();
  const [reprocessing, setReprocessing] = useState(false);
  const [showMaxSquare, setShowMaxSquare] = useState(true);
  const [showChallenge, setShowChallenge] = useState(true);
  const queryClient = useQueryClient();

  const bounds = useMemo(() => {
    if (!geoJson?.features?.length) return null;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const f of geoJson.features) {
      for (const ring of f.geometry.coordinates) {
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
    return minLng !== Infinity
      ? [[minLng - 0.01, minLat - 0.01], [maxLng + 0.01, maxLat + 0.01]] as [[number, number], [number, number]]
      : null;
  }, [geoJson]);

  // Build max-square GeoJSON overlay
  const maxSquareGeoJson = useMemo(() => {
    if (!advanced?.maxSquareOrigin || advanced.maxSquareSize < 2) return null;
    const { tileX: ox, tileY: oy } = advanced.maxSquareOrigin;
    const size = advanced.maxSquareSize;
    const coords = tileToPolygonCoords(ox, oy);
    // Expand to cover all tiles in the square
    const w = (ox / N) * 360 - 180;
    const e = ((ox + size) / N) * 360 - 180;
    const nLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * oy) / N))) * (180 / Math.PI);
    const sLat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (oy + size)) / N))) * (180 / Math.PI);
    const ring = [[w, sLat], [e, sLat], [e, nLat], [w, nLat], [w, sLat]];
    return {
      type: 'FeatureCollection' as const,
      features: [{ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: {} }],
    };
    void coords; // suppress unused
  }, [advanced]);

  // Challenge tile GeoJSON
  const challengeGeoJson = useMemo(() => {
    if (!advanced?.challengeTile) return null;
    const { tileX, tileY } = advanced.challengeTile;
    const ring = tileToPolygonCoords(tileX, tileY);
    return {
      type: 'FeatureCollection' as const,
      features: [{ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: {} }],
    };
  }, [advanced]);

  const challengeCenter = useMemo(() => {
    if (!advanced?.challengeTile) return null;
    return tileToLatLon(advanced.challengeTile.tileX, advanced.challengeTile.tileY);
  }, [advanced]);

  async function handleReprocess() {
    if (reprocessing) return;
    setReprocessing(true);
    try {
      await tilesApi.reprocess();
      await queryClient.invalidateQueries({ queryKey: ['tiles'] });
    } finally {
      setReprocessing(false);
    }
  }

  if (statsLoading || geoLoading || advLoading) return <LoadingSpinner />;

  const visitedKm2 = stats ? Math.round(stats.visitedCount * 1.44) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold uppercase tracking-tight text-white">Tile Explorer</h1>
          <p className="text-sm text-[#767575] dark:text-[#767575] mt-1">
            Each tile is ~1.2km². Blue squares mark areas you've visited.
          </p>
        </div>
        <button
          onClick={handleReprocess}
          disabled={reprocessing}
          className="px-4 py-2 bg-[#cffc00] text-[#3b4a00] font-label font-bold text-xs uppercase tracking-widest hover:bg-[#c2ed00] transition-colors"
        >
          {reprocessing ? 'Reprocessing…' : 'Reprocess All'}
        </button>
      </div>

      {/* Basic stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-[#20201f] p-4">
          <p className="text-xs text-[#767575] dark:text-[#767575] uppercase tracking-wide">Tiles Visited</p>
          <p className="text-3xl font-bold text-[#cffc00] mt-1">
            {stats?.visitedCount.toLocaleString() ?? 0}
          </p>
        </div>
        <div className="bg-[#20201f] p-4">
          <p className="text-xs text-[#767575] dark:text-[#767575] uppercase tracking-wide">Area Covered</p>
          <p className="text-3xl font-bold text-[#cffc00] mt-1">
            ~{visitedKm2.toLocaleString()} km²
          </p>
        </div>
        <div className="bg-[#20201f] p-4">
          <p className="text-xs text-[#767575] dark:text-[#767575] uppercase tracking-wide">Max Square</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">
            {advanced?.maxSquareSize ?? 0}×{advanced?.maxSquareSize ?? 0}
          </p>
          <p className="text-xs text-[#767575] mt-0.5">tiles</p>
        </div>
        <div className="bg-[#20201f] p-4">
          <p className="text-xs text-[#767575] dark:text-[#767575] uppercase tracking-wide">Explorer Score</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {(advanced?.explorerScore ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-[#767575] mt-0.5">{scoreLabel(advanced?.explorerScore ?? 0)}</p>
        </div>
      </div>

      {/* Advanced exploration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Explorer rank */}
        <div className="bg-[#20201f] p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#adaaaa] mb-3">Explorer Ranking</h3>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-4xl font-bold text-amber-500">{advanced?.explorerPercentile ?? 0}%</p>
              <p className="text-sm text-[#767575] dark:text-[#767575] mt-1">
                Percentile — you explore more than{' '}
                <strong>{advanced?.explorerPercentile ?? 0}%</strong> of users
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-100 dark:bg-[#131313] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${advanced?.explorerPercentile ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-[#767575] mt-1.5">
            Score based on tiles visited, streets completed, and cities explored
          </p>
        </div>

        {/* Weekly challenge */}
        <div className="bg-[#20201f] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Weekly Challenge Tile</h3>
            {advanced?.challengeTile && (
              <button
                onClick={() => setShowChallenge((s) => !s)}
                className="text-xs text-[#cffc00] hover:text-white transition-colors"
              >
                {showChallenge ? 'Hide on map' : 'Show on map'}
              </button>
            )}
          </div>
          {advanced?.challengeTile ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                This week's target: tile{' '}
                <span className="font-mono text-xs bg-gray-100 dark:bg-[#131313] px-1 rounded">
                  ({advanced.challengeTile.tileX}, {advanced.challengeTile.tileY})
                </span>
              </p>
              <p className="text-xs text-[#767575] mt-2">
                An unvisited tile adjacent to your explored area. A new challenge is set each week.
              </p>
              {challengeCenter && (
                <p className="text-xs text-[#767575] mt-1">
                  ~{challengeCenter.lat.toFixed(4)}°N, {challengeCenter.lon.toFixed(4)}°E
                </p>
              )}
            </>
          ) : (
            <p className="font-label text-xs text-[#767575]">Start exploring to unlock weekly challenges!</p>
          )}
        </div>
      </div>

      {/* Max-square toggle */}
      {advanced?.maxSquareSize && advanced.maxSquareSize >= 2 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMaxSquare((s) => !s)}
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            {showMaxSquare ? 'Hide max square on map' : 'Show max square on map'}
          </button>
          <span className="font-label text-[10px] text-[#767575]">
            Your largest contiguous square: {advanced.maxSquareSize}×{advanced.maxSquareSize} ={' '}
            {(advanced.maxSquareSize * advanced.maxSquareSize * 1.44).toFixed(0)} km²
          </span>
        </div>
      )}

      {/* Map */}
      <div className="bg-[#20201f]-sm border border-[#484847]/30 overflow-hidden" style={{ height: 560 }}>
        {geoJson?.features?.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#767575] dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium">No tiles yet</p>
              <p className="text-sm mt-1">Sync your activities to see explored tiles appear here.</p>
            </div>
          </div>
        ) : (
          <Map
            initialViewState={
              bounds
                ? { bounds, fitBoundsOptions: { padding: 40 } }
                : { latitude: 51.5, longitude: 4.5, zoom: 9 }
            }
            style={{ width: '100%', height: '100%' }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          >
            {/* Visited tiles */}
            {geoJson && (
              <Source id="tiles" type="geojson" data={geoJson}>
                <Layer
                  id="tiles-fill"
                  type="fill"
                  paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.35 }}
                />
                <Layer
                  id="tiles-outline"
                  type="line"
                  paint={{ 'line-color': '#2563eb', 'line-width': 0.5, 'line-opacity': 0.6 }}
                />
              </Source>
            )}

            {/* Max square highlight */}
            {showMaxSquare && maxSquareGeoJson && (
              <Source id="max-square" type="geojson" data={maxSquareGeoJson}>
                <Layer
                  id="max-square-fill"
                  type="fill"
                  paint={{ 'fill-color': '#a855f7', 'fill-opacity': 0.25 }}
                />
                <Layer
                  id="max-square-outline"
                  type="line"
                  paint={{ 'line-color': '#7c3aed', 'line-width': 3, 'line-opacity': 0.9 }}
                />
              </Source>
            )}

            {/* Challenge tile highlight */}
            {showChallenge && challengeGeoJson && (
              <Source id="challenge" type="geojson" data={challengeGeoJson}>
                <Layer
                  id="challenge-fill"
                  type="fill"
                  paint={{ 'fill-color': '#f59e0b', 'fill-opacity': 0.4 }}
                />
                <Layer
                  id="challenge-outline"
                  type="line"
                  paint={{ 'line-color': '#d97706', 'line-width': 3, 'line-opacity': 1 }}
                />
              </Source>
            )}

            {/* Challenge marker */}
            {showChallenge && challengeCenter && (
              <Marker latitude={challengeCenter.lat} longitude={challengeCenter.lon} anchor="center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 border-2 border-white shadow-lg text-white text-sm font-bold">
                  !
                </div>
              </Marker>
            )}
          </Map>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-[#767575] dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-60 inline-block" /> Visited tiles
        </span>
        {advanced?.maxSquareSize && advanced.maxSquareSize >= 2 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-500 opacity-60 inline-block" /> Max square
          </span>
        )}
        {advanced?.challengeTile && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500 opacity-60 inline-block" /> Weekly challenge
          </span>
        )}
      </div>
    </div>
  );
}






