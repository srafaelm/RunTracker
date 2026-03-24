import { useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useYearInfographic } from '../../../hooks/useQueries';
import type { YearInfographic, MonthlyBySportType } from '../../../types';
import { SportType } from '../../../types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SPORT_COLORS: Record<number, string> = {
  [SportType.Run]: '#ef4444',
  [SportType.TrailRun]: '#f97316',
  [SportType.VirtualRun]: '#fb923c',
  [SportType.Ride]: '#eab308',
  [SportType.Swim]: '#3b82f6',
  [SportType.Walk]: '#22c55e',
  [SportType.Hike]: '#16a34a',
  [SportType.Other]: '#8b5cf6',
};

const SPORT_LABEL: Record<number, string> = {
  [SportType.Run]: 'Run',
  [SportType.TrailRun]: 'Trail',
  [SportType.VirtualRun]: 'Virtual',
  [SportType.Ride]: 'Ride',
  [SportType.Swim]: 'Swim',
  [SportType.Walk]: 'Walk',
  [SportType.Hike]: 'Hike',
  [SportType.Other]: 'Other',
};

// City-to-city distance lookup (approximate straight-line distances in km)
const CITY_DISTANCES: { label: string; km: number }[] = [
  { label: 'Amsterdam → Paris', km: 430 },
  { label: 'Amsterdam → Berlin', km: 660 },
  { label: 'London → Rome', km: 1430 },
  { label: 'London → Moscow', km: 2500 },
  { label: 'Lisbon → Oslo', km: 3300 },
  { label: 'Lisbon → Reykjavik', km: 3600 },
  { label: 'London → New York', km: 5570 },
  { label: 'Amsterdam → New York', km: 5860 },
  { label: 'London → Dubai', km: 5500 },
  { label: 'London → Tokyo', km: 9560 },
  { label: 'London → Sydney', km: 16993 },
];

function getCityComparison(km: number): { label: string; fraction: number } {
  let best = CITY_DISTANCES[0];
  for (const c of CITY_DISTANCES) {
    if (c.km <= km) best = c;
    else break;
  }
  const fraction = Math.min(km / best.km, 1);
  return { label: best.label, fraction };
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Dot Calendar ─────────────────────────────────────────────────────────────

interface DotCalendarProps {
  year: number;
  dailySummaries: YearInfographic['dailyActivitySummaries'];
}

function DotCalendar({ year, dailySummaries }: DotCalendarProps) {
  // Build a map: date string → primary sport type color
  const dateColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of dailySummaries) {
      if (!map[s.date]) {
        map[s.date] = SPORT_COLORS[s.sportType] ?? '#8b5cf6';
      }
    }
    return map;
  }, [dailySummaries]);

  // Build week columns: ISO week, Mon–Sun rows
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  // Find first Monday on or before Jan 1
  const startDay = new Date(jan1);
  const dow = startDay.getDay(); // 0=Sun,1=Mon,...
  const offset = dow === 0 ? 6 : dow - 1; // days back to Monday
  startDay.setDate(startDay.getDate() - offset);

  const weeks: Date[][] = [];
  const cur = new Date(startDay);
  while (cur <= dec31) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const DOT_SIZE = 6;
  const GAP = 2;
  const LABEL_W = 22;
  const cols = weeks.length;
  const svgW = LABEL_W + cols * (DOT_SIZE + GAP);
  const svgH = 7 * (DOT_SIZE + GAP);

  return (
    <svg width={svgW} height={svgH + 12} style={{ maxWidth: '100%' }}>
      {/* Day labels */}
      {['M', 'W', 'F'].map((l, i) => (
        <text
          key={l}
          x={0}
          y={(i * 2 + 1) * (DOT_SIZE + GAP) + DOT_SIZE / 2 + 3}
          fontSize={6}
          fill="#6b7280"
          dominantBaseline="middle"
        >
          {l}
        </text>
      ))}
      {weeks.map((week, wi) =>
        week.map((day, di) => {
          const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const inYear = day.getFullYear() === year;
          const color = inYear ? (dateColorMap[ds] ?? '#1f2937') : 'transparent';
          return (
            <circle
              key={ds + di}
              cx={LABEL_W + wi * (DOT_SIZE + GAP) + DOT_SIZE / 2}
              cy={di * (DOT_SIZE + GAP) + DOT_SIZE / 2 + 12}
              r={DOT_SIZE / 2}
              fill={color}
              opacity={inYear ? 1 : 0}
            />
          );
        })
      )}
    </svg>
  );
}

// ── Everest Visual ────────────────────────────────────────────────────────────

function EverestVisual({ multiple }: { multiple: number }) {
  const pct = Math.min(multiple / 4, 1); // cap at 4× for visual
  const H = 60;
  const peakX = 40;
  const baseY = H;
  const peakY = H - H * 0.7;
  const fillY = peakY + (baseY - peakY) * (1 - pct);

  return (
    <svg viewBox="0 0 80 70" width={80} height={70}>
      {/* Mountain outline */}
      <polygon
        points={`0,${baseY} ${peakX},${peakY} 80,${baseY}`}
        fill="#374151"
        stroke="#6b7280"
        strokeWidth={1}
      />
      {/* Filled portion */}
      <clipPath id="mountainClip">
        <polygon points={`0,${baseY} ${peakX},${peakY} 80,${baseY}`} />
      </clipPath>
      <rect
        x={0}
        y={fillY}
        width={80}
        height={H - fillY}
        fill="#3b82f6"
        clipPath="url(#mountainClip)"
      />
      <text x={peakX} y={peakY - 4} textAnchor="middle" fontSize={8} fill="white">
        {fmt(multiple, 1)}×
      </text>
    </svg>
  );
}

// ── Hours Gauge ───────────────────────────────────────────────────────────────

