import { useParams, Link } from 'react-router-dom';
import { useActivity, useAddTagToActivity, useRemoveTagFromActivity, useTags, useCreateTag, useGear, useAssignGear, useCreateGear, useProfile, useFetchActivityWeather, useIntervalAnalysis, usePersonalRecords } from '../../hooks/useQueries';
import type { Tag } from '../../types';
import { GearType } from '../../types';
import TagPicker from '../../components/TagPicker';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatDateTime,
  sportTypeName,
  recordTypeName,
} from '../../utils/formatters';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as polyline from '@mapbox/polyline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMemo, useState } from 'react';
import { exportGpx, exportTcx } from '../../utils/routeExport';

interface KmSplit {
  km: number;
  pace: number; // min/km
  avgHr: number | null;
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: activity, isLoading } = useActivity(id!);
  const activityTags = activity?.tags ?? [];
  const { data: allTags = [] } = useTags();
  const addTag = useAddTagToActivity(id!);
  const removeTag = useRemoveTagFromActivity(id!);
  const createTag = useCreateTag();
  const { data: allGear = [] } = useGear();
  const assignGear = useAssignGear();
  const createGear = useCreateGear();
  const { data: profile } = useProfile();
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showGearPicker, setShowGearPicker] = useState(false);
  const [newGearName, setNewGearName] = useState('');
  const fetchWeather = useFetchActivityWeather(id!);
  const { data: intervalData } = useIntervalAnalysis(id!);
  const { data: allPrs } = usePersonalRecords();
  const activityPrs = (allPrs ?? []).filter((pr) => pr.activityId === id);

  const routeGeoJson = useMemo(() => {
    if (!activity) return null;
    const poly = activity.detailedPolyline || activity.summaryPolyline;
    if (!poly) return null;

    const coords = polyline.decode(poly).map(([lat, lng]) => [lng, lat]);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: coords,
      },
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
    return [
      [minLng - 0.01, minLat - 0.01],
      [maxLng + 0.01, maxLat + 0.01],
    ] as [[number, number], [number, number]];
  }, [routeGeoJson]);

  const hrChartData = useMemo(() => {
    if (!activity?.streams) return [];
    return activity.streams
      .filter((s) => s.heartRate != null)
      .map((s) => ({
        distance: s.distance ? +(s.distance / 1000).toFixed(2) : s.pointIndex,
        hr: s.heartRate,
        altitude: s.altitude,
      }));
  }, [activity]);

  const minHeartRate = useMemo(() => {
    if (!activity?.streams) return null;
    const vals = activity.streams
      .filter((s) => s.heartRate != null)
      .map((s) => s.heartRate!);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [activity]);

  const splits = useMemo((): KmSplit[] => {
    if (!activity?.streams?.length) return [];
    const streams = activity.streams.filter(
      (s) => s.distance != null && s.time != null,
    );
    if (streams.length < 2) return [];

    const result: KmSplit[] = [];
    let kmMark = 1;
    let segStartIdx = 0;

    for (let i = 1; i < streams.length; i++) {
      if (streams[i].distance! >= kmMark * 1000) {
        const seg = streams.slice(segStartIdx, i + 1);
        const distKm =
          (seg[seg.length - 1].distance! - seg[0].distance!) / 1000;
        const timeSec = seg[seg.length - 1].time! - seg[0].time!;
        const pace = distKm > 0 ? timeSec / 60 / distKm : 0;
        const hrVals = seg
          .filter((s) => s.heartRate != null)
          .map((s) => s.heartRate!);
        const avgHr =
          hrVals.length > 0
            ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
            : null;
        result.push({ km: kmMark, pace, avgHr });
        kmMark++;
        segStartIdx = i;
      }
    }

    // Last partial km (at least 100m)
    const lastSeg = streams.slice(segStartIdx);
    if (lastSeg.length >= 2) {
      const distKm =
        (lastSeg[lastSeg.length - 1].distance! - lastSeg[0].distance!) / 1000;
      if (distKm > 0.1) {
        const timeSec = lastSeg[lastSeg.length - 1].time! - lastSeg[0].time!;
        const pace = timeSec / 60 / distKm;
        const hrVals = lastSeg
          .filter((s) => s.heartRate != null)
          .map((s) => s.heartRate!);
        const avgHr =
          hrVals.length > 0
            ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
            : null;
        result.push({ km: kmMark, pace, avgHr });
      }
    }

    return result;
  }, [activity]);

  const paceChartData = useMemo(() => {
    if (!activity?.streams) return [];
    const streams = activity.streams.filter(
      (s) => s.distance != null && s.time != null,
    );
    if (streams.length < 2) return [];

    const WINDOW = 30; // rolling window for smoothing
    const result: { distance: number; pace: number; altitude: number | null | undefined }[] = [];
    for (let i = WINDOW; i < streams.length; i++) {
      const distDelta = streams[i].distance! - streams[i - WINDOW].distance!;
      const timeDelta = streams[i].time! - streams[i - WINDOW].time!;
      if (distDelta > 0 && timeDelta > 0) {
        const pace = (timeDelta / 60) / (distDelta / 1000); // min/km
        if (pace > 2 && pace < 20) {
          result.push({
            distance: +(streams[i].distance! / 1000).toFixed(2),
            pace: +pace.toFixed(3),
            altitude: streams[i].altitude,
          });
        }
      }
    }
    return result;
  }, [activity]);

  const { fastestKm, slowestKm } = useMemo(() => {
    if (splits.length < 2) return { fastestKm: -1, slowestKm: -1 };
    let minPace = Infinity, maxPace = -Infinity;
    let fastestKm = -1, slowestKm = -1;
    for (const s of splits) {
      if (s.pace < minPace) { minPace = s.pace; fastestKm = s.km; }
      if (s.pace > maxPace) { maxPace = s.pace; slowestKm = s.km; }
    }
    return { fastestKm, slowestKm };
  }, [splits]);

  // HR zone time distribution
  const hrZoneBreakdown = useMemo(() => {
    if (!activity?.streams) return null;
    const streams = activity.streams.filter((s) => s.heartRate != null && s.time != null);
    if (streams.length < 2) return null;

    // Use profile zones if configured, otherwise derive from max HR in this activity
    let zones = profile?.hrZones;
    if (!zones?.length) {
      const hrValues = streams.map((s) => s.heartRate!);
      const maxHr = Math.max(...hrValues);
      if (maxHr < 100) return null;
      zones = [
        { zone: 1, label: 'Warm Up',    lower: 0,                    upper: Math.round(maxHr * 0.60) },
        { zone: 2, label: 'Easy',       lower: Math.round(maxHr * 0.60) + 1, upper: Math.round(maxHr * 0.70) },
        { zone: 3, label: 'Aerobic',    lower: Math.round(maxHr * 0.70) + 1, upper: Math.round(maxHr * 0.80) },
        { zone: 4, label: 'Threshold',  lower: Math.round(maxHr * 0.80) + 1, upper: Math.round(maxHr * 0.90) },
        { zone: 5, label: 'Maximum',    lower: Math.round(maxHr * 0.90) + 1, upper: maxHr },
      ];
    }

    const zoneSecs = zones.map(() => 0);
    let totalSecs = 0;
    for (let i = 1; i < streams.length; i++) {
      const dt = streams[i].time! - streams[i - 1].time!;
      if (dt <= 0 || dt > 60) continue;
      const hr = streams[i].heartRate!;
      const zi = zones.findIndex((z) => hr >= z.lower && hr <= z.upper);
      if (zi >= 0) { zoneSecs[zi] += dt; totalSecs += dt; }
    }
    if (totalSecs === 0) return null;
    return zones.slice(0, 5).map((z, i) => ({
      zone: z.zone,
      label: z.label,
      lower: z.lower,
      upper: z.upper,
      secs: zoneSecs[i],
      pct: Math.round((zoneSecs[i] / totalSecs) * 100),
    }));
  }, [activity, profile]);

  const hasSplits = splits.length > 0;
  const hasHrInSplits = splits.some((s) => s.avgHr != null);

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (!activity)
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">Activity not found</div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {activityPrs.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {activityPrs.map((pr) => (
            <div
              key={pr.recordType}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl text-sm font-semibold text-yellow-800 dark:text-yellow-300"
            >
              <span>🏆</span>
              <span>Personal Record — {recordTypeName(pr.recordType)}: {pr.displayValue}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{activity.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {formatDateTime(activity.startDate)} ·{' '}
            {sportTypeName(activity.sportType)}
          </p>
        </div>
        <Link
          to={`/activities/compare?with=${activity.id}`}
          className="shrink-0 mt-1 px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
        >
          <span>⇄</span> Compare
        </Link>
      </div>

      {/* Tags + Gear */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {activityTags.map((tag: Tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: tag.color ?? '#6b7280', color: '#fff' }}
          >
            {tag.name}
            <button
              onClick={() => removeTag.mutate(tag.id)}
              className="ml-0.5 hover:opacity-70"
              aria-label={`Remove tag ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowTagPicker((p) => !p)}
          className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600"
        >
          + Tag
        </button>
        {showTagPicker && (
          <TagPicker
            allTags={allTags}
            assignedTagIds={activityTags.map((t: Tag) => t.id)}
            onSelect={(tagId) => addTag.mutate(tagId)}
            onCreate={(name, color) => createTag.mutate({ name, color })}
            onClose={() => setShowTagPicker(false)}
          />
        )}

        {/* Gear pill / button */}
        {(() => {
          const assignedGear = allGear.find((g) => g.id === activity.gearId);
          if (assignedGear) {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                👟 {assignedGear.name}
                <button
                  onClick={() => assignGear.mutate({ activityId: id!, gearId: null })}
                  className="ml-0.5 hover:opacity-70"
                  aria-label="Remove gear"
                >
                  ×
                </button>
              </span>
            );
          }
          return (
            <div className="relative">
              <button
                onClick={() => { setShowGearPicker((p) => !p); setNewGearName(''); }}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600"
              >
                + Gear
              </button>
              {showGearPicker && (
                <div className="absolute z-20 top-8 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px]">
                  {allGear.length > 0 && (
                    <>
                      {allGear.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => { assignGear.mutate({ activityId: id!, gearId: g.id }); setShowGearPicker(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          👟 {g.name}{g.brand ? ` · ${g.brand}` : ''}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    </>
                  )}
                  <div className="px-3 py-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Create new gear</p>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Gear name"
                      value={newGearName}
                      onChange={(e) => setNewGearName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newGearName.trim()) {
                          createGear.mutate(
                            { name: newGearName.trim(), type: GearType.Shoes, startingDistanceM: 0 },
                            {
                              onSuccess: (gear) => {
                                assignGear.mutate({ activityId: id!, gearId: gear.id });
                                setShowGearPicker(false);
                                setNewGearName('');
                              },
                            }
                          );
                        }
                        if (e.key === 'Escape') setShowGearPicker(false);
                      }}
                      className="w-full text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 mb-1.5"
                    />
                    <button
                      disabled={!newGearName.trim() || createGear.isPending}
                      onClick={() => {
                        if (!newGearName.trim()) return;
                        createGear.mutate(
                          { name: newGearName.trim(), type: GearType.Shoes, startingDistanceM: 0 },
                          {
                            onSuccess: (gear) => {
                              assignGear.mutate({ activityId: id!, gearId: gear.id });
                              setShowGearPicker(false);
                              setNewGearName('');
                            },
                          }
                        );
                      }}
                      className="w-full text-xs px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                    >
                      {createGear.isPending ? 'Creating…' : 'Create & assign'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard title="Distance" value={formatDistance(activity.distance)} />
        <StatCard title="Duration" value={formatDuration(activity.movingTime)} />
        <StatCard
          title="Pace"
          value={`${formatPace(activity.averagePaceMinPerKm)} /km`}
        />
        <StatCard
          title="Elevation"
          value={`${Math.round(activity.totalElevationGain)} m`}
        />
        {activity.averageHeartRate && (
          <StatCard
            title="Avg HR"
            value={`${Math.round(activity.averageHeartRate)} bpm`}
          />
        )}
        {activity.maxHeartRate && (
          <StatCard title="Max HR" value={`${activity.maxHeartRate} bpm`} />
        )}
        {minHeartRate != null && (
          <StatCard title="Min HR" value={`${minHeartRate} bpm`} />
        )}
        {activity.averageCadence != null && (
          <StatCard
            title="Cadence"
            value={`${Math.round(activity.averageCadence * 2)} spm`}
          />
        )}
        {activity.calories && (
          <StatCard title="Calories" value={`${activity.calories} kcal`} />
        )}
        {activity.newStreetsDiscovered > 0 && (
          <StatCard title="New Streets" value={`${activity.newStreetsDiscovered}`} />
        )}
      </div>

      {/* Weather — compact inline strip */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 mb-6 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide shrink-0">Weather</span>
        {activity.weatherTempC != null ? (
          <>
            <span className="font-medium text-gray-900 dark:text-white">🌡 {activity.weatherTempC.toFixed(1)} °C</span>
            {activity.weatherCondition && <span className="text-gray-600 dark:text-gray-300">{activity.weatherCondition}</span>}
            {activity.weatherHumidityPct != null && <span className="text-gray-500 dark:text-gray-400">💧 {activity.weatherHumidityPct}%</span>}
            {activity.weatherWindSpeedKmh != null && <span className="text-gray-500 dark:text-gray-400">💨 {activity.weatherWindSpeedKmh.toFixed(1)} km/h</span>}
          </>
        ) : (
          <>
            <span className="text-gray-400 dark:text-gray-500 italic">
              {fetchWeather.isError ? 'Could not fetch weather — activity may lack GPS data.' : 'No weather data available.'}
            </span>
            <button
              onClick={() => fetchWeather.mutate()}
              disabled={fetchWeather.isPending}
              className="ml-auto px-2.5 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {fetchWeather.isPending ? 'Fetching…' : 'Fetch'}
            </button>
          </>
        )}
      </div>

      {/* Map */}
      {routeGeoJson && bounds && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Route</span>
            <div className="flex gap-2">
              <button
                onClick={() => exportGpx(activity)}
                className="px-3 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                ↓ GPX
              </button>
              <button
                onClick={() => exportTcx(activity)}
                className="px-3 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                ↓ TCX
              </button>
            </div>
          </div>
          <Map
            initialViewState={{
              bounds,
              fitBoundsOptions: { padding: 50 },
            }}
            style={{ width: '100%', height: 400 }}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
          >
            <Source id="route" type="geojson" data={routeGeoJson}>
              <Layer
                id="route-line"
                type="line"
                paint={{
                  'line-color': '#2563eb',
                  'line-width': 3,
                }}
              />
            </Source>
          </Map>
        </div>
      )}

      {/* Splits + HR Zones — side by side on large screens */}
      <div className={`${hasSplits && hrZoneBreakdown ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''} mb-8`}>

      {/* Splits table */}
      {hasSplits && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Splits per km
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    km
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pace
                  </th>
                  {hasHrInSplits && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg HR
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {splits.map((split) => {
                  const isFastest = split.km === fastestKm;
                  const isSlowest = split.km === slowestKm;
                  const rowClass = isFastest
                    ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : isSlowest
                      ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700';
                  return (
                    <tr key={split.km} className={rowClass}>
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                        {split.km}
                        {isFastest && (
                          <span className="ml-2 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
                            fastest
                          </span>
                        )}
                        {isSlowest && (
                          <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                            slowest
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300">
                        {formatPace(split.pace)} /km
                      </td>
                      {hasHrInSplits && (
                        <td className="px-6 py-3 text-right text-gray-700 dark:text-gray-300">
                          {split.avgHr != null ? `${split.avgHr} bpm` : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HR zone breakdown */}
      {hrZoneBreakdown && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Time in Heart Rate Zones</h2>
          <div className="space-y-4">
            {[...hrZoneBreakdown].reverse().map((z) => {
              const ZONE_COLORS = [
                '#60a5fa', // Z1 blue
                '#4ade80', // Z2 green
                '#facc15', // Z3 yellow
                '#f97316', // Z4 orange
                '#ef4444', // Z5 red
              ];
              const color = ZONE_COLORS[z.zone - 1] ?? '#9ca3af';
              const mm = Math.floor(z.secs / 60);
              const ss = String(z.secs % 60).padStart(2, '0');
              const timeStr = z.secs > 0 ? `${mm}:${ss}` : '--:--';
              const rangeStr = z.zone === 5
                ? `> ${z.lower} bpm`
                : `${z.lower} – ${z.upper} bpm`;
              return (
                <div key={z.zone}>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-base font-bold text-gray-900 dark:text-white">Zone {z.zone}</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">{rangeStr} · {z.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${z.pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right tabular-nums">{timeStr}</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500 w-8 text-right tabular-nums">{z.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>{/* end splits+zones grid */}

      {/* Heart rate / altitude chart — full width below splits and zones */}
      {hrChartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Heart Rate & Altitude
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hrChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="distance"
                label={{
                  value: 'km',
                  position: 'insideBottomRight',
                  offset: -5,
                }}
              />
              <YAxis
                yAxisId="hr"
                label={{ value: 'bpm', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="alt"
                orientation="right"
                label={{ value: 'm', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="hr"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                name="Heart Rate"
              />
              <Line
                yAxisId="alt"
                type="monotone"
                dataKey="altitude"
                stroke="#6b7280"
                strokeWidth={1}
                dot={false}
                name="Altitude"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interval Analysis */}
      {intervalData?.hasIntervals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Interval Analysis</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{intervalData.structure}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                {intervalData.consistencyPct.toFixed(0)}% consistent
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 pr-4">Rep</th>
                  <th className="text-right py-2 pr-4">Distance</th>
                  <th className="text-right py-2 pr-4">Time</th>
                  <th className="text-right py-2 pr-4">Pace</th>
                  <th className="text-right py-2 pr-4">Avg HR</th>
                  <th className="text-right py-2">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {intervalData.reps.map((rep) => {
                  const mins = Math.floor(rep.durationSec / 60);
                  const secs = String(Math.round(rep.durationSec % 60)).padStart(2, '0');
                  const recMins = Math.floor(rep.recoveryDurationSec / 60);
                  const recSecs = String(Math.round(rep.recoveryDurationSec % 60)).padStart(2, '0');
                  const isFastest = rep.paceMinPerKm === Math.min(...intervalData.reps.map(r => r.paceMinPerKm));
                  return (
                    <tr key={rep.repNumber} className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isFastest ? 'font-medium' : ''}`}>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{rep.repNumber}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-900 dark:text-white">{Math.round(rep.distanceM)}m</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-900 dark:text-white">{mins}:{secs}</td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${isFastest ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {formatPace(rep.paceMinPerKm)} /km
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-500 dark:text-gray-400">
                        {rep.avgHr != null ? `${Math.round(rep.avgHr)} bpm` : '—'}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">
                        {rep.recoveryDurationSec > 0 ? `${recMins}:${recSecs}` : '—'}
                        {rep.recoveryPaceMinPerKm != null ? ` · ${formatPace(rep.recoveryPaceMinPerKm)}/km` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {intervalData.previousSessions.length > 0 && (() => {
            // Build sparkline data: sessions oldest→newest plus current
            const sessionsOldToNew = [...intervalData.previousSessions].reverse();
            const sparkData = [
              ...sessionsOldToNew.map(s => ({ date: s.date, pace: s.avgRepPace })),
              { date: 'Now', pace: intervalData.avgRepPaceMinPerKm },
            ];
            const first = sparkData[0]?.pace;
            const last = sparkData[sparkData.length - 1]?.pace;
            // Pace: lower is faster; improving = pace decreasing
            const trend = first && last
              ? last < first * 0.98 ? 'improving' : last > first * 1.02 ? 'declining' : 'stable'
              : 'stable';
            const trendConfig = {
              improving: { label: '↑ Improving', color: 'text-green-600 dark:text-green-400' },
              declining: { label: '↓ Declining', color: 'text-red-500 dark:text-red-400' },
              stable:    { label: '→ Stable',    color: 'text-gray-500 dark:text-gray-400' },
            }[trend];

            return (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Recent similar sessions ({intervalData.previousSessions.length})
                  </p>
                  <span className={`text-xs font-semibold ${trendConfig.color}`}>{trendConfig.label}</span>
                </div>
                {/* Sparkline */}
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparkData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                    <Line type="monotone" dataKey="pace" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                    <YAxis domain={['auto', 'auto']} hide reversed />
                    <Tooltip
                      formatter={(v: number) => [`${formatPace(v)} /km`, 'Avg Pace']}
                      labelFormatter={l => l}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-2">
                  {intervalData.previousSessions.map(s => (
                    <div key={s.activityId} className="flex items-center justify-between gap-2">
                      <Link to={`/activities/${s.activityId}`}
                        className="text-xs text-primary-600 hover:underline truncate flex-1 min-w-0">
                        {s.date} · {s.activityName}
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
                          {formatPace(s.avgRepPace)}/km
                        </span>
                        {s.consistencyPct > 0 && (
                          <span className="text-xs text-gray-400 tabular-nums">{s.consistencyPct}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Pace chart */}
      {paceChartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pace
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={paceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="distance"
                label={{ value: 'km', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis
                reversed
                tickFormatter={(v: number) => formatPace(v)}
                domain={['auto', 'auto']}
                width={50}
                label={{ value: 'min/km', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(v: number) => [`${formatPace(v)} /km`, 'Pace']}
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#2563eb"
                strokeWidth={1.5}
                dot={false}
                name="Pace"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
