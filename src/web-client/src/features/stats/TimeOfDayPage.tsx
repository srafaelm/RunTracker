import { useState } from 'react';
import { useTimeOfDayStats } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDistance, formatPace } from '../../utils/formatters';
import { SportType } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const SPORT_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Run', value: SportType.Run },
  { label: 'Trail Run', value: SportType.TrailRun },
  { label: 'Walk', value: SportType.Walk },
  { label: 'Hike', value: SportType.Hike },
  { label: 'Ride', value: SportType.Ride },
];

const DAY_COLORS = [
  '#cffc00', '#81ecff', '#ff734a', '#a3e635', '#fbbf24', '#f472b6', '#c084fc',
];

function hourColor(hour: number): string {
  if (hour >= 5 && hour < 9) return '#fbbf24';   // morning
  if (hour >= 9 && hour < 12) return '#cffc00';  // late morning
  if (hour >= 12 && hour < 17) return '#81ecff'; // afternoon
  if (hour >= 17 && hour < 21) return '#ff734a'; // evening
  return '#a855f7';                              // night
}

export default function TimeOfDayPage() {
  const [sportType, setSportType] = useState<SportType | undefined>(undefined);
  const { data, isLoading } = useTimeOfDayStats(sportType);

  const hourData = (data?.byHour ?? []).map((h) => ({
    name: h.label,
    count: h.count,
    avgPace: h.avgPaceMinPerKm > 0 ? +h.avgPaceMinPerKm.toFixed(2) : 0,
    avgDist: +(h.avgDistanceM / 1000).toFixed(2),
    hour: h.hour,
  }));

  const dowData = (data?.byDayOfWeek ?? []).map((d) => ({
    name: d.dayName,
    count: d.count,
    avgPace: d.avgPaceMinPerKm > 0 ? +d.avgPaceMinPerKm.toFixed(2) : 0,
    avgDist: +(d.avgDistanceM / 1000).toFixed(2),
    dayOfWeek: d.dayOfWeek,
  }));

  const bestHour = hourData.reduce<typeof hourData[0] | null>(
    (best, h) => (!best || h.count > best.count ? h : best), null
  );
  const bestDay = dowData.reduce<typeof dowData[0] | null>(
    (best, d) => (!best || d.count > best.count ? d : best), null
  );

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase">Time of Day</h1>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575] mt-2">When do you train most often?</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SPORT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setSportType(opt.value)}
              className={`px-4 py-2 font-label text-xs uppercase tracking-widest border transition-colors ${
                sportType === opt.value
                  ? 'bg-[#cffc00] text-[#3b4a00] border-[#cffc00]'
                  : 'bg-[#20201f] border-[#484847] text-[#adaaaa] hover:border-[#cffc00] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" />
      ) : (
        <>
          {/* Summary cards */}
          {(bestHour || bestDay) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {bestHour && bestHour.count > 0 && (
                <div className="bg-[#20201f] border-l-2 border-[#cffc00] p-6">
                  <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Favourite Time</p>
                  <p className="font-headline text-4xl font-bold text-white">{bestHour.name}</p>
                  <p className="font-label text-xs text-[#767575] mt-1">{bestHour.count} activities &middot; avg {formatDistance(bestHour.avgDist * 1000)}</p>
                </div>
              )}
              {bestDay && bestDay.count > 0 && (
                <div className="bg-[#20201f] border-l-2 border-[#81ecff] p-6">
                  <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Favourite Day</p>
                  <p className="font-headline text-4xl font-bold text-white">{bestDay.name}</p>
                  <p className="font-label text-xs text-[#767575] mt-1">{bestDay.count} activities &middot; avg {formatDistance(bestDay.avgDist * 1000)}</p>
                </div>
              )}
            </div>
          )}

          {/* Hour-of-day chart */}
          <div className="bg-[#20201f] p-6 mb-4">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-1">Activities by Hour of Day</h2>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mb-4">Based on activity start time</p>
            {hourData.every((h) => h.count === 0) ? (
              <p className="font-label text-xs text-[#767575] text-center py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#adaaaa' }} interval={1} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }}
                    labelStyle={{ color: '#adaaaa' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(val: number, name: string) => {
                      if (name === 'count') return [val, 'Activities'];
                      if (name === 'avgPace') return [`${formatPace(val)} /km`, 'Avg Pace'];
                      return [formatDistance(val * 1000), 'Avg Distance'];
                    }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {hourData.map((h) => (
                      <Cell key={h.hour} fill={hourColor(h.hour)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]"><span className="w-3 h-1.5 inline-block" style={{background:'#fbbf24'}} /> Morning</span>
              <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]"><span className="w-3 h-1.5 inline-block" style={{background:'#cffc00'}} /> Late Morning</span>
              <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]"><span className="w-3 h-1.5 inline-block" style={{background:'#81ecff'}} /> Afternoon</span>
              <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]"><span className="w-3 h-1.5 inline-block" style={{background:'#ff734a'}} /> Evening</span>
              <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]"><span className="w-3 h-1.5 inline-block" style={{background:'#a855f7'}} /> Night</span>
            </div>
          </div>

          {/* Day-of-week chart */}
          <div className="bg-[#20201f] p-6 mb-4">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Activities by Day of Week</h2>
            {dowData.every((d) => d.count === 0) ? (
              <p className="font-label text-xs text-[#767575] text-center py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#adaaaa' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }}
                    labelStyle={{ color: '#adaaaa' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(val: number, name: string) => {
                      if (name === 'count') return [val, 'Activities'];
                      if (name === 'avgPace') return [`${formatPace(val)} /km`, 'Avg Pace'];
                      return [formatDistance(val * 1000), 'Avg Distance'];
                    }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {dowData.map((d) => (
                      <Cell key={d.dayOfWeek} fill={DAY_COLORS[d.dayOfWeek % DAY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Average pace & distance table */}
          {dowData.some((d) => d.count > 0) && (
            <div className="bg-[#20201f] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#484847]/20">
                <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Performance by Day</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Day</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Activities</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Avg Distance</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Avg Pace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#484847]/10">
                  {dowData.map((d) => (
                    <tr key={d.dayOfWeek} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3 font-headline text-sm font-bold text-white uppercase tracking-tight">{d.name}</td>
                      <td className="px-6 py-3 text-right font-label text-sm text-[#adaaaa]">{d.count}</td>
                      <td className="px-6 py-3 text-right font-label text-sm text-[#adaaaa]">
                        {d.count > 0 ? formatDistance(d.avgDist * 1000) : '—'}
                      </td>
                      <td className="px-6 py-3 text-right font-label text-sm text-[#adaaaa]">
                        {d.count > 0 && d.avgPace > 0 ? `${formatPace(d.avgPace)} /km` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
