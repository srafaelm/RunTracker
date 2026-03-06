import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YearInfographicDialog from './components/YearInfographicDialog';
import {
  useYearlyStats,
  useActivities,
  useProfile,
  usePersonalRecords,
  useAllTimeStats,
  useMultiYearStats,
  useActivityDays,
  useWeeklyStats,
} from '../../hooks/useQueries';
import { useActivityTypeFilter } from '../../contexts/ActivityTypeFilterContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatPace, recordTypeName, sportTypeName } from '../../utils/formatters';
import { RecordType, type PersonalRecord } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts';

// ── Constants ──────────────────────────────────────────────────────────────────

const EVEREST_M = 8848.86;
const EARTH_CIRCUMFERENCE_KM = 40075;
const MOON_DISTANCE_KM = 384400;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_COLORS = [
  '#3b82f6', '#374151', '#22c55e', '#f97316', '#6366f1', '#ec4899', '#f59e0b',
];

const MONTH_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
];

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PR_CATEGORIES: { label: string; types: RecordType[] }[] = [
  { label: 'Short', types: [RecordType.Fastest100m, RecordType.Fastest400m, RecordType.Fastest800m, RecordType.Fastest1K] },
  { label: 'Middle', types: [RecordType.Fastest2K, RecordType.Fastest3K, RecordType.Fastest4K, RecordType.Fastest5K, RecordType.Fastest10K] },
  { label: 'Long', types: [RecordType.Fastest15K, RecordType.Fastest20K, RecordType.FastestHalf, RecordType.Fastest30K, RecordType.FastestMarathon] },
  { label: 'All-Time', types: [RecordType.LongestRun, RecordType.LongestRunTime, RecordType.LongestRide, RecordType.LongestSwim] },
  { label: 'Other', types: [RecordType.MostElevation, RecordType.BestRunCadence, RecordType.BestRideCadence] },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtKm(m: number) { return (m / 1000).toFixed(0); }
function fmtKmDec(m: number) { return (m / 1000).toFixed(1); }
function fmtHrs(sec: number) { return (sec / 3600).toFixed(0); }

function formatHMS(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function heatColor(km: number): string {
  if (km <= 0) return '#374151';
  if (km < 5) return '#1e40af';
  if (km < 10) return '#2563eb';
  if (km < 20) return '#3b82f6';
  return '#93c5fd';
}

// ── Activity Heatmap ──────────────────────────────────────────────────────────

function ActivityHeatmap({ year, distByDate }: { year: number; distByDate: Record<string, number> }) {
  const jan1 = new Date(year, 0, 1);
  const startOffset = (jan1.getDay() + 6) % 7;
  const start = new Date(jan1);
  start.setDate(start.getDate() - startOffset);

  const weeks: (Date | null)[][] = [];
  const cursor = new Date(start);
  while (cursor.getFullYear() <= year) {
    const week: (Date | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(cursor);
      week.push(day.getFullYear() === year ? day : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getFullYear() > year) break;
  }

  const monthLabels: { label: string; col: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    monthLabels.push({ label: MONTH_NAMES_SHORT[m], col: Math.floor((dayOfYear + startOffset) / 7) });
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="flex mb-1" style={{ paddingLeft: 24 }}>
          {weeks.map((_, wIdx) => {
            const label = monthLabels.find((ml) => ml.col === wIdx);
            return <div key={wIdx} className="w-4 shrink-0 text-xs text-gray-400" style={{ fontSize: 10 }}>{label?.label ?? ''}</div>;
          })}
        </div>
        <div className="flex gap-0">
          <div className="flex flex-col gap-0.5 mr-1">
            {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
              <div key={i} className="h-3.5 text-gray-500 text-xs flex items-center" style={{ fontSize: 9 }}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-0.5">
              {week.map((day, dIdx) => {
                if (!day) return <div key={dIdx} className="w-3.5 h-3.5 rounded-sm bg-transparent" />;
                const dateStr = toDateStr(day);
                const km = (distByDate[dateStr] ?? 0) / 1000;
                return <div key={dIdx} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: heatColor(km) }} title={km > 0 ? `${dateStr}: ${km.toFixed(1)} km` : dateStr} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Reusable components ────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatsTable({ rows }: { rows: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="divide-y divide-gray-700/50">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-2.5 px-1">
          <span className="text-sm text-gray-400">{r.label}</span>
          <div className="text-right">
            <span className="text-sm font-semibold text-white">{r.value}</span>
            {r.sub && <span className="text-xs text-gray-500 ml-2 block">{r.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function YearlyReportPage() {
  const { year: yearParam } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const year = parseInt(yearParam ?? String(new Date().getFullYear()), 10);
  const [showInfographic, setShowInfographic] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const isAllTime = year === 0;

  const safeYear = isAllTime ? currentYear : year;
  const fromStr = `${safeYear}-01-01`;
  const toStr = `${safeYear}-12-31`;

  const { globalSportType, globalTagIds } = useActivityTypeFilter();
  const tagIds = globalTagIds.length > 0 ? globalTagIds : undefined;

  const activityPlural = globalSportType == null ? 'Activities' : `${sportTypeName(globalSportType)}s`;
  const activitySingular = globalSportType == null ? 'Activity' : sportTypeName(globalSportType);

  const { data: stats, isLoading: statsLoading } = useYearlyStats(safeYear, globalSportType, tagIds);
  const { data: activitiesPage, isLoading: activitiesLoading } = useActivities({ from: fromStr, to: toStr, pageSize: 500, sportType: globalSportType });
  const { data: profile } = useProfile();
  const { data: prs } = usePersonalRecords(year);
  const { data: allTime, isLoading: allTimeLoading } = useAllTimeStats(globalSportType, tagIds);
  useMultiYearStats(globalSportType, tagIds);
  const { data: activityDays } = useActivityDays(globalSportType);
  const { data: weeklyThisYear } = useWeeklyStats(safeYear, globalSportType, tagIds);
  const { data: weeklyLastYear } = useWeeklyStats(safeYear - 1, globalSportType, tagIds);

  const activities = activitiesPage?.items ?? [];

  // ── Year-specific memos ──────────────────────────────────────────────────────

  const distByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of activities) { const d = a.startDate.slice(0, 10); map[d] = (map[d] ?? 0) + a.distance; }
    return map;
  }, [activities]);

  const { activeDays, maxStreak, currentStreak } = useMemo(() => {
    const dates = [...new Set(activities.map((a) => a.startDate.slice(0, 10)))].sort();
    let maxStreak = 0, streak = 0;
    for (let i = 0; i < dates.length; i++) {
      streak = (i === 0 || (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000 !== 1) ? 1 : streak + 1;
      maxStreak = Math.max(maxStreak, streak);
    }
    const today = toDateStr(new Date());
    const yesterday = toDateStr(new Date(Date.now() - 86400000));
    let currentStreak = 0;
    if (dates.length > 0 && (dates[dates.length - 1] === today || dates[dates.length - 1] === yesterday)) {
      currentStreak = 1;
      for (let i = dates.length - 2; i >= 0; i--) {
        if ((new Date(dates[i + 1]).getTime() - new Date(dates[i]).getTime()) / 86400000 === 1) currentStreak++; else break;
      }
    }
    return { activeDays: dates.length, maxStreak, currentStreak };
  }, [activities]);

  const activityBars = useMemo(() =>
    activities.slice().sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((a) => ({ date: a.startDate.slice(0, 10), km: +(a.distance / 1000).toFixed(2), month: new Date(a.startDate).getMonth() })),
    [activities]);

  const monthlyData = useMemo(() =>
    (stats?.monthlyBreakdown ?? []).map((m) => ({ name: m.monthName.slice(0, 3), km: +(m.totalDistance / 1000).toFixed(1), month: m.month - 1 })),
    [stats]);

  const weekdayData = useMemo(() => {
    const counts = new Array(7).fill(0);
    for (const a of activities) counts[new Date(a.startDate).getDay()]++;
    const total = counts.reduce((s, c) => s + c, 0);
    return WEEKDAY_NAMES.map((name, i) => ({ name, count: counts[i], value: counts[i], pct: total > 0 ? +((counts[i] / total) * 100).toFixed(1) : 0, fill: WEEKDAY_COLORS[i] }))
      .filter((d) => d.count > 0);
  }, [activities]);

  // ── 52-week rolling chart ─────────────────────────────────────────────────────

  const rollingWeekData = useMemo(() => {
    const allWeeks = [
      ...(weeklyLastYear?.weeks ?? []).map((w) => ({ ...w, label: `${year - 1}-W${String(w.weekNumber).padStart(2, '0')}` })),
      ...(weeklyThisYear?.weeks ?? []).map((w) => ({ ...w, label: `${year}-W${String(w.weekNumber).padStart(2, '0')}` })),
    ];
    const last52 = allWeeks.slice(-52);
    if (last52.length === 0) return null;
    const avgKm = +(last52.reduce((s, w) => s + w.totalDistance, 0) / last52.length / 1000).toFixed(1);
    return { weeks: last52.map((w) => ({ label: w.label, km: +(w.totalDistance / 1000).toFixed(1) })), avgKm };
  }, [weeklyThisYear, weeklyLastYear, year]);

  // ── Eddington number ──────────────────────────────────────────────────────────

  const eddingtonData = useMemo(() => {
    if (!activityDays || activityDays.length === 0) return null;
    const distances = activityDays.map((d) => d.distanceKm).sort((a, b) => b - a);
    let eddington = 0;
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] >= i + 1) eddington = i + 1; else break;
    }
    const nextTarget = eddington + 1;
    const daysAtNext = distances.filter((d) => d >= nextTarget).length;
    const needed = nextTarget - daysAtNext;
    const start = Math.max(1, eddington - 10);
    const end = eddington + 15;
    const chartData = [];
    for (let km = start; km <= end; km++) {
      chartData.push({ km, days: distances.filter((d) => d >= km).length, isCurrent: km === eddington, isNext: km === nextTarget });
    }
    return { eddington, needed, nextTarget, chartData };
  }, [activityDays]);

  // ── All-time streak ───────────────────────────────────────────────────────────

  const allTimeStreak = useMemo(() => {
    if (!activityDays || activityDays.length === 0) return { maxStreak: 0, maxStart: '', maxEnd: '', currentStreak: 0 };
    const dates = activityDays.map((d) => d.date).sort();
    let maxStreak = 0, maxStart = dates[0], maxEnd = dates[0], streak = 1, streakStart = dates[0];
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000;
      if (diff === 1) { streak++; }
      else { if (streak > maxStreak) { maxStreak = streak; maxStart = streakStart; maxEnd = dates[i - 1]; } streak = 1; streakStart = dates[i]; }
    }
    if (streak > maxStreak) { maxStreak = streak; maxStart = streakStart; maxEnd = dates[dates.length - 1]; }
    const today = toDateStr(new Date());
    const yesterday = toDateStr(new Date(Date.now() - 86400000));
    let currentStreak = 0;
    if (dates.length > 0 && (dates[dates.length - 1] === today || dates[dates.length - 1] === yesterday)) {
      currentStreak = 1;
      for (let i = dates.length - 2; i >= 0; i--) {
        if ((new Date(dates[i + 1]).getTime() - new Date(dates[i]).getTime()) / 86400000 === 1) currentStreak++; else break;
      }
    }
    return { maxStreak, maxStart, maxEnd, currentStreak };
  }, [activityDays]);

  const allTimeBestWeek = useMemo(() => {
    if (!activityDays || activityDays.length === 0) return null;
    const weekMap: Record<string, { distanceKm: number; weekStart: string }> = {};
    for (const day of activityDays) {
      const d = new Date(day.date);
      const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const key = toDateStr(monday);
      if (!weekMap[key]) weekMap[key] = { distanceKm: 0, weekStart: key };
      weekMap[key].distanceKm += day.distanceKm;
    }
    const weeks = Object.values(weekMap);
    if (weeks.length === 0) return null;
    return weeks.reduce((b, w) => w.distanceKm > b.distanceKm ? w : b);
  }, [activityDays]);

  const everestMultiple = stats ? (stats.totalElevationGain / EVEREST_M).toFixed(1) : null;
  const prByType = Object.fromEntries((prs ?? []).map((pr) => [pr.recordType, pr]));

  const yearHighlights = useMemo(() => {
    if (!stats) return null;
    const activeMonths = stats.monthlyBreakdown.filter((m) => m.totalDistance > 0);
    const bestMonth = activeMonths.length > 0
      ? activeMonths.reduce((b, m) => m.totalDistance > b.totalDistance ? m : b)
      : null;
    const activeWeeks = weeklyThisYear?.weeks.filter((w) => w.totalDistance > 0) ?? [];
    const bestWeek = activeWeeks.length > 0
      ? activeWeeks.reduce((b, w) => w.totalDistance > b.totalDistance ? w : b)
      : undefined;
    return { bestMonth, bestWeek, longestRun: stats.longestRunDistance };
  }, [stats, weeklyThisYear]);

  if (isAllTime ? allTimeLoading : (statsLoading || activitiesLoading)) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  // ── All-time report ──────────────────────────────────────────────────────────
  if (isAllTime) {
    const allEverestMultiple = allTime ? (allTime.totalElevationGain / EVEREST_M).toFixed(1) : null;
    const allTotalDistKm = (allTime?.totalDistance ?? 0) / 1000;
    const allGeneralRows = [
      { label: `Total ${activityPlural.toLowerCase()}`, value: String(allTime?.totalRuns ?? 0) },
      { label: 'Total distance', value: `${allTotalDistKm.toFixed(1)} km` },
      { label: `Avg distance per ${activitySingular.toLowerCase()}`, value: allTime && allTime.totalRuns > 0 ? `${(allTotalDistKm / allTime.totalRuns).toFixed(2)} km` : '–' },
      { label: `Longest ${activitySingular.toLowerCase()}`, value: allTime ? `${(allTime.longestRunDistance / 1000).toFixed(2)} km` : '–' },
      { label: 'Trips around the world', value: (allTotalDistKm / EARTH_CIRCUMFERENCE_KM).toFixed(3) },
      { label: 'Trips to the moon', value: (allTotalDistKm / MOON_DISTANCE_KM).toFixed(4) },
      ...(allTime?.firstRunDate ? [{ label: 'First run', value: formatDate(allTime.firstRunDate) }] : []),
      ...(allTime?.lastRunDate ? [{ label: 'Last run', value: formatDate(allTime.lastRunDate) }] : []),
    ];
    const allTimeRows = [
      { label: 'Total moving time', value: formatHMS(allTime?.totalTimeSeconds ?? 0) },
      { label: 'Avg time per run', value: allTime && allTime.totalRuns > 0 ? formatHMS(Math.round(allTime.totalTimeSeconds / allTime.totalRuns)) : '–' },
      { label: 'Active days', value: String(activityDays?.length ?? 0) },
      { label: 'Max day streak', value: `${allTimeStreak.maxStreak} days`, sub: allTimeStreak.maxStart && allTimeStreak.maxEnd ? `${allTimeStreak.maxStart} → ${allTimeStreak.maxEnd}` : undefined },
      { label: 'Current streak', value: `${allTimeStreak.currentStreak} days` },
      { label: 'Eddington number', value: eddingtonData ? `E${eddingtonData.eddington}` : '–' },
    ];
    const YearNav = (
      <select value={0} onChange={(e) => navigate(`/report/${e.target.value}`)}
        className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
        <option value={0}>All time</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    );
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="bg-gray-950 border-b border-gray-800 px-6 py-5">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-black tracking-tight">Run<span className="text-blue-400">Tracker</span></span>
              <span className="text-4xl font-black text-white tracking-tight">All Time</span>
              {profile?.displayName && <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">{profile.displayName}</p>}
            </div>
            <div className="flex items-center gap-3">
              {YearNav}
              <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm px-3 py-2 border border-gray-700 rounded-md hover:border-gray-500 transition-colors">
                ← Dashboard
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Big Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'TOTAL DISTANCE', value: `${fmtKm(allTime?.totalDistance ?? 0)} km`, sub: null },
              { label: `TOTAL ${activityPlural.toUpperCase()}`, value: String(allTime?.totalRuns ?? 0), sub: `${activityDays?.length ?? 0} active days` },
              { label: 'TOTAL TIME', value: `${fmtHrs(allTime?.totalTimeSeconds ?? 0)} hrs`, sub: null },
              { label: 'ELEVATION', value: `${Math.round(allTime?.totalElevationGain ?? 0).toLocaleString()} m`, sub: allEverestMultiple ? `${allEverestMultiple}× Everest` : null },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{s.label}</p>
                <p className="text-3xl font-black text-white">{s.value}</p>
                {s.sub && <p className="text-xs text-blue-400 mt-1">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Highlights */}
          {(allTime?.bestMonthLabel || allTimeBestWeek || (allTime?.longestRunDistance ?? 0) > 0) && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <SectionHeader title="All Time Highlights" subtitle="Best results across all recorded activities" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {allTime?.bestMonthLabel && allTime.bestMonthDistance > 0 && (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Month</p>
                    <p className="text-2xl font-black text-white">{allTime.bestMonthLabel}</p>
                    <p className="text-sm text-blue-400 font-semibold">{(allTime.bestMonthDistance / 1000).toFixed(1)} km</p>
                  </div>
                )}
                {allTimeBestWeek && allTimeBestWeek.distanceKm > 0 && (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Week</p>
                    <p className="text-2xl font-black text-white">{allTimeBestWeek.distanceKm.toFixed(1)} km</p>
                    <p className="text-sm text-blue-400 font-semibold">{formatDate(allTimeBestWeek.weekStart)}</p>
                  </div>
                )}
                {allTime && allTime.longestRunDistance > 0 && (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Longest Run</p>
                    <p className="text-2xl font-black text-white">{(allTime.longestRunDistance / 1000).toFixed(2)} km</p>
                    {allTime.bestYear && <p className="text-sm text-blue-400 font-semibold">Best year: {allTime.bestYear} ({(allTime.bestYearDistance / 1000).toFixed(0)} km)</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* General + Time Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <SectionHeader title="General Statistics" />
              <StatsTable rows={allGeneralRows} />
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <SectionHeader title="Time Statistics" />
              <StatsTable rows={allTimeRows} />
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 pb-4">RunTracker · All Time · Data from Strava</p>
        </div>
      </div>
    );
  }

  const totalDistKm = (allTime?.totalDistance ?? 0) / 1000;

  const generalRows = [
    { label: `${activityPlural} (all time)`, value: String(allTime?.totalRuns ?? 0) },
    { label: 'Total distance (all time)', value: `${totalDistKm.toFixed(1)} km` },
    { label: `Avg distance per ${activitySingular.toLowerCase()}`, value: allTime && allTime.totalRuns > 0 ? `${(totalDistKm / allTime.totalRuns).toFixed(2)} km` : '–' },
    { label: `Longest ${activitySingular.toLowerCase()}`, value: allTime ? `${(allTime.longestRunDistance / 1000).toFixed(2)} km` : '–' },
    { label: 'Avg pace', value: allTime ? `${formatPace(allTime.averagePaceMinPerKm)} /km` : '–' },
    { label: 'Trips around the world', value: (totalDistKm / EARTH_CIRCUMFERENCE_KM).toFixed(3) },
    { label: 'Trips to the moon', value: (totalDistKm / MOON_DISTANCE_KM).toFixed(4) },
    ...(allTime?.firstRunDate ? [{ label: 'First run', value: formatDate(allTime.firstRunDate) }] : []),
  ];

  const timeRows = [
    { label: 'Total moving time', value: formatHMS(allTime?.totalTimeSeconds ?? 0) },
    { label: 'Avg time per run', value: allTime && allTime.totalRuns > 0 ? formatHMS(Math.round((allTime.totalTimeSeconds) / allTime.totalRuns)) : '–' },
    { label: 'Active days (all time)', value: String(activityDays?.length ?? 0) },
    { label: 'Max day streak', value: `${allTimeStreak.maxStreak} days`, sub: allTimeStreak.maxStart && allTimeStreak.maxEnd ? `${allTimeStreak.maxStart} → ${allTimeStreak.maxEnd}` : undefined },
    { label: 'Current streak', value: `${allTimeStreak.currentStreak} days` },
    { label: 'Eddington number', value: eddingtonData ? `E${eddingtonData.eddington}` : '–' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {showInfographic && (
        <YearInfographicDialog year={year} onClose={() => setShowInfographic(false)} />
      )}

      {/* ── Header ── */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-black tracking-tight">Run<span className="text-blue-400">Tracker</span></span>
            <span className="text-5xl font-black text-white tracking-tight">{year}</span>
            {profile?.displayName && <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">{profile.displayName}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInfographic(true)}
              className="text-sm px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            >
              📊 Infographic
            </button>
            <select value={year} onChange={(e) => navigate(`/report/${e.target.value}`)}
              className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value={0}>All time</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm px-3 py-2 border border-gray-700 rounded-md hover:border-gray-500 transition-colors">
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Year Big Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL DISTANCE', value: `${fmtKm(stats?.totalDistance ?? 0)} km`, sub: null },
            { label: `TOTAL ${activityPlural.toUpperCase()}`, value: String(stats?.totalRuns ?? 0), sub: `${activeDays} active days` },
            { label: 'TOTAL TIME', value: `${fmtHrs(stats?.totalTimeSeconds ?? 0)} hrs`, sub: null },
            { label: 'ELEVATION', value: `${Math.round(stats?.totalElevationGain ?? 0).toLocaleString()} m`, sub: everestMultiple ? `${everestMultiple}× Everest` : null },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{s.label}</p>
              <p className="text-3xl font-black text-white">{s.value}</p>
              {s.sub && <p className="text-xs text-blue-400 mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Year Highlights ── */}
        {yearHighlights && yearHighlights.longestRun > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title={`${year} Highlights`} subtitle="Best results for this year" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {yearHighlights.bestMonth && yearHighlights.bestMonth.totalDistance > 0 && (
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Month</p>
                  <p className="text-2xl font-black text-white">{yearHighlights.bestMonth.monthName}</p>
                  <p className="text-sm text-blue-400 font-semibold">{(yearHighlights.bestMonth.totalDistance / 1000).toFixed(1)} km</p>
                  <p className="text-xs text-gray-500 mt-0.5">{yearHighlights.bestMonth.totalRuns} {activityPlural.toLowerCase()}</p>
                </div>
              )}
              {yearHighlights.bestWeek && yearHighlights.bestWeek.totalDistance > 0 && (
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Best Week</p>
                  <p className="text-2xl font-black text-white">W{yearHighlights.bestWeek.weekNumber}</p>
                  <p className="text-sm text-blue-400 font-semibold">{(yearHighlights.bestWeek.totalDistance / 1000).toFixed(1)} km</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(yearHighlights.bestWeek.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                </div>
              )}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Longest {activitySingular}</p>
                <p className="text-2xl font-black text-white">{(yearHighlights.longestRun / 1000).toFixed(2)} km</p>
                <p className="text-sm text-blue-400 font-semibold">{year}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity Calendar ── */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <SectionHeader title="Activity Calendar" />
            <div className="flex items-center gap-4 text-sm text-gray-400 -mt-4">
              <span>Active days: <strong className="text-white">{activeDays}</strong></span>
              <span>Max streak: <strong className="text-white">{maxStreak}</strong> days</span>
              {currentStreak > 0 && <span>Current: <strong className="text-white">{currentStreak}</strong> days</span>}
            </div>
          </div>
          <ActivityHeatmap year={year} distByDate={distByDate} />
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Less</span>
            {['#374151', '#1e40af', '#2563eb', '#3b82f6', '#93c5fd'].map((c) => <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />)}
            <span>More</span>
          </div>
        </div>

        {/* ── Monthly + Individual Activities ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title="Monthly Distance (km)" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#93c5fd' }} formatter={(v: number) => [`${v} km`, 'Distance']} />
                <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry) => <Cell key={entry.name} fill={MONTH_COLORS[entry.month] ?? '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title={`All ${activityPlural} — ${activities.length}`} />
            {activityBars.length > 0 ? (
              <div className="flex items-end gap-px h-[220px] overflow-hidden">
                {activityBars.map((a, i) => {
                  const maxKm = Math.max(...activityBars.map((x) => x.km), 1);
                  return <div key={i} title={`${a.date}: ${a.km} km`} className="flex-1 min-w-0 rounded-t-sm hover:opacity-80" style={{ height: `${(a.km / maxKm) * 100}%`, backgroundColor: MONTH_COLORS[a.month], minWidth: 2 }} />;
                })}
              </div>
            ) : <p className="text-gray-500 text-sm">No activities this year.</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {MONTH_NAMES_SHORT.map((m, i) => (
                <span key={m} className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: MONTH_COLORS[i] }} />{m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 52-week Rolling Chart ── */}
        {rollingWeekData && rollingWeekData.weeks.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-0">
              <SectionHeader title="Distance per week (last 52 weeks)" />
              <span className="text-xs text-gray-400 -mt-4">Avg: <strong className="text-white">{rollingWeekData.avgKm} km</strong></span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rollingWeekData.weeks} barCategoryGap="10%">
                <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb', fontSize: 11 }} itemStyle={{ color: '#93c5fd' }} formatter={(v: number) => [`${v} km`, 'Distance']} />
                <ReferenceLine y={rollingWeekData.avgKm} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
                <Bar dataKey="km" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Weekday Statistics ── */}
        {weekdayData.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title="Weekday Statistics" />
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full" style={{ flex: '1 1 0' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={weekdayData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                      label={({ name, pct }) => `${name}: ${pct} %`} labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}>
                      {weekdayData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number, _: string, entry: { payload?: { pct: number } }) => [`${v} ${activityPlural.toLowerCase()} (${entry.payload?.pct ?? 0}%)`, activityPlural]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-52 shrink-0 space-y-2">
                {[...weekdayData].sort((a, b) => b.count - a.count).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-sm text-gray-300 flex-1">{d.name}</span>
                    <span className="text-sm font-bold text-white">{d.pct}%</span>
                    <span className="text-xs text-gray-500 w-12 text-right">{d.count} {activityPlural.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── General + Time Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title="General Statistics" />
            <StatsTable rows={generalRows} />
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title="Time Statistics" />
            <StatsTable rows={timeRows} />
          </div>
        </div>

        {/* ── Quick Year Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'AVG PACE', value: `${formatPace(stats?.averagePaceMinPerKm ?? 0)} /km` },
            { label: `LONGEST ${activitySingular.toUpperCase()}`, value: `${fmtKmDec(stats?.longestRunDistance ?? 0)} km` },
            { label: 'YEAR STREAK', value: `${maxStreak} days` },
            { label: 'ELEVATION', value: `${everestMultiple}× Everest` },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{s.label}</p>
              <p className="text-xl font-black text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Personal Records ── */}
        {prs && prs.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <SectionHeader title={`${year} Personal Records`} subtitle="Records achieved during this year" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PR_CATEGORIES.map((cat) => {
                const catPrs = cat.types.map((t) => prByType[t]).filter(Boolean) as PersonalRecord[];
                if (catPrs.length === 0) return null;
                return (
                  <div key={cat.label}>
                    <p className="text-xs text-blue-400 uppercase tracking-widest font-semibold mb-2">{cat.label}</p>
                    <div className="space-y-2">
                      {catPrs.map((pr) => (
                        <div key={pr.recordType} className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{recordTypeName(pr.recordType)}</span>
                          <span className="text-sm font-bold text-white">{pr.displayValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 pb-4">RunTracker · {year} · Data from Strava</p>
      </div>
    </div>
  );
}
