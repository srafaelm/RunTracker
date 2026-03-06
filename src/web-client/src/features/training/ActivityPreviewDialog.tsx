import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as polyline from '@mapbox/polyline';
import { useActivity, useProfile } from '../../hooks/useQueries';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';

interface Props {
  activityId: string;
  activityName: string;
  onClose: () => void;
}

const ZONE_COLORS = ['#60a5fa', '#4ade80', '#facc15', '#f97316', '#ef4444'];

export default function ActivityPreviewDialog({ activityId, activityName, onClose }: Props) {
  const { data: activity, isLoading } = useActivity(activityId);
  const { data: profile } = useProfile();

  const routeGeoJson = useMemo(() => {
    if (!activity) return null;
    const poly = activity.detailedPolyline || activity.summaryPolyline;
    if (!poly) return null;
    const coords = polyline.decode(poly).map(([lat, lng]) => [lng, lat]);
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    };
  }, [activity]);

  const bounds = useMemo(() => {
    if (!routeGeoJson) return null;
    const coords = routeGeoJson.geometry.coordinates;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return [[minLng - 0.01, minLat - 0.01], [maxLng + 0.01, maxLat + 0.01]] as [[number, number], [number, number]];
  }, [routeGeoJson]);

  const splits = useMemo(() => {
    if (!activity?.streams?.length) return [];
    const streams = activity.streams.filter((s) => s.distance != null && s.time != null);
    if (streams.length < 2) return [];
    const result: { km: number; pace: number; avgHr: number | null }[] = [];
    let kmMark = 1, segStartIdx = 0;
    for (let i = 1; i < streams.length; i++) {
      if (streams[i].distance! >= kmMark * 1000) {
        const seg = streams.slice(segStartIdx, i + 1);
        const distKm = (seg[seg.length - 1].distance! - seg[0].distance!) / 1000;
        const timeSec = seg[seg.length - 1].time! - seg[0].time!;
        const pace = distKm > 0 ? timeSec / 60 / distKm : 0;
        const hrVals = seg.filter((s) => s.heartRate != null).map((s) => s.heartRate!);
        const avgHr = hrVals.length > 0 ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length) : null;
        result.push({ km: kmMark, pace, avgHr });
        kmMark++; segStartIdx = i;
      }
    }
    return result;
  }, [activity]);

  const hrZoneBreakdown = useMemo(() => {
    if (!activity?.streams) return null;
    const streams = activity.streams.filter((s) => s.heartRate != null && s.time != null);
    if (streams.length < 2) return null;
    let zones = profile?.hrZones;
    if (!zones?.length) {
      const maxHr = Math.max(...streams.map((s) => s.heartRate!));
      if (maxHr < 100) return null;
      zones = [
        { zone: 1, label: 'Warm Up',   lower: 0,                          upper: Math.round(maxHr * 0.60) },
        { zone: 2, label: 'Easy',      lower: Math.round(maxHr * 0.60)+1, upper: Math.round(maxHr * 0.70) },
        { zone: 3, label: 'Aerobic',   lower: Math.round(maxHr * 0.70)+1, upper: Math.round(maxHr * 0.80) },
        { zone: 4, label: 'Threshold', lower: Math.round(maxHr * 0.80)+1, upper: Math.round(maxHr * 0.90) },
        { zone: 5, label: 'Maximum',   lower: Math.round(maxHr * 0.90)+1, upper: maxHr },
      ];
    }
    const zoneSecs = zones.map(() => 0);
    let totalSecs = 0;
    for (let i = 1; i < streams.length; i++) {
      const dt = streams[i].time! - streams[i-1].time!;
      if (dt <= 0 || dt > 60) continue;
      const hr = streams[i].heartRate!;
      const zi = zones.findIndex((z) => hr >= z.lower && hr <= z.upper);
      if (zi >= 0) { zoneSecs[zi] += dt; totalSecs += dt; }
    }
    if (totalSecs === 0) return null;
    return zones.slice(0, 5).map((z, i) => ({
      zone: z.zone, label: z.label, secs: zoneSecs[i],
      pct: Math.round((zoneSecs[i] / totalSecs) * 100),
    }));
  }, [activity, profile]);

  const fastestKm = useMemo(() => {
    if (splits.length < 2) return -1;
    return splits.reduce((best, s) => s.pace < best.pace ? s : best, splits[0]).km;
  }, [splits]);
  const slowestKm = useMemo(() => {
    if (splits.length < 2) return -1;
    return splits.reduce((worst, s) => s.pace > worst.pace ? s : worst, splits[0]).km;
  }, [splits]);

  const hasHrInSplits = splits.some((s) => s.avgHr != null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{activityName}</p>
            {activity && (
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDistance(activity.distance)} · {formatDuration(activity.movingTime)} · {formatPace(activity.averagePaceMinPerKm)} /km
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-3 shrink-0">×</button>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Loading activity…</div>
        ) : !activity ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Activity not found.</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Distance</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{formatDistance(activity.distance)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Time</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{formatDuration(activity.movingTime)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Pace</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{formatPace(activity.averagePaceMinPerKm)} /km</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Elevation</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{Math.round(activity.totalElevationGain)} m</p>
              </div>
              {activity.averageHeartRate != null && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Avg HR</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{Math.round(activity.averageHeartRate)} bpm</p>
                </div>
              )}
              {activity.calories != null && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Calories</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm mt-0.5">{activity.calories} kcal</p>
                </div>
              )}
            </div>

            {/* Map */}
            {routeGeoJson && bounds && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 200 }}>
                <Map
                  initialViewState={{ bounds, fitBoundsOptions: { padding: 30 } }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="https://tiles.openfreemap.org/styles/liberty"
                >
                  <Source id="route" type="geojson" data={routeGeoJson}>
                    <Layer id="route-line" type="line" paint={{ 'line-color': '#2563eb', 'line-width': 3 }} />
                  </Source>
                </Map>
              </div>
            )}

            {/* Splits + HR Zones side by side */}
            {(splits.length > 0 || hrZoneBreakdown) && (
              <div className={`grid gap-4 ${splits.length > 0 && hrZoneBreakdown ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Splits */}
                {splits.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Splits per km</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <th className="text-left pb-1 font-medium">km</th>
                            <th className="text-right pb-1 font-medium">Pace</th>
                            {hasHrInSplits && <th className="text-right pb-1 font-medium">HR</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {splits.map((s) => (
                            <tr
                              key={s.km}
                              className={`border-b border-gray-50 dark:border-gray-700/50 ${
                                s.km === fastestKm ? 'text-green-600 dark:text-green-400' :
                                s.km === slowestKm ? 'text-red-500 dark:text-red-400' :
                                'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <td className="py-1 font-medium">{s.km}</td>
                              <td className="py-1 text-right tabular-nums">{formatPace(s.pace)} /km</td>
                              {hasHrInSplits && <td className="py-1 text-right tabular-nums">{s.avgHr != null ? `${s.avgHr}` : '—'}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* HR Zones */}
                {hrZoneBreakdown && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Time in HR Zones</p>
                    <div className="space-y-2">
                      {[...hrZoneBreakdown].reverse().map((z) => {
                        const color = ZONE_COLORS[z.zone - 1] ?? '#9ca3af';
                        const mm = Math.floor(z.secs / 60);
                        const ss = String(z.secs % 60).padStart(2, '0');
                        return (
                          <div key={z.zone}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Z{z.zone} · {z.label}</span>
                              <span className="tabular-nums text-gray-500 dark:text-gray-400">{z.secs > 0 ? `${mm}:${ss}` : '--:--'} ({z.pct}%)</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${z.pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end sticky bottom-0 bg-white dark:bg-gray-800">
          <Link
            to={`/activities/${activityId}`}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
            onClick={onClose}
          >
            View Full Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
