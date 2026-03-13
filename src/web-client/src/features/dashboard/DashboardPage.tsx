import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/client';
import {
  useYearlyStats, useWeeklyStats, usePaceTrend, useActivities, useMultiYearStats,
  useActivityDays, useProfile, useExplorationStats, useAllTimeStats, useScheduledWorkouts,
  useDashboardTemplates, useCreateDashboardTemplate, useUpdateDashboardTemplate,
  useDeleteDashboardTemplate, useActivateDashboardTemplate, useRaces,
} from '../../hooks/useQueries';
import { useActivityTypeFilter } from '../../contexts/ActivityTypeFilterContext';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatElevation,
  formatDate,
  sportTypeName,
} from '../../utils/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import type { DashboardWidgetId, DashboardConfig } from '../../types';
import { DEFAULT_DASHBOARD_WIDGETS, WorkoutType } from '../../types';
import GoalsWidget from '../goals/GoalsWidget';

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  stats_cards: 'Stats Cards',
  streaks: 'Streaks',
  goals: 'Goals',
  recent_activities: 'Recent Activities',
  monthly_chart: 'Monthly Distance Chart',
  weekly_chart: 'Weekly Distance Chart',
  pace_trend: 'Pace Trend',
  multi_year: 'Multi-Year Comparison',
  eddington: 'Eddington Number',
  exploration_stats: 'Exploration Stats',
  upcoming_training: 'Upcoming Training',
};

