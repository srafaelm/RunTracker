import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActivities, useTags } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import ActivityFilters from '../../components/ActivityFilters';
import ActivityExportDialog from './ActivityExportDialog';
import { useActivityTypeFilter } from '../../contexts/ActivityTypeFilterContext';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatDate,
  sportTypeName,
} from '../../utils/formatters';

type ColumnId = 'date' | 'name' | 'type' | 'distance' | 'duration' | 'pace' | 'elevation';

const COLUMNS: { id: ColumnId; label: string; defaultVisible: boolean }[] = [
  { id: 'date', label: 'Date', defaultVisible: true },
  { id: 'name', label: 'Name', defaultVisible: true },
  { id: 'type', label: 'Type', defaultVisible: true },
  { id: 'distance', label: 'Distance', defaultVisible: true },
  { id: 'duration', label: 'Duration', defaultVisible: true },
  { id: 'pace', label: 'Pace', defaultVisible: true },
  { id: 'elevation', label: 'Elevation', defaultVisible: true },
];

const STORAGE_KEY = 'activities_visible_columns';

function loadVisibleColumns(): ColumnId[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnId[];
      const valid = COLUMNS.map((c) => c.id);
      return parsed.filter((id) => valid.includes(id));
    }
  } catch {}
  return COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
}

export default function ActivitiesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { globalSportType, setGlobalSportType } = useActivityTypeFilter();
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(loadVisibleColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: allTags } = useTags();
  const { data, isLoading } = useActivities({ page, pageSize, sportType: globalSportType, from, to, tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined, sortBy, sortDesc, search: debouncedSearch || undefined });

  useEffect(() => {
    if (!columnsOpen) return;
    function handleOutside(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [columnsOpen]);

  function toggleColumn(id: ColumnId) {
    setVisibleColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDesc((d) => !d);
    } else {
      setSortBy(col);
      setSortDesc(true);
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <span className="text-gray-400 opacity-40 ml-1">↕</span>;
    return <span className="ml-1">{sortDesc ? '↓' : '↑'}</span>;
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
    setPage(1);
  }

  const show = (id: ColumnId) => visibleColumns.includes(id);

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Activities</h1>

      <div className="mb-3">
        <input
          type="text"
          placeholder="Search activities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <ActivityFilters
            sportType={globalSportType}
            onSportTypeChange={(v) => { setGlobalSportType(v); setPage(1); }}
            from={from}
            to={to}
            onDateChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }}
            showDateRange
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Column picker */}
          <div ref={columnsRef} className="relative">
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Columns
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[140px]">
                {COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Compare */}
          <Link
            to="/activities/compare"
            className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Compare
          </Link>

          {/* Export */}
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Export CSV
          </button>
          <a
            href="/api/activities/export/full"
            download="runtracker-export.zip"
            className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Export All
          </a>

          {/* Page size */}
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Rows:</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
          >
            {[10, 25, 50, 100, 1000].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {allTags && allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? 'text-white border-transparent'
                    : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                style={active ? { backgroundColor: tag.color ?? '#6b7280', borderColor: tag.color ?? '#6b7280' } : {}}
              >
                {tag.name}
              </button>
            );
          })}
          {selectedTagIds.length > 0 && (
            <button
              onClick={() => { setSelectedTagIds([]); setPage(1); }}
              className="px-2.5 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border border-dashed border-gray-300 dark:border-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {data?.items.map((activity) => (
          <Link
            key={activity.id}
            to={`/activities/${activity.id}`}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(activity.startDate)}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{sportTypeName(activity.sportType)}</span>
            </div>
            <p className="text-sm font-semibold text-primary-600 mb-2 truncate">{activity.name}</p>
            <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{formatDistance(activity.distance)}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{formatDuration(activity.movingTime)}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{formatPace(activity.averagePaceMinPerKm)}/km</span>
            </div>
          </Link>
        ))}
        {data?.items.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            No activities found. Connect your Strava account to sync your runs!
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {show('date') && <th onClick={() => handleSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">Date<SortIcon col="date" /></th>}
              {show('name') && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>}
              {show('type') && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>}
              {show('distance') && <th onClick={() => handleSort('distance')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">Distance<SortIcon col="distance" /></th>}
              {show('duration') && <th onClick={() => handleSort('duration')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">Duration<SortIcon col="duration" /></th>}
              {show('pace') && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pace</th>}
              {show('elevation') && <th onClick={() => handleSort('elevation')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">Elevation<SortIcon col="elevation" /></th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data?.items.map((activity) => (
              <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {show('date') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(activity.startDate)}</td>}
                {show('name') && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/activities/${activity.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-800">
                      {activity.name}
                    </Link>
                  </td>
                )}
                {show('type') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{sportTypeName(activity.sportType)}</td>}
                {show('distance') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">{formatDistance(activity.distance)}</td>}
                {show('duration') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDuration(activity.movingTime)}</td>}
                {show('pace') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatPace(activity.averagePaceMinPerKm)} /km</td>}
                {show('elevation') && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{Math.round(activity.totalElevationGain)} m</td>}
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No activities found. Connect your Strava account to sync your runs!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing page {data.pageNumber} of {data.totalPages} ({data.totalCount}{' '}
            total)
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!data.hasPreviousPage}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasNextPage}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {exportOpen && (
        <ActivityExportDialog
          from={from}
          to={to}
          onClose={() => setExportOpen(false)}
        />
      )}

    </div>
  );
}
