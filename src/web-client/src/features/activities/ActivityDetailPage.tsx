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
      <div className="p-8 text-center text-[#767575]">Activity not found</div>
    );

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">

      {/* PRs banner */}
      {activityPrs.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {activityPrs.map((pr) => (
            <div
              key={pr.recordType}
              className="flex items-center gap-2 px-4 py-2 bg-[#20201f] border-l-2 border-[#cffc00] font-label text-xs uppercase tracking-widest text-[#cffc00]"
            >
              <span>🏆</span>
              <span>PR — {recordTypeName(pr.recordType)}: {pr.displayValue}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hero header ── */}
      <section className="grid grid-cols-12 gap-8 mb-10">
        <div className="col-span-12 md:col-span-8">
          <div className="flex items-baseline gap-4 mb-2 flex-wrap">
            <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase text-white leading-none">{activity.name}</h1>
            <span className="font-label text-[#ff734a] uppercase tracking-widest text-xs font-bold">{sportTypeName(activity.sportType)}</span>
          </div>
          <div className="flex flex-wrap gap-5 font-label text-[#adaaaa] text-sm mt-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
              {formatDateTime(activity.startDate)}
            </div>
            {activity.locationCity && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
                {activity.locationCity}
              </div>
            )}
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 flex justify-start md:justify-end items-end gap-2 flex-wrap">
          <button
            onClick={() => exportGpx(activity)}
            className="bg-[#20201f] px-4 py-2 text-xs font-label uppercase tracking-widest hover:bg-[#262626] transition-colors"
          >
            ↓ GPX
          </button>
          <button
            onClick={() => exportTcx(activity)}
            className="bg-[#20201f] px-4 py-2 text-xs font-label uppercase tracking-widest hover:bg-[#262626] transition-colors"
          >
            ↓ TCX
          </button>
          <Link
            to={`/activities/compare?with=${activity.id}`}
            className="bg-[#20201f] px-4 py-2 text-xs font-label uppercase tracking-widest hover:bg-[#262626] transition-colors"
          >
            ⇄ Compare
          </Link>
        </div>
      </section>

      {/* ── Tags + Gear ── */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {activityTags.map((tag: Tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 font-label text-xs uppercase tracking-widest font-medium"
            style={{ backgroundColor: (tag.color ?? '#6b7280') + '30', color: tag.color ?? '#adaaaa', borderLeft: `2px solid ${tag.color ?? '#6b7280'}` }}
          >
            {tag.name}
            <button onClick={() => removeTag.mutate(tag.id)} className="ml-0.5 hover:opacity-70" aria-label={`Remove tag ${tag.name}`}>×</button>
          </span>
        ))}
        <button
          onClick={() => setShowTagPicker((p) => !p)}
          className="px-3 py-1 font-label text-xs uppercase tracking-widest border border-dashed border-[#484847] text-[#767575] hover:border-[#cffc00] hover:text-[#cffc00] transition-colors"
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

        {/* Gear */}
        {(() => {
          const assignedGear = allGear.find((g) => g.id === activity.gearId);
          if (assignedGear) {
            return (
              <span className="inline-flex items-center gap-1 px-3 py-1 font-label text-xs uppercase tracking-widest border-l-2 border-[#484847] bg-[#20201f] text-[#adaaaa]">
                👟 {assignedGear.name}
                <button onClick={() => assignGear.mutate({ activityId: id!, gearId: null })} className="ml-0.5 hover:opacity-70">×</button>
              </span>
            );
          }
          return (
            <div className="relative">
              <button
                onClick={() => { setShowGearPicker((p) => !p); setNewGearName(''); }}
                className="px-3 py-1 font-label text-xs uppercase tracking-widest border border-dashed border-[#484847] text-[#767575] hover:border-[#cffc00] hover:text-[#cffc00] transition-colors"
              >
                + Gear
              </button>
              {showGearPicker && (
                <div className="absolute z-20 top-8 left-0 bg-[#1a1a1a] border border-[#484847] shadow-2xl py-1 min-w-[200px]">
                  {allGear.length > 0 && (
                    <>
                      {allGear.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => { assignGear.mutate({ activityId: id!, gearId: g.id }); setShowGearPicker(false); }}
                          className="w-full text-left px-3 py-2 text-sm font-label text-[#adaaaa] hover:bg-[#262626] hover:text-white transition-colors"
                        >
                          👟 {g.name}{g.brand ? ` · ${g.brand}` : ''}
                        </button>
                      ))}
                      <div className="border-t border-[#484847]/40 my-1" />
                    </>
                  )}
                  <div className="px-3 py-2">
                    <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Create new gear</p>
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
                            { onSuccess: (gear) => { assignGear.mutate({ activityId: id!, gearId: gear.id }); setShowGearPicker(false); setNewGearName(''); } }
                          );
                        }
                        if (e.key === 'Escape') setShowGearPicker(false);
                      }}
                      className="w-full text-sm px-2 py-1 bg-[#0e0e0e] border border-[#484847] text-white font-body focus:outline-none focus:border-[#cffc00] mb-1.5"
                    />
                    <button
                      disabled={!newGearName.trim() || createGear.isPending}
                      onClick={() => {
                        if (!newGearName.trim()) return;
                        createGear.mutate(
                          { name: newGearName.trim(), type: GearType.Shoes, startingDistanceM: 0 },
                          { onSuccess: (gear) => { assignGear.mutate({ activityId: id!, gearId: gear.id }); setShowGearPicker(false); setNewGearName(''); } }
                        );
                      }}
                      className="w-full text-xs px-2 py-1 bg-[#cffc00] text-[#3b4a00] font-label font-bold uppercase tracking-widest hover:bg-[#c2ed00] disabled:opacity-40"
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

      {/* ── Bento stat cards ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard title="Distance" value={formatDistance(activity.distance)} accent="primary" />
        <StatCard title="Duration" value={formatDuration(activity.movingTime)} accent="tertiary" />
        <StatCard title="Pace" value={`${formatPace(activity.averagePaceMinPerKm)} /km`} accent="outline" />
        {minHeartRate != null && <StatCard title="Min HR" value={`${minHeartRate} bpm`} accent="outline" />}
        {activity.averageHeartRate && <StatCard title="Avg HR" value={`${Math.round(activity.averageHeartRate)} bpm`} accent="secondary" />}
        {activity.maxHeartRate && <StatCard title="Max HR" value={`${activity.maxHeartRate} bpm`} accent="secondary" />}
        <StatCard title="Elevation" value={`${Math.round(activity.totalElevationGain)} m`} accent="tertiary" />
        {activity.averageCadence != null && <StatCard title="Cadence" value={`${Math.round(activity.averageCadence * 2)} spm`} accent="outline" />}
        {activity.calories && <StatCard title="Calories" value={`${activity.calories} kcal`} accent="primary" />}
        {/* Weather */}
        {activity.weatherTempC != null ? (
          <div className="bg-[#20201f] border-l-2 border-[#81ecff] p-6 relative overflow-hidden">
            <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-4">Weather</p>
            <p className="font-headline text-2xl font-bold text-[#81ecff]">{activity.weatherTempC.toFixed(1)} °C</p>
            <p className="font-label text-xs text-[#767575] mt-2">
              {[activity.weatherCondition, activity.weatherHumidityPct != null ? `💧 ${activity.weatherHumidityPct}%` : null, activity.weatherWindSpeedKmh != null ? `💨 ${activity.weatherWindSpeedKmh.toFixed(1)} km/h` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : (
          <div className="bg-[#20201f] border-l-2 border-[#484847] p-6 flex flex-col justify-between">
            <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-4">Weather</p>
            <p className="font-label text-xs text-[#767575] italic">{fetchWeather.isError ? 'No GPS data' : 'No data'}</p>
            <button
              onClick={() => fetchWeather.mutate()}
              disabled={fetchWeather.isPending}
              className="mt-3 px-3 py-1.5 text-xs font-label font-bold uppercase tracking-widest bg-[#cffc00] text-[#3b4a00] hover:bg-[#c2ed00] disabled:opacity-50 transition-colors self-start"
            >
              {fetchWeather.isPending ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        )}
        {activity.newStreetsDiscovered > 0 && <StatCard title="New Streets" value={`${activity.newStreetsDiscovered}`} accent="tertiary" />}
      </section>

      {/* ── Map ── */}
      {routeGeoJson && bounds && (
        <section className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#131313] overflow-hidden relative" style={{ height: 460 }}>
              <Map
                initialViewState={{ bounds, fitBoundsOptions: { padding: 50 } }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              >
                <Source id="route" type="geojson" data={routeGeoJson}>
                  <Layer
                    id="route-line"
                    type="line"
                    paint={{ 'line-color': '#cffc00', 'line-width': 5, 'line-opacity': 1 }}
                  />
                </Source>
              </Map>
            </div>
          </div>

          {/* HR zone panel beside map */}
          {hrZoneBreakdown && (
            <div className="col-span-12 lg:col-span-4">
              <div className="bg-[#20201f] p-6 h-full flex flex-col">
                <h3 className="font-headline text-lg font-bold tracking-tight uppercase border-b border-[#484847]/20 pb-2 mb-6">Heart Rate Intensity</h3>
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  {[...hrZoneBreakdown].reverse().map((z) => {
                    const ZONE_COLORS = ['#81ecff','#cffc00','#facc15','#ff734a','#ff7351'];
                    const color = ZONE_COLORS[z.zone - 1] ?? '#9ca3af';
                    const mm = Math.floor(z.secs / 60);
                    const ss = String(z.secs % 60).padStart(2, '0');
                    const timeStr = z.secs > 0 ? `${mm}:${ss}` : '--:--';
                    return (
                      <div key={z.zone} className="space-y-1">
                        <div className="flex justify-between font-label text-[10px] uppercase tracking-tighter">
                          <span style={{ color }}>Zone {z.zone} {z.label}</span>
                          <span className="text-[#adaaaa]">{z.pct}% · {timeStr}</span>
                        </div>
                        <div className="h-2 bg-[#262626]">
                          <div className="h-full transition-all" style={{ width: `${z.pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* HR + altitude chart */}
      {hrChartData.length > 0 && (
        <section className="bg-[#20201f] p-8 mb-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-headline text-xl font-bold tracking-tight uppercase">Heart Rate &amp; Altitude Telemetry</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3" style={{ backgroundColor: '#ff734a' }} />
                <span className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Heart Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#767575]" />
                <span className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Altitude</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hrChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#484847" strokeOpacity={0.4} />
              <XAxis dataKey="distance" stroke="#767575" tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Lexend' }} label={{ value: 'km', position: 'insideBottomRight', offset: -5, fill: '#767575' }} />
              <YAxis yAxisId="hr" stroke="#767575" tick={{ fill: '#767575', fontSize: 10 }} label={{ value: 'bpm', angle: -90, position: 'insideLeft', fill: '#767575' }} />
              <YAxis yAxisId="alt" orientation="right" stroke="#767575" tick={{ fill: '#767575', fontSize: 10 }} label={{ value: 'm', angle: 90, position: 'insideRight', fill: '#767575' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 2, fontFamily: 'Lexend', fontSize: 12 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#ffffff' }} />
              <Line yAxisId="hr" type="monotone" dataKey="hr" stroke="#ff734a" strokeWidth={1.5} dot={false} name="Heart Rate" />
              <Line yAxisId="alt" type="monotone" dataKey="altitude" stroke="#767575" strokeWidth={1} dot={false} name="Altitude" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Pace chart */}
      {paceChartData.length > 0 && (
        <section className="bg-[#20201f] p-8 mb-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-headline text-xl font-bold tracking-tight uppercase">Pace Telemetry</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: '#cffc00' }} />
              <span className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Pace</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={paceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#484847" strokeOpacity={0.4} />
              <XAxis dataKey="distance" stroke="#767575" tick={{ fill: '#767575', fontSize: 10, fontFamily: 'Lexend' }} label={{ value: 'km', position: 'insideBottomRight', offset: -5, fill: '#767575' }} />
              <YAxis reversed tickFormatter={(v: number) => formatPace(v)} domain={['auto', 'auto']} width={50} stroke="#767575" tick={{ fill: '#767575', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 2, fontFamily: 'Lexend', fontSize: 12 }} formatter={(v: number) => [`${formatPace(v)} /km`, 'Pace']} itemStyle={{ color: '#cffc00' }} />
              <Line type="monotone" dataKey="pace" stroke="#cffc00" strokeWidth={2} dot={false} name="Pace" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Splits & HR zones side-by-side ── */}
      <div className={`${hasSplits && !hrZoneBreakdown ? '' : hasSplits ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''} mb-8`}>

        {/* Splits table */}
        {hasSplits && (
          <div className="bg-[#20201f] overflow-hidden">
            <div className="px-8 py-5 border-b border-[#484847]/10">
              <h3 className="font-headline text-xl font-bold tracking-tight uppercase">Lap Telemetry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-label text-sm">
                <thead className="bg-[#262626]/50">
                  <tr>
                    <th className="px-8 py-4 uppercase tracking-widest text-[10px] text-[#adaaaa]">km</th>
                    <th className="px-8 py-4 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Pace</th>
                    {hasHrInSplits && <th className="px-8 py-4 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Avg HR</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#484847]/10">
                  {splits.map((split) => {
                    const isFastest = split.km === fastestKm;
                    const isSlowest = split.km === slowestKm;
                    return (
                      <tr key={split.km} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-8 py-4">
                          <span className={`font-headline font-bold ${isFastest ? 'text-[#cffc00]' : isSlowest ? 'text-[#ff734a]' : 'text-white'}`}>
                            {String(split.km).padStart(2, '0')}
                          </span>
                          {isFastest && <span className="ml-2 font-label text-[10px] uppercase tracking-widest text-[#cffc00] bg-[#cffc00]/10 px-1.5 py-0.5">fastest</span>}
                          {isSlowest && <span className="ml-2 font-label text-[10px] uppercase tracking-widest text-[#ff734a] bg-[#ff734a]/10 px-1.5 py-0.5">slowest</span>}
                        </td>
                        <td className={`px-8 py-4 text-right ${isFastest ? 'text-[#cffc00] font-bold' : 'text-[#adaaaa]'}`}>
                          {formatPace(split.pace)} /km
                        </td>
                        {hasHrInSplits && (
                          <td className="px-8 py-4 text-right text-[#adaaaa]">
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

        {/* HR zones (shown beside splits only if map is not shown, otherwise shown next to map above) */}
        {hrZoneBreakdown && !routeGeoJson && (
          <div className="bg-[#20201f] p-6">
            <h3 className="font-headline text-lg font-bold tracking-tight uppercase border-b border-[#484847]/20 pb-2 mb-6">Heart Rate Intensity</h3>
            <div className="space-y-4">
              {[...hrZoneBreakdown].reverse().map((z) => {
                const ZONE_COLORS = ['#81ecff','#cffc00','#facc15','#ff734a','#ff7351'];
                const color = ZONE_COLORS[z.zone - 1] ?? '#9ca3af';
                const mm = Math.floor(z.secs / 60);
                const ss = String(z.secs % 60).padStart(2, '0');
                const timeStr = z.secs > 0 ? `${mm}:${ss}` : '--:--';
                return (
                  <div key={z.zone} className="space-y-1">
                    <div className="flex justify-between font-label text-[10px] uppercase tracking-tighter">
                      <span style={{ color }}>Zone {z.zone} {z.label}</span>
                      <span className="text-[#adaaaa]">{z.pct}% · {timeStr}</span>
                    </div>
                    <div className="h-2 bg-[#262626]">
                      <div className="h-full transition-all" style={{ width: `${z.pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Interval Analysis */}
      {intervalData?.hasIntervals && (
        <div className="bg-[#20201f] p-8 mt-8">
          <div className="flex items-center justify-between border-b border-[#484847]/10 pb-4 mb-6">
            <h3 className="font-headline text-xl font-bold tracking-tight uppercase">Interval Analysis</h3>
            <div className="flex items-center gap-3">
              <span className="font-label text-xs uppercase tracking-widest text-[#adaaaa]">{intervalData.structure}</span>
              <span className="font-label text-[10px] px-2 py-0.5 uppercase tracking-widest text-[#cffc00] bg-[#cffc00]/10">
                {intervalData.consistencyPct.toFixed(0)}% consistent
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-label text-sm">
              <thead className="bg-[#262626]/50">
                <tr>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa]">Rep</th>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Distance</th>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Time</th>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Pace</th>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Avg HR</th>
                  <th className="px-6 py-3 uppercase tracking-widest text-[10px] text-[#adaaaa] text-right">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#484847]/10">
                {intervalData.reps.map((rep) => {
                  const mins = Math.floor(rep.durationSec / 60);
                  const secs = String(Math.round(rep.durationSec % 60)).padStart(2, '0');
                  const recMins = Math.floor(rep.recoveryDurationSec / 60);
                  const recSecs = String(Math.round(rep.recoveryDurationSec % 60)).padStart(2, '0');
                  const isFastest = rep.paceMinPerKm === Math.min(...intervalData.reps.map(r => r.paceMinPerKm));
                  return (
                    <tr key={rep.repNumber} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3 font-headline font-bold">{String(rep.repNumber).padStart(2, '0')}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-white">{Math.round(rep.distanceM)}m</td>
                      <td className="px-6 py-3 text-right tabular-nums text-white">{mins}:{secs}</td>
                      <td className={`px-6 py-3 text-right tabular-nums ${isFastest ? 'text-[#cffc00] font-bold' : 'text-white'}`}>
                        {formatPace(rep.paceMinPerKm)} /km
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#adaaaa]">
                        {rep.avgHr != null ? `${Math.round(rep.avgHr)} bpm` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-[#767575]">
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
            const sessionsOldToNew = [...intervalData.previousSessions].reverse();
            const sparkData = [
              ...sessionsOldToNew.map(s => ({ date: s.date, pace: s.avgRepPace })),
              { date: 'Now', pace: intervalData.avgRepPaceMinPerKm },
            ];
            const first = sparkData[0]?.pace;
            const last = sparkData[sparkData.length - 1]?.pace;
            const trend = first && last ? last < first * 0.98 ? 'improving' : last > first * 1.02 ? 'declining' : 'stable' : 'stable';
            const trendConfig = {
              improving: { label: '↑ Improving', color: 'text-[#cffc00]' },
              declining: { label: '↓ Declining', color: 'text-[#ff734a]' },
              stable:    { label: '→ Stable',    color: 'text-[#767575]' },
            }[trend];
            return (
              <div className="mt-4 pt-4 border-t border-[#484847]/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">Recent similar sessions ({intervalData.previousSessions.length})</p>
                  <span className={`font-label text-xs uppercase tracking-widest font-bold ${trendConfig.color}`}>{trendConfig.label}</span>
                </div>
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparkData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                    <Line type="monotone" dataKey="pace" stroke="#cffc00" strokeWidth={2} dot={{ r: 3, fill: '#cffc00' }} />
                    <YAxis domain={['auto', 'auto']} hide reversed />
                    <Tooltip formatter={(v: number) => [`${formatPace(v)} /km`, 'Avg Pace']} labelFormatter={l => l} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847' }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-3">
                  {intervalData.previousSessions.map(s => (
                    <div key={s.activityId} className="flex items-center justify-between gap-2">
                      <Link to={`/activities/${s.activityId}`} className="font-label text-xs text-[#cffc00] hover:underline truncate flex-1 min-w-0">
                        {s.date} · {s.activityName}
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-label text-xs tabular-nums text-[#adaaaa]">{formatPace(s.avgRepPace)}/km</span>
                        {s.consistencyPct > 0 && <span className="font-label text-xs text-[#767575] tabular-nums">{s.consistencyPct}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>

  );
}