const WORKOUT_TYPE_COLORS: Record<string, string> = {
  Easy: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  Tempo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Long: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Intervals: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  Recovery: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  Rest: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  Race: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  Strength: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Other: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const YEAR_LINE_COLORS = [
  '#06b6d4', '#f97316', '#22c55e', '#ec4899', '#eab308',
  '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e', '#84cc16',
];

function parseDashboardConfig(raw: string | null | undefined): DashboardWidgetId[] {
  if (!raw) return DEFAULT_DASHBOARD_WIDGETS;
  try {
    const cfg = JSON.parse(raw) as DashboardConfig;
    return cfg.widgets ?? DEFAULT_DASHBOARD_WIDGETS;
  } catch {
    return DEFAULT_DASHBOARD_WIDGETS;
  }
}

export default function DashboardPage() {
  const YEAR_STORAGE_KEY = 'runtracker_dashboard_year';
  const [year, setYear] = useState(() => {
    const stored = localStorage.getItem(YEAR_STORAGE_KEY);
    if (stored !== null) {
      const n = parseInt(stored);
      if (!isNaN(n)) return n;
    }
    return new Date().getFullYear();
  });

  function handleYearChange(y: number) {
    setYear(y);
    localStorage.setItem(YEAR_STORAGE_KEY, String(y));
  }

  const HIDDEN_YEARS_KEY = 'runtracker_hidden_years';
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_YEARS_KEY);
      if (stored) return new Set(JSON.parse(stored) as number[]);
    } catch { /* ignore */ }
    return new Set();
  });
  function toggleYear(yr: number) {
    setHiddenYears((prev) => {
      const next = new Set(prev);
      if (next.has(yr)) next.delete(yr); else next.add(yr);
      localStorage.setItem(HIDDEN_YEARS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const { globalSportType, globalTagIds } = useActivityTypeFilter();

  // Dynamic label + icon for the "Total Runs" stat card based on active sport filter
  const activityCountLabel = (() => {
    if (globalSportType === undefined) return 'Total Activities';
    const name = sportTypeName(globalSportType);
    // Pluralise simple cases
    const plurals: Record<string, string> = {
      'Run': 'Total Runs', 'Trail Run': 'Total Trail Runs', 'Walk': 'Total Walks',
      'Hike': 'Total Hikes', 'Ride': 'Total Rides', 'Swim': 'Total Swims',
      'Virtual Ride': 'Total Virtual Rides', 'Virtual Run': 'Total Virtual Runs',
      'Yoga': 'Total Yoga Sessions', 'Elliptical': 'Total Elliptical Sessions',
      'Weight Training': 'Total Strength Sessions', 'Workout': 'Total Workouts',
    };
    return plurals[name] ?? `Total ${name}s`;
  })();
  const activityCountIcon = (() => {
    const icons: Record<number, string> = { 0: '🏃', 1: '🏔️', 2: '🚶', 3: '⛰️', 4: '🏃', 5: '🚴', 6: '🏊', 7: '💪', 8: '🚴', 9: '🏋️', 10: '💪', 11: '🧘', 12: '🏃' };
    return globalSportType !== undefined ? (icons[globalSportType] ?? '🏃') : '🏅';
  })();
  const isAllTime = year === 0;
  const tagIds = globalTagIds.length > 0 ? globalTagIds : undefined;
  const { data: yearlyStats, isLoading: yearlyLoading } = useYearlyStats(isAllTime ? new Date().getFullYear() : year, globalSportType, tagIds);
  const { data: allTimeStats, isLoading: allTimeLoading } = useAllTimeStats(globalSportType, tagIds);
  const { data: weeklyStats } = useWeeklyStats(isAllTime ? new Date().getFullYear() : year, globalSportType, tagIds);
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: upcomingWorkouts } = useScheduledWorkouts(todayStr, nextWeekStr);
  const { data: allRaces } = useRaces();
  const nextRace = (allRaces ?? []).filter((r) => r.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
  const { data: paceTrend } = usePaceTrend('monthly', globalSportType, tagIds, isAllTime ? undefined : year);
  const { data: recentActivities } = useActivities({ page: 1, pageSize: 5, sportType: globalSportType });
  const { data: multiYear } = useMultiYearStats(globalSportType, tagIds);
  const { data: activityDays } = useActivityDays(globalSportType);
  const { data: explorationStats } = useExplorationStats();
  const { data: profile } = useProfile();

  // Template management
  const { data: templates = [], isLoading: templatesLoading } = useDashboardTemplates();
  const createTemplate = useCreateDashboardTemplate();
  const updateTemplate = useUpdateDashboardTemplate();
  const deleteTemplate = useDeleteDashboardTemplate();
  const activateTemplate = useActivateDashboardTemplate();

  // Auto-migrate: if no templates exist, create one from legacy config
  const didMigrateRef = useRef(false);
  useEffect(() => {
    if (templatesLoading || didMigrateRef.current) return;
    if (templates.length === 0) {
      didMigrateRef.current = true;
      const legacyWidgets = parseDashboardConfig(profile?.dashboardConfig);
      createTemplate.mutate({ name: 'Default', widgets: legacyWidgets });
    }
  }, [templates, templatesLoading, profile]);

  const activeTemplate = templates.find((t) => t.isDefault) ?? templates[0];
  const activeWidgets = (activeTemplate?.widgets ?? DEFAULT_DASHBOARD_WIDGETS) as DashboardWidgetId[];

  // Edit panel state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWidgets, setEditWidgets] = useState<DashboardWidgetId[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const editPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editMode) return;
    function handleOutsideClick(e: MouseEvent) {
      if (editPanelRef.current && !editPanelRef.current.contains(e.target as Node)) {
        setEditMode(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [editMode]);

  function startEdit() {
    if (!activeTemplate) return;
    setEditName(activeTemplate.name);
    setEditWidgets([...activeWidgets]);
    setEditMode(true);
  }

  function toggleEditWidget(id: DashboardWidgetId) {
    setEditWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  async function saveEdit() {
    if (!activeTemplate) return;
    await updateTemplate.mutateAsync({ id: activeTemplate.id, data: { name: editName, widgets: editWidgets } });
    setEditMode(false);
  }

  async function handleDeleteTemplate() {
    if (!activeTemplate) return;
    if (templates.length <= 1) return;
    if (!confirm(`Delete template "${activeTemplate.name}"?`)) return;
    if (activeTemplate.isDefault) {
      const other = templates.find((t) => t.id !== activeTemplate.id);
      if (other) await activateTemplate.mutateAsync(other.id);
    }
    await deleteTemplate.mutateAsync(activeTemplate.id);
    setEditMode(false);
  }

  async function handleCreateTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    await createTemplate.mutateAsync({ name, widgets: DEFAULT_DASHBOARD_WIDGETS });
    setNewTemplateName('');
    setShowNewForm(false);
  }

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const monthlyChartData = yearlyStats?.monthlyBreakdown.map((m) => ({
    name: m.monthName.slice(0, 3),
    distance: +(m.totalDistance / 1000).toFixed(1),
    runs: m.totalRuns,
  })) ?? [];

  const weeklyChartData = weeklyStats?.weeks.map((w) => ({
    name: `W${w.weekNumber}`,
    distance: +(w.totalDistance / 1000).toFixed(1),
  })) ?? [];

  const paceChartData = paceTrend?.points.map((p) => ({
    name: p.periodLabel,
    pace: +p.averagePaceMinPerKm.toFixed(2),
  })) ?? [];

  const { multiYearChartData, yearList } = useMemo(() => {
    if (!multiYear || multiYear.length === 0) return { multiYearChartData: [], yearList: [] as number[] };
    const yearList = multiYear.map((y) => y.year);
    const chartData = MONTH_NAMES_SHORT.map((name, i) => {
      const row: Record<string, number | string> = { month: name };
      for (const yd of multiYear) {
        const md = yd.monthly.find((m) => m.month === i + 1);
        row[String(yd.year)] = +((md?.totalDistance ?? 0) / 1000).toFixed(1);
      }
      return row;
    });
    return { multiYearChartData: chartData, yearList };
  }, [multiYear]);

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

  const show = (id: DashboardWidgetId) => activeWidgets.includes(id);

  if (isAllTime ? allTimeLoading : yearlyLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          {/* Template switcher */}
          {templates.length > 1 && (
            <select
              value={activeTemplate?.id ?? ''}
              onChange={(e) => activateTemplate.mutate(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm focus:outline-none"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value={0}>All time</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Link
            to={`/report/${year}`}
            className="rounded-md bg-gray-900 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            {isAllTime ? 'All Time Report' : 'Year Report'}
          </Link>
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            + Template
          </button>
          <button
            onClick={() => editMode ? setEditMode(false) : startEdit()}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* New Template Form */}
      {showNewForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 flex items-center gap-3">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTemplate(); if (e.key === 'Escape') setShowNewForm(false); }}
            placeholder="Template name…"
            autoFocus
            className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          />
          <button
            onClick={handleCreateTemplate}
            disabled={!newTemplateName.trim() || createTemplate.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Create
          </button>
          <button onClick={() => setShowNewForm(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">
            Cancel
          </button>
        </div>
      )}

      {/* Edit Dashboard Panel */}
      {editMode && activeTemplate && (
        <div ref={editPanelRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1 text-sm font-semibold focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {(Object.entries(WIDGET_LABELS) as [DashboardWidgetId, string][]).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editWidgets.includes(id)}
                  onChange={() => toggleEditWidget(id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={saveEdit}
              disabled={updateTemplate.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {updateTemplate.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => setEditWidgets(DEFAULT_DASHBOARD_WIDGETS as DashboardWidgetId[])}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Reset widgets
            </button>
            {templates.length > 1 && (
              <button
                onClick={handleDeleteTemplate}
                disabled={deleteTemplate.isPending || activateTemplate.isPending}
                className="ml-auto px-4 py-2 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
              >
                Delete template
              </button>
            )}
          </div>
        </div>
      )}

      {/* Onboarding banner — shown when user has no activities yet */}
      {!allTimeLoading && (allTimeStats?.totalRuns ?? 0) === 0 && (
        <div className="mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Welcome to RunTracker!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Get started by importing your activities or adding one manually.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!profile?.stravaConnected ? (
              <div className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-5">
                <div className="text-3xl">🏅</div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Connect Strava</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sync all your past and future runs automatically.</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const { data } = await authApi.getStravaConnectUrl();
                      window.location.href = data.url;
                    } catch (err: any) {
                      const msg = err?.response?.data?.error ?? 'Could not connect to Strava. Please try again.';
                      alert(msg);
                    }
                  }}
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-sm transition-colors"
                >
                  Connect Strava
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-5">
                <div className="text-3xl">🔄</div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Strava Connected</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your activities are being synced. Check back shortly.</p>
                </div>
              </div>
            )}
            <div className="flex flex-col items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-5">
              <div className="text-3xl">✏️</div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Add Manually</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Log an activity without Strava — runs, rides, or anything else.</p>
              </div>
              <Link
                to="/training"
                className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
              >
                Go to Training
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      {show('stats_cards') && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {isAllTime ? (
            <>
              <StatCard title="Total Distance" value={`${Math.round((allTimeStats?.totalDistance ?? 0) / 1000)} km`} icon="📏" />
              <StatCard title={activityCountLabel} value={String(allTimeStats?.totalRuns ?? 0)} icon={activityCountIcon} />
              <StatCard title="Total Time" value={(() => { const s = allTimeStats?.totalTimeSeconds ?? 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; })()} icon="⏱️" />
              <StatCard title="Elevation Gain" value={formatElevation(allTimeStats?.totalElevationGain ?? 0)} icon="⛰️" />
              {nextRace ? (() => {
                const daysUntil = Math.max(0, Math.ceil((new Date(nextRace.date).getTime() - Date.now()) / 86400000));
                return (
                  <Link to="/races" className="block">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                      <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Next Race</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{nextRace.title}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-300 font-semibold">{daysUntil} days to go</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(nextRace.date)}{nextRace.plannedDistanceMeters ? ` · ${formatDistance(nextRace.plannedDistanceMeters)}` : ''}</p>
                    </div>
                  </Link>
                );
              })() : (
                <Link to="/races" className="block">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                    <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Next Race</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">No race planned</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add a race to start counting down</p>
                  </div>
                </Link>
              )}
            </>
          ) : (
            <>
              <StatCard title="Total Distance" value={`${Math.round((yearlyStats?.totalDistance ?? 0) / 1000)} km`} icon="📏" />
              <StatCard title={activityCountLabel} value={String(yearlyStats?.totalRuns ?? 0)} icon={activityCountIcon} />
              <StatCard title="Total Time" value={(() => { const s = yearlyStats?.totalTimeSeconds ?? 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; })()} icon="⏱️" />
              <StatCard title="Elevation Gain" value={formatElevation(yearlyStats?.totalElevationGain ?? 0)} icon="⛰️" />
              {nextRace ? (() => {
                const daysUntil = Math.max(0, Math.ceil((new Date(nextRace.date).getTime() - Date.now()) / 86400000));
                return (
                  <Link to="/races" className="block">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                      <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Next Race</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{nextRace.title}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-300 font-semibold">{daysUntil} days to go</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(nextRace.date)}{nextRace.plannedDistanceMeters ? ` · ${formatDistance(nextRace.plannedDistanceMeters)}` : ''}</p>
                    </div>
                  </Link>
                );
              })() : (
                <Link to="/races" className="block">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                    <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Next Race</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">No race planned</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add a race to start counting down</p>
                  </div>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Streaks + Goals */}
      {(show('streaks') || show('goals')) && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6 items-stretch">
          {show('streaks') && allTimeStats && (
            <StatCard title="Week Streak" value={`${allTimeStats.currentWeekStreak} wks`} icon="📅" className="flex flex-col justify-center" />
          )}
          {show('goals') && (
            <div className={show('streaks') ? 'col-span-1 md:col-span-3 lg:col-span-4' : 'col-span-2 md:col-span-4 lg:col-span-5'}>
              <GoalsWidget />
            </div>
          )}
        </div>
      )}

      {/* Upcoming training */}
      {show('upcoming_training') && upcomingWorkouts && upcomingWorkouts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Training</h2>
            <Link to="/training" className="text-sm text-primary-600 hover:text-primary-800 font-medium">View schedule →</Link>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingWorkouts.slice(0, 5).map((w) => (
              <li key={w.id} className="flex items-center gap-4 px-6 py-3">
                <span className="text-sm text-gray-400 dark:text-gray-500 w-24 shrink-0">{formatDate(w.date)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{w.title}</p>
                  {w.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{w.notes}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {w.plannedDistanceMeters && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatDistance(w.plannedDistanceMeters)}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WORKOUT_TYPE_COLORS[WorkoutType[w.workoutType]] ?? WORKOUT_TYPE_COLORS['Other']}`}>
                    {WorkoutType[w.workoutType]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}


      {/* Recent Activities */}
      {show('recent_activities') && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activities</h2>
            <Link to="/activities" className="text-sm text-primary-600 hover:text-primary-800 font-medium">View all →</Link>
          </div>
          {!recentActivities || recentActivities.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              No activities yet. Connect your Strava account to sync your runs!
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentActivities.items.map((activity) => (
                <li key={activity.id}>
                  <Link to={`/activities/${activity.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <span className="text-sm text-gray-400 dark:text-gray-500 w-24 shrink-0 hidden sm:block">{formatDate(activity.startDate)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{formatDate(activity.startDate)} · {sportTypeName(activity.sportType)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{sportTypeName(activity.sportType)}</p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-white">{formatDistance(activity.distance)}</span>
                      <span className="hidden sm:block">{formatDuration(activity.movingTime)}</span>
                      <span className="text-gray-400 dark:text-gray-500">{formatPace(activity.averagePaceMinPerKm)}/km</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {show('monthly_chart') && !isAllTime && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Distance (km)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {show('weekly_chart') && !isAllTime && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Distance (km)</h2>
            {!weeklyStats ? <LoadingSpinner /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="distance" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {show('multi_year') && multiYearChartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Distance per year (km/month)</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Current year ({year}) is highlighted</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {yearList.map((yr, i) => {
                  const hidden = hiddenYears.has(yr);
                  const color = YEAR_LINE_COLORS[i % YEAR_LINE_COLORS.length];
                  return (
                    <button
                      key={yr}
                      onClick={() => toggleYear(yr)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${hidden ? 'bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600' : 'text-white border-transparent'}`}
                      style={hidden ? {} : { backgroundColor: color }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={multiYearChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'km', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v} km`]} />
                {yearList.filter((yr) => !hiddenYears.has(yr)).map((yr) => (
                  <Line key={yr} type="monotone" dataKey={String(yr)} stroke={YEAR_LINE_COLORS[yearList.indexOf(yr) % YEAR_LINE_COLORS.length]}
                    strokeWidth={yr === year ? 2.5 : 1.5} strokeOpacity={yr === year ? 1 : 0.55} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {show('eddington') && eddingtonData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Eddington Number</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Largest E where you've run at least E km on at least E separate days</p>
              </div>
              <div className="flex gap-8 text-center">
                <div><p className="text-3xl font-black text-blue-400">{eddingtonData.eddington}</p><p className="text-xs text-gray-400 mt-0.5">km (current E)</p></div>
                <div><p className="text-3xl font-black text-amber-400">{eddingtonData.needed}</p><p className="text-xs text-gray-400 mt-0.5">runs for E{eddingtonData.nextTarget}</p></div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eddingtonData.chartData} barCategoryGap="8%">
                <XAxis dataKey="km" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} km`} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v} days`, 'Days ≥ N km']} labelFormatter={(v) => `${v} km`} />
                <Bar dataKey="days" radius={[3, 3, 0, 0]}>
                  {eddingtonData.chartData.map((d) => (
                    <Cell key={d.km} fill={d.isCurrent ? '#f97316' : d.isNext ? '#fbbf24' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-orange-500" /> Current E</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-amber-400" /> Next target</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> Other</span>
            </div>
          </div>
        )}

        {show('pace_trend') && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pace Trend (min/km)</h2>
            {!paceTrend ? <LoadingSpinner /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={paceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis reversed domain={['auto', 'auto']} tickFormatter={(v: number) => formatPace(v)} width={45} />
                  <Tooltip formatter={(v: number) => [`${formatPace(v)} /km`, 'Pace']} />
                  <Line type="monotone" dataKey="pace" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Exploration Stats */}
      {show('exploration_stats') && explorationStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Exploration Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-500">{explorationStats.countriesCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Countries</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-500">{explorationStats.citiesWithProgress}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cities</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-violet-500">{explorationStats.completedStreetsTotal}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Streets Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-500">{explorationStats.explorerTilesCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Explorer Tiles</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">{explorationStats.tripsToMoon.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Trip to Moon</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-rose-500">{explorationStats.tripsAroundEarth.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Around Earth</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
