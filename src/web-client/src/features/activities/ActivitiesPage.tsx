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
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <div className="mb-8">
        <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase text-white">Activities</h1>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search activities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72 px-4 py-2.5 font-label text-sm bg-[#131313] border border-[#484847] text-white placeholder-[#767575] focus:outline-none focus:border-[#cffc00] transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
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
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Column picker */}
          <div ref={columnsRef} className="relative">
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              className="bg-[#20201f] border border-[#484847] px-3 py-2 font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white transition-colors"
            >
              Columns
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-[#484847] shadow-2xl p-3 min-w-[140px]">
                {COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 py-1.5 font-label text-xs uppercase tracking-widest text-[#adaaaa] cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                      className="border-[#484847]"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Link to="/activities/compare" className="bg-[#20201f] border border-[#484847] px-3 py-2 font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white transition-colors">
            Compare
          </Link>
          <button
            onClick={() => setExportOpen(true)}
            className="bg-[#20201f] border border-[#484847] px-3 py-2 font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white transition-colors"
          >
            Export CSV
          </button>
          <a
            href="/api/activities/export/full"
            download="runtracker-export.zip"
            className="bg-[#20201f] border border-[#484847] px-3 py-2 font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white transition-colors"
          >
            Export All
          </a>
          <label className="font-label text-[10px] uppercase tracking-widest text-[#767575] whitespace-nowrap">Rows:</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-[#131313] border border-[#484847] text-white px-2 py-2 font-label text-xs focus:border-[#cffc00] focus:outline-none"
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
                className={`px-3 py-1 font-label text-xs uppercase tracking-widest transition-all border-l-2 ${active ? 'text-white' : 'text-[#767575] border-[#484847] hover:border-[#767575] hover:text-[#adaaaa]'}`}
                style={active ? { backgroundColor: (tag.color ?? '#6b7280') + '20', borderColor: tag.color ?? '#6b7280', color: tag.color ?? '#adaaaa' } : {}}
              >
                {tag.name}
              </button>
            );
          })}
          {selectedTagIds.length > 0 && (
            <button
              onClick={() => { setSelectedTagIds([]); setPage(1); }}
              className="px-3 py-1 font-label text-xs uppercase tracking-widest text-[#767575] border border-dashed border-[#484847] hover:text-white hover:border-[#767575] transition-colors"
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
            className="block bg-[#20201f] border-l-2 border-[#484847] p-4 hover:border-[#cffc00] transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="font-label text-[10px] uppercase tracking-widest text-[#767575]">{formatDate(activity.startDate)}</span>
              <span className="font-label text-[10px] uppercase tracking-widest text-[#767575]">{sportTypeName(activity.sportType)}</span>
            </div>
            <p className="font-headline text-sm font-bold text-[#cffc00] mb-2 truncate uppercase">{activity.name}</p>
            <div className="flex items-center gap-3 font-label text-sm text-[#adaaaa]">
              <span className="font-bold text-white">{formatDistance(activity.distance)}</span>
              <span className="text-[#484847]">·</span>
              <span>{formatDuration(activity.movingTime)}</span>
              <span className="text-[#484847]">·</span>
              <span>{formatPace(activity.averagePaceMinPerKm)}/km</span>
            </div>
          </Link>
        ))}
        {data?.items.length === 0 && (
          <div className="bg-[#20201f] border border-[#484847] p-8 text-center font-label text-[#767575]">
            No activities found. Connect your Strava account to sync your runs!
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-[#20201f] overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-[#262626]/50">
            <tr>
              {show('date') && <th onClick={() => handleSort('date')} className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa] cursor-pointer select-none hover:text-white">Date<SortIcon col="date" /></th>}
              {show('name') && <th className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Name</th>}
              {show('type') && <th className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Type</th>}
              {show('distance') && <th onClick={() => handleSort('distance')} className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa] cursor-pointer select-none hover:text-white">Distance<SortIcon col="distance" /></th>}
              {show('duration') && <th onClick={() => handleSort('duration')} className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa] cursor-pointer select-none hover:text-white">Duration<SortIcon col="duration" /></th>}
              {show('pace') && <th className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Pace</th>}
              {show('elevation') && <th onClick={() => handleSort('elevation')} className="px-6 py-4 text-left font-label text-[10px] uppercase tracking-widest text-[#adaaaa] cursor-pointer select-none hover:text-white">Elevation<SortIcon col="elevation" /></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#484847]/10">
            {data?.items.map((activity) => (
              <tr key={activity.id} className="hover:bg-zinc-800/20 transition-colors">
                {show('date') && <td className="px-6 py-4 whitespace-nowrap font-label text-sm text-[#767575]">{formatDate(activity.startDate)}</td>}
                {show('name') && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/activities/${activity.id}`} className="font-headline text-sm font-bold text-[#cffc00] hover:text-white uppercase transition-colors">
                      {activity.name}
                    </Link>
                  </td>
                )}
                {show('type') && <td className="px-6 py-4 whitespace-nowrap font-label text-sm text-[#767575]">{sportTypeName(activity.sportType)}</td>}
                {show('distance') && <td className="px-6 py-4 whitespace-nowrap font-headline text-sm font-bold text-white">{formatDistance(activity.distance)}</td>}
                {show('duration') && <td className="px-6 py-4 whitespace-nowrap font-label text-sm text-[#adaaaa]">{formatDuration(activity.movingTime)}</td>}
                {show('pace') && <td className="px-6 py-4 whitespace-nowrap font-label text-sm text-[#adaaaa]">{formatPace(activity.averagePaceMinPerKm)} /km</td>}
                {show('elevation') && <td className="px-6 py-4 whitespace-nowrap font-label text-sm text-[#adaaaa]">{Math.round(activity.totalElevationGain)} m</td>}
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center font-label text-sm text-[#767575]">
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
          <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">
            Page {data.pageNumber} of {data.totalPages} ({data.totalCount} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!data.hasPreviousPage}
              className="px-4 py-2 bg-[#20201f] border border-[#484847] font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasNextPage}
              className="px-4 py-2 bg-[#20201f] border border-[#484847] font-label text-xs uppercase tracking-widest text-[#adaaaa] hover:border-[#cffc00] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
