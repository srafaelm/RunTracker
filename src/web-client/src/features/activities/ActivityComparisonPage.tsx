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
      <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mb-2">{label}</p>
      {activity ? (
        <div className="bg-[#20201f] border-l-2 border-[#cffc00] p-4 flex items-start justify-between gap-2">
          <div>
            <p className="font-headline text-sm font-bold text-white uppercase tracking-tight">{activity.name}</p>
            <p className="font-label text-xs text-[#adaaaa] mt-1">{formatDate(activity.startDate)} · {formatDistance(activity.distance)}</p>
          </div>
          <button onClick={() => onSelect('')} className="font-label text-xs text-[#767575] hover:text-[#ff734a] shrink-0">✕</button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="Search activities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-[#131313] border border-[#484847] text-white font-label text-xs placeholder-[#767575] focus:border-[#cffc00] focus:outline-none transition-colors"
          />
          {list && list.items.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#484847] shadow-2xl z-10 max-h-56 overflow-y-auto">
              {list.items.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onSelect(a.id); setSearch(''); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#262626] border-b border-[#484847]/20 last:border-0 transition-colors"
                >
                  <div className="font-headline text-sm font-bold text-white uppercase tracking-tight">{a.name}</div>
                  <div className="font-label text-xs text-[#adaaaa] mt-0.5">
                    {formatDate(a.startDate)} · {formatDistance(a.distance)} · {formatPace(a.averagePaceMinPerKm)} /km
                    {a.sportType !== undefined && <span className="ml-1 text-[#767575]">· {sportTypeName(a.sportType)}</span>}
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
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase mb-1">Activity Comparison</h1>
      <p className="font-label text-xs uppercase tracking-widest text-[#767575] mb-8">Select two activities to compare side by side</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterSport ?? ''}
          onChange={e => setFilterSport(e.target.value === '' ? undefined : Number(e.target.value) as SportType)}
          className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
        >
          {SPORT_TYPE_OPTIONS.map(o => (
            <option key={o.label} value={o.value ?? ''}>{o.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
          title="From date"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
          title="To date"
        />
        {(filterSport !== undefined || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterSport(undefined); setFilterFrom(''); setFilterTo(''); }}
            className="font-label text-xs uppercase tracking-widest text-[#767575] hover:text-[#ff734a] px-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Activity pickers */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {renderPicker('Activity A', searchA, setSearchA, listA, idA, setIdA, actA)}
        <div className="flex items-center justify-center font-headline text-xl font-bold text-[#484847]">vs</div>
        {renderPicker('Activity B', searchB, setSearchB, listB, idB, setIdB, actB)}
      </div>

      {isLoading && <LoadingSpinner size="lg" />}

      {actA && actB && !isLoading && (
        <>
          {similarRoute && (
            <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-[#20201f] border-l-2 border-[#81ecff]">
              <span className="font-label text-xs uppercase tracking-widest text-[#81ecff]">Similar route detected</span>
            </div>
          )}

          {/* Stats diff table */}
          <div className="bg-[#20201f] overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-[#484847]/20 flex items-center gap-4">
              <p className="flex-1 font-headline text-sm font-bold text-[#cffc00] uppercase tracking-tight">A: {actA.name}</p>
              <p className="w-20 text-center font-label text-[10px] uppercase tracking-widest text-[#767575]">Diff</p>
              <p className="flex-1 font-headline text-sm font-bold text-[#ff734a] uppercase tracking-tight text-right">B: {actB.name}</p>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-[#484847]/10">
                {metrics.map(m => (
                  <tr key={m.label} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-3 font-label text-[10px] uppercase tracking-widest text-[#767575] w-24">{m.label}</td>
                    <td className={`px-3 py-3 font-headline text-sm font-bold ${m.better === 'a' ? 'text-[#cffc00]' : 'text-white'}`}>{m.a}</td>
                    <td className="px-3 py-3 text-center font-label text-xs text-[#484847]">{m.delta ?? ''}</td>
                    <td className={`px-5 py-3 font-headline text-sm font-bold text-right ${m.better === 'b' ? 'text-[#cffc00]' : 'text-white'}`}>{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          {chartData.length > 0 && (
            <>
              {chartData.some(d => d.altA != null || d.altB != null) && (
                <div className="bg-[#20201f] p-6 mb-4">
                  <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Elevation Profile</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                      <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#adaaaa' }} tickFormatter={v => `${v}km`} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} unit="m" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#fff' }} formatter={(v: number, n: string) => [v != null ? `${v.toFixed(0)}m` : '—', n === 'altA' ? 'Activity A' : 'Activity B']} labelFormatter={l => `${l}km`} />
                      <Legend formatter={v => v === 'altA' ? 'Activity A' : 'Activity B'} wrapperStyle={{ fontSize: 10, color: '#adaaaa' }} />
                      <Line type="monotone" dataKey="altA" stroke="#cffc00" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="altB" stroke="#ff734a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartData.some(d => d.hrA != null || d.hrB != null) && (
                <div className="bg-[#20201f] p-6">
                  <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Heart Rate</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                      <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#adaaaa' }} tickFormatter={v => `${v}km`} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} unit=" bpm" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#fff' }} formatter={(v: number, n: string) => [v != null ? `${v} bpm` : '—', n === 'hrA' ? 'Activity A' : 'Activity B']} labelFormatter={l => `${l}km`} />
                      <Legend formatter={v => v === 'hrA' ? 'Activity A' : 'Activity B'} wrapperStyle={{ fontSize: 10, color: '#adaaaa' }} />
                      <Line type="monotone" dataKey="hrA" stroke="#cffc00" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="hrB" stroke="#ff734a" strokeWidth={2} dot={false} />
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
