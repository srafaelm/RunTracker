import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActivities, useActivity } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  formatDistance, formatDuration, formatPace, formatDate, sportTypeName,
} from '../../utils/formatters';
import { SportType } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import * as polyline from '@mapbox/polyline';

type Metric = { label: string; a: string; b: string; delta?: string; better?: 'a' | 'b' | 'equal' | null };

function diff(a: number, b: number, higherIsBetter: boolean, fmt: (v: number) => string): { delta: string; better: 'a' | 'b' | 'equal' } {
  const d = a - b;
  if (Math.abs(d) < 0.01) return { delta: '—', better: 'equal' };
  return {
    delta: `${d > 0 ? '+' : ''}${fmt(d)}`,
    better: (d > 0) === higherIsBetter ? 'a' : 'b',
  };
}

function haversineDistance(c1: [number, number][], c2: [number, number][]): number {
  if (c1.length === 0 || c2.length === 0) return Infinity;
  // Compare start points
  const [lat1, lon1] = c1[0];
  const [lat2, lon2] = c2[0];
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SPORT_TYPE_OPTIONS: { label: string; value: SportType | undefined }[] = [
  { label: 'All sports', value: undefined },
  { label: 'Run', value: SportType.Run },
  { label: 'Trail Run', value: SportType.TrailRun },
  { label: 'Ride', value: SportType.Ride },
  { label: 'Swim', value: SportType.Swim },
  { label: 'Walk', value: SportType.Walk },
  { label: 'Hike', value: SportType.Hike },
];

export default function ActivityComparisonPage() {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('with');

  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [idA, setIdA] = useState<string | null>(preselectedId);
  const [idB, setIdB] = useState<string | null>(null);

  // Shared filters for both pickers
  const [filterSport, setFilterSport] = useState<SportType | undefined>(undefined);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { data: listA } = useActivities({
    pageSize: 50,
    search: searchA || undefined,
    sportType: filterSport,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  });
  const { data: listB } = useActivities({
    pageSize: 50,
    search: searchB || undefined,
    sportType: filterSport,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  });

  const { data: actA, isLoading: loadA } = useActivity(idA ?? '');
  const { data: actB, isLoading: loadB } = useActivity(idB ?? '');

  const coordsA = useMemo(() => {
    const poly = actA?.detailedPolyline || actA?.summaryPolyline;
    return poly ? polyline.decode(poly) as [number, number][] : [];
  }, [actA]);

  const coordsB = useMemo(() => {
    const poly = actB?.detailedPolyline || actB?.summaryPolyline;
    return poly ? polyline.decode(poly) as [number, number][] : [];
  }, [actB]);

  const similarRoute = useMemo(() => {
    if (coordsA.length === 0 || coordsB.length === 0) return false;
    return haversineDistance(coordsA, coordsB) < 500; // within 500m start
  }, [coordsA, coordsB]);

  // Build aligned chart data by normalised distance index
  const chartData = useMemo(() => {
    if (!actA || !actB) return [];
    const streamsA = actA.streams.filter(s => s.distance != null);
    const streamsB = actB.streams.filter(s => s.distance != null);
    if (streamsA.length === 0 || streamsB.length === 0) return [];
    const N = 200;
    const maxDistA = streamsA[streamsA.length - 1].distance!;
    const maxDistB = streamsB[streamsB.length - 1].distance!;
    const maxDist = Math.max(maxDistA, maxDistB);
    const result = [];
    for (let i = 0; i <= N; i++) {
      const d = (i / N) * maxDist;
      const inRangeA = d <= maxDistA;
      const inRangeB = d <= maxDistB;
      const ptA = inRangeA ? (streamsA.find(s => s.distance! >= d) ?? streamsA[streamsA.length - 1]) : null;
      const ptB = inRangeB ? (streamsB.find(s => s.distance! >= d) ?? streamsB[streamsB.length - 1]) : null;
      result.push({
        dist: +(d / 1000).toFixed(2),
        altA: ptA?.altitude ?? null,
        altB: ptB?.altitude ?? null,
        hrA: ptA?.heartRate ?? null,
        hrB: ptB?.heartRate ?? null,
      });
    }
    return result;
  }, [actA, actB]);

  const metrics: Metric[] = useMemo(() => {
    if (!actA || !actB) return [];
    const distDiff = diff(actA.distance, actB.distance, true, v => formatDistance(Math.abs(v)));
    const paceDiff = diff(actA.averagePaceMinPerKm, actB.averagePaceMinPerKm, false, v => `${formatPace(Math.abs(v))} /km`);
    const elevDiff = diff(actA.totalElevationGain, actB.totalElevationGain, true, v => `${Math.abs(v).toFixed(0)}m`);
    const hrA = actA.averageHeartRate, hrB = actB.averageHeartRate;
    return [
      { label: 'Date', a: formatDate(actA.startDate), b: formatDate(actB.startDate) },
      { label: 'Sport', a: sportTypeName(actA.sportType), b: sportTypeName(actB.sportType) },
      { label: 'Distance', a: formatDistance(actA.distance), b: formatDistance(actB.distance), ...distDiff },
      { label: 'Duration', a: formatDuration(actA.movingTime), b: formatDuration(actB.movingTime) },
      { label: 'Avg Pace', a: `${formatPace(actA.averagePaceMinPerKm)} /km`, b: `${formatPace(actB.averagePaceMinPerKm)} /km`, ...paceDiff },
      { label: 'Elevation', a: `${Math.round(actA.totalElevationGain)}m`, b: `${Math.round(actB.totalElevationGain)}m`, ...elevDiff },
      ...(hrA || hrB ? [{ label: 'Avg HR', a: hrA ? `${Math.round(hrA)} bpm` : '—', b: hrB ? `${Math.round(hrB)} bpm` : '—' }] : []),
    ];
  }, [actA, actB]);

  const renderPicker = (
    label: string, search: string, setSearch: (v: string) => void,
    list: typeof listA, _selectedId: string | null, onSelect: (id: string) => void,
    activity: typeof actA
  ) => (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {activity ? (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg p-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">{activity.name}</p>
            <p className="text-xs text-gray-500">{formatDate(activity.startDate)} · {formatDistance(activity.distance)}</p>
          </div>
          <button onClick={() => onSelect('')} className="text-xs text-gray-400 hover:text-red-500 shrink-0">✕</button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="Search activities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {list && list.items.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
              {list.items.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onSelect(a.id); setSearch(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{a.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDate(a.startDate)} · {formatDistance(a.distance)} · {formatPace(a.averagePaceMinPerKm)} /km
                    {a.sportType !== undefined && <span className="ml-1 text-gray-400">· {sportTypeName(a.sportType)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const isLoading = (idA && loadA) || (idB && loadB);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Activity Comparison</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Select two activities to compare side by side</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterSport ?? ''}
          onChange={e => setFilterSport(e.target.value === '' ? undefined : Number(e.target.value) as SportType)}
          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {SPORT_TYPE_OPTIONS.map(o => (
            <option key={o.label} value={o.value ?? ''}>{o.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          title="From date"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          title="To date"
        />
        {(filterSport !== undefined || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterSport(undefined); setFilterFrom(''); setFilterTo(''); }}
            className="text-xs text-gray-400 hover:text-red-500 px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Activity pickers */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {renderPicker('Activity A', searchA, setSearchA, listA, idA, setIdA, actA)}
        <div className="flex items-center justify-center text-gray-400 font-bold">vs</div>
        {renderPicker('Activity B', searchB, setSearchB, listB, idB, setIdB, actB)}
      </div>

      {isLoading && <LoadingSpinner size="lg" />}

      {actA && actB && !isLoading && (
        <>
          {similarRoute && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-700 dark:text-green-300">
              <span>Similar route detected</span>
            </div>
          )}

          {/* Stats diff table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <p className="flex-1 text-sm font-semibold text-primary-600">A: {actA.name}</p>
              <p className="w-20 text-center text-xs text-gray-400 uppercase">Diff</p>
              <p className="flex-1 text-sm font-semibold text-orange-500 text-right">B: {actB.name}</p>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {metrics.map(m => (
                  <tr key={m.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-5 py-2.5 text-gray-500 dark:text-gray-400 w-24">{m.label}</td>
                    <td className={`px-3 py-2.5 font-medium ${m.better === 'a' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{m.a}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400">{m.delta ?? ''}</td>
                    <td className={`px-5 py-2.5 font-medium text-right ${m.better === 'b' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          {chartData.length > 0 && (
            <>
              {chartData.some(d => d.altA != null || d.altB != null) && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-5">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Elevation Profile</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dist" tick={{ fontSize: 10 }} tickFormatter={v => `${v}km`} />
                      <YAxis tick={{ fontSize: 10 }} unit="m" />
                      <Tooltip formatter={(v: number, n: string) => [v != null ? `${v.toFixed(0)}m` : '—', n === 'altA' ? 'Activity A' : 'Activity B']} labelFormatter={l => `${l}km`} />
                      <Legend formatter={v => v === 'altA' ? 'Activity A' : 'Activity B'} />
                      <Line type="monotone" dataKey="altA" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="altB" stroke="#f97316" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartData.some(d => d.hrA != null || d.hrB != null) && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Heart Rate</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dist" tick={{ fontSize: 10 }} tickFormatter={v => `${v}km`} />
                      <YAxis tick={{ fontSize: 10 }} unit=" bpm" />
                      <Tooltip formatter={(v: number, n: string) => [v != null ? `${v} bpm` : '—', n === 'hrA' ? 'Activity A' : 'Activity B']} labelFormatter={l => `${l}km`} />
                      <Legend formatter={v => v === 'hrA' ? 'Activity A' : 'Activity B'} />
                      <Line type="monotone" dataKey="hrA" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="hrB" stroke="#f97316" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
