import { useState } from 'react';
import { useTrainingLoad } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SportType } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

const SPORT_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Run', value: SportType.Run },
  { label: 'Trail Run', value: SportType.TrailRun },
  { label: 'Ride', value: SportType.Ride },
];

function FormZone({ tsb }: { tsb: number }) {
  if (tsb >= 5 && tsb <= 25) return <span className="text-green-600 dark:text-green-400 font-semibold">Optimal Form</span>;
  if (tsb > 25) return <span className="text-blue-500 font-semibold">Freshness (Undertraining)</span>;
  if (tsb < -30) return <span className="text-red-600 dark:text-red-400 font-semibold">Overreaching Risk</span>;
  if (tsb < -10) return <span className="text-orange-500 font-semibold">Productive / Fatigued</span>;
  return <span className="text-gray-500">Neutral</span>;
}

export default function FitnessPage() {
  const [sportType, setSportType] = useState<SportType | undefined>(undefined);
  const { data, isLoading } = useTrainingLoad(sportType);

  const hasData = (data?.points ?? []).length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fitness & Fatigue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Performance Management Chart — CTL (fitness) · ATL (fatigue) · TSB (form)
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SPORT_OPTIONS.map(opt => (
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
      ) : !hasData ? (
        <p className="text-center text-gray-400 py-12">No activity data available.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Fitness (CTL)</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data!.currentCtl}</p>
              <p className="text-xs text-gray-400 mt-0.5">42-day avg</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Fatigue (ATL)</p>
              <p className="text-3xl font-bold text-red-500 dark:text-red-400">{data!.currentAtl}</p>
              <p className="text-xs text-gray-400 mt-0.5">7-day avg</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Form (TSB)</p>
              <p className={`text-3xl font-bold ${data!.currentTsb >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                {data!.currentTsb > 0 ? '+' : ''}{data!.currentTsb}
              </p>
              <p className="text-xs text-gray-400 mt-0.5"><FormZone tsb={data!.currentTsb} /></p>
            </div>
          </div>

          {/* CTL + ATL chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Fitness & Fatigue Over Time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data!.points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={d => d.slice(5)}
                  interval={Math.floor(data!.points.length / 8)}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={l => `Date: ${l}`}
                  formatter={(val: number, name: string) => [val.toFixed(1), name === 'ctl' ? 'Fitness (CTL)' : 'Fatigue (ATL)']}
                />
                <Legend formatter={v => v === 'ctl' ? 'Fitness (CTL)' : 'Fatigue (ATL)'} />
                <Line type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="atl" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* TSB chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Form (TSB)</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Positive = fresh · −10 to −30 = productive · below −30 = overreaching risk
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data!.points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={d => d.slice(5)}
                  interval={Math.floor(data!.points.length / 8)}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={l => `Date: ${l}`}
                  formatter={(val: number) => [val.toFixed(1), 'Form (TSB)']}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
                <ReferenceLine y={5} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.5} />
                <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="tsb" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