function HoursGauge({ hours }: { hours: number }) {
  const max = Math.max(hours, 500);
  const pct = hours / max;
  const radius = 28;
  const cx = 36;
  const cy = 36;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const arcLen = endAngle - startAngle;
  const fillEnd = startAngle + arcLen * pct;

  function arc(start: number, end: number) {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  return (
    <svg viewBox="0 0 72 44" width={72} height={44}>
      <path d={arc(startAngle, endAngle)} fill="none" stroke="#374151" strokeWidth={8} />
      <path d={arc(startAngle, fillEnd)} fill="none" stroke="#f59e0b" strokeWidth={8} strokeLinecap="round" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={9} fill="white" fontWeight="bold">
        {Math.round(hours)}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={6} fill="#9ca3af">
        hrs
      </text>
    </svg>
  );
}

// ── Monthly Bar Chart ─────────────────────────────────────────────────────────

function MonthlyChart({ data }: { data: MonthlyBySportType[] }) {
  const sportTypes = [...new Set(data.map((d) => d.sportType))];

  const chartData = MONTH_NAMES.map((name, i) => {
    const month = i + 1;
    const entry: Record<string, number | string> = { name };
    for (const st of sportTypes) {
      const row = data.find((d) => d.month === month && d.sportType === st);
      entry[String(st)] = row ? Math.round(row.distanceKm) : 0;
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(value: number, name: string) => [`${value} km`, SPORT_LABEL[Number(name)] ?? name]}
        />
        {sportTypes.map((st) => (
          <Bar key={st} dataKey={String(st)} stackId="a" fill={SPORT_COLORS[st] ?? '#8b5cf6'} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

interface Props {
  year: number;
  onClose: () => void;
}

export default function YearInfographicDialog({ year, onClose }: Props) {
  const { data, isLoading } = useYearInfographic(year);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cityComp = useMemo(() => {
    if (!data) return null;
    return getCityComparison(data.totalDistanceKm);
  }, [data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-5xl bg-gray-900 text-white rounded-xl overflow-auto"
        style={{ maxHeight: '98vh' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white text-2xl leading-none"
        >
          ×
        </button>

        {isLoading || !data ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">RunTracker {year}</h2>
                <p className="text-gray-400 text-sm">{data.displayName}</p>
                {data.userName && (
                  <p className="text-gray-500 text-xs mt-0.5">@{data.userName}</p>
                )}
              </div>
              {data.profilePictureUrl && (
                <img src={data.profilePictureUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              )}
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-3 gap-4">
              {/* COL 1: Total distance + city comparison */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Distance</p>
                <p className="text-4xl font-bold text-red-400">{Math.round(data.totalDistanceKm)}</p>
                <p className="font-label text-xs text-[#767575]">km</p>
                {cityComp && (
                  <div className="mt-2">
                    <p className="font-label text-[10px] text-[#767575]">{cityComp.label}</p>
                    <div className="h-2 bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${cityComp.fraction * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{fmt(cityComp.fraction * 100, 0)}%</p>
                  </div>
                )}
              </div>

              {/* COL 2: Active days + dot calendar */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Active Days</p>
                    <p className="text-3xl font-bold">{data.activeDays}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Max Streak</p>
                    <p className="text-3xl font-bold">{data.maxStreakDays}</p>
                    <p className="font-label text-[10px] text-[#767575]">days</p>
                  </div>
                </div>
                <div className="mt-1 overflow-hidden">
                  <DotCalendar year={year} dailySummaries={data.dailyActivitySummaries} />
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(SPORT_COLORS)
                    .filter(([st]) => data.dailyActivitySummaries.some((d) => String(d.sportType) === st))
                    .map(([st, color]) => (
                      <span key={st} className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        {SPORT_LABEL[Number(st)]}
                      </span>
                    ))}
                </div>
              </div>

              {/* COL 3: Per-type maxes */}
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Personal Bests</p>
                {data.maxRunDistance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Max Run</span>
                    <span className="font-semibold">{fmt(data.maxRunDistance)} km</span>
                  </div>
                )}
                {data.maxRideDistance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-400">Max Ride</span>
                    <span className="font-semibold">{fmt(data.maxRideDistance)} km</span>
                  </div>
                )}
                {data.maxRideElevation > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-400">Ride Elevation</span>
                    <span className="font-semibold">{Math.round(data.maxRideElevation)} m</span>
                  </div>
                )}
                {data.maxSwimDistance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-400">Max Swim</span>
                    <span className="font-semibold">{fmt(data.maxSwimDistance)} km</span>
                  </div>
                )}
                {data.maxSwimTimeSec > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-400">Swim Time</span>
                    <span className="font-semibold">{fmtTime(data.maxSwimTimeSec)}</span>
                  </div>
                )}
                {data.maxWalkDistance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Max Walk</span>
                    <span className="font-semibold">{fmt(data.maxWalkDistance)} km</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECOND ROW: Hours + Elevation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-6">
                <HoursGauge hours={data.totalHours} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Hours</p>
                  <p className="text-3xl font-bold text-yellow-400">{fmt(data.totalHours, 0)}</p>
                  <p className="font-label text-[10px] text-[#767575]">hours of activity</p>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-6">
                <EverestVisual multiple={data.everestMultiple} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Elevation</p>
                  <p className="text-3xl font-bold text-blue-400">{Math.round(data.totalElevationM).toLocaleString()}</p>
                  <p className="font-label text-[10px] text-[#767575]">meters ({fmt(data.everestMultiple, 2)}× Everest)</p>
                </div>
              </div>
            </div>

            {/* MONTHLY CHART */}
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Monthly Distance by Sport (km)</p>
              <MonthlyChart data={data.monthlyBreakdownBySportType} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

