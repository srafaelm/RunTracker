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
  '#6366f1', '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#f97316', '#ef4444',
];

function hourColor(hour: number): string {
  if (hour >= 5 && hour < 9) return '#f59e0b';   // morning
  if (hour >= 9 && hour < 12) return '#22c55e';  // late morning
  if (hour >= 12 && hour < 17) return '#3b82f6'; // afternoon
  if (hour >= 17 && hour < 21) return '#f97316'; // evening
  return '#6366f1';                              // night
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
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time of Day Analysis</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">When do you train most often?</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SPORT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setSportType(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                sportType === opt.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Favourite Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{bestHour.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{bestHour.count} activities · avg {formatDistance(bestHour.avgDist * 1000)}</p>
                </div>
              )}
              {bestDay && bestDay.count > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Favourite Day</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{bestDay.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{bestDay.count} activities · avg {formatDistance(bestDay.avgDist * 1000)}</p>
                </div>
              )}
            </div>
          )}

          {/* Hour-of-day chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Activities by Hour of Day</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Based on activity start time</p>
            {hourData.every((h) => h.count === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(val: number, name: string) => {
                      if (name === 'count') return [val, 'Activities'];
                      if (name === 'avgPace') return [`${formatPace(val)} /km`, 'Avg Pace'];
                      return [formatDistance(val * 1000), 'Avg Distance'];
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {hourData.map((h) => (
                      <Cell key={h.hour} fill={hourColor(h.hour)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-amber-400" /> Morning (5–9)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-green-500" /> Late Morning (9–12)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> Afternoon (12–17)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-orange-500" /> Evening (17–21)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-indigo-500" /> Night</span>
            </div>
          </div>

          {/* Day-of-week chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activities by Day of Week</h2>
            {dowData.every((d) => d.count === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(val: number, name: string) => {
                      if (name === 'count') return [val, 'Activities'];
                      if (name === 'avgPace') return [`${formatPace(val)} /km`, 'Avg Pace'];
                      return [formatDistance(val * 1000), 'Avg Distance'];
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Performance by Day</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Day</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Activities</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Distance</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Pace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dowData.map((d) => (
                    <tr key={d.dayOfWeek} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{d.name}</td>
                      <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">{d.count}</td>
                      <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                        {d.count > 0 ? formatDistance(d.avgDist * 1000) : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
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
