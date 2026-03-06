import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRunningLevel, useProfile, useVo2max, useVo2maxSnapshots } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { RunningLevelDistance } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, Line, Area } from 'recharts';

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  Novice:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  Intermediate: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  Advanced:     'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  Elite:        'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  WR:           'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
};

function DistanceTable({ dist }: { dist: RunningLevelDistance }) {
  // Find the user's level (highest standard they meet or beat)
  const achievedLevel = dist.standards.reduce<string | null>((best, s) => {
    return s.userMeetsOrBeats ? s.level : best;
  }, null);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">{dist.distance}</h2>
        {dist.userTimeDisplay ? (
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Your PR: </span>
            <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{dist.userTimeDisplay}</span>
            {achievedLevel && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[achievedLevel]}`}>
                {achievedLevel}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">No PR recorded</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {dist.standards.map((s) => (
                <th
                  key={s.level}
                  className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center"
                >
                  {s.level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {dist.standards.map((s) => (
                <td
                  key={s.level}
                  className={`px-4 py-3 text-center tabular-nums font-medium ${
                    s.userMeetsOrBeats
                      ? LEVEL_COLORS[s.level]
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {s.timeDisplay}
                  {s.userMeetsOrBeats && (
                    <span className="block text-xs mt-0.5">✓</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const VO2MAX_CLASSIFICATIONS: Record<string, string> = {
  Superior:     'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  Excellent:    'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  Good:         'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  Fair:         'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  Poor:         'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

type Vo2maxFormula = 'daniels' | 'uth';

function classifyVo2max(v: number): { classification: string; level: string } {
  if (v >= 57) return { classification: 'Superior', level: 'Elite' };
  if (v >= 50) return { classification: 'Excellent', level: 'Advanced' };
  if (v >= 42) return { classification: 'Good', level: 'Intermediate' };
  if (v >= 35) return { classification: 'Fair', level: 'Novice' };
  return { classification: 'Poor', level: 'Beginner' };
}

function Vo2maxCard() {
  const { data } = useVo2max();
  const { data: snapshots = [] } = useVo2maxSnapshots();
  const { data: profile } = useProfile();
  const [formula, setFormula] = useState<Vo2maxFormula>(
    () => (localStorage.getItem('vo2maxFormula') as Vo2maxFormula | null) ?? 'daniels'
  );
  const [chartView, setChartView] = useState<'monthly' | 'history'>('monthly');

  if (!data) return null;

  // Group snapshots by month for the history line chart
  const snapshotsByMonth = new Map<string, number>();
  for (const s of snapshots) {
    const month = s.date.slice(0, 7);
    const cur = snapshotsByMonth.get(month) ?? 0;
    if (s.value > cur) snapshotsByMonth.set(month, s.value);
  }
  const historyData = Array.from(snapshotsByMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));

  function handleFormulaChange(f: Vo2maxFormula) {
    setFormula(f);
    localStorage.setItem('vo2maxFormula', f);
  }

  // Uth-Sørensen: VO2max ≈ 15 × (MaxHR / RestingHR)
  const uthVo2max = (profile?.maxHeartRate && profile?.restingHeartRate)
    ? +(15 * profile.maxHeartRate / profile.restingHeartRate).toFixed(1)
    : null;

  const displayVo2max = formula === 'uth' ? uthVo2max : data.vo2max;
  const displayClassification = formula === 'uth' && uthVo2max != null
    ? classifyVo2max(uthVo2max).classification
    : data.classification;
  const displayLevel = formula === 'uth' && uthVo2max != null
    ? classifyVo2max(uthVo2max).level
    : data.level;
  const displayBasedOn = formula === 'uth'
    ? (uthVo2max != null ? `Heart rate ratio (MaxHR ${profile?.maxHeartRate} / RestHR ${profile?.restingHeartRate})` : null)
    : data.basedOn;

  const cls = VO2MAX_CLASSIFICATIONS[displayClassification] ?? VO2MAX_CLASSIFICATIONS.Poor;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Estimated VO2max</h2>
        <select
          value={formula}
          onChange={e => handleFormulaChange(e.target.value as Vo2maxFormula)}
          className="text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 focus:outline-none"
        >
          <option value="daniels">Daniels VDOT</option>
          <option value="uth">Uth-Sørensen (HR)</option>
        </select>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        {displayVo2max != null ? (
          <>
            <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{displayVo2max.toFixed(1)}</span>
            <span className="text-sm text-gray-500">mL/kg/min</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{displayClassification}</span>
            <span className="text-xs text-gray-400 ml-1">({displayLevel})</span>
          </>
        ) : (
          <span className="text-sm text-gray-400">
            {formula === 'uth' ? 'Set Max HR and Resting HR in your profile' : 'No data — log some races or efforts to get an estimate'}
          </span>
        )}
      </div>
      {displayBasedOn && <p className="text-xs text-gray-400 mb-3">Based on {displayBasedOn}</p>}
      {formula === 'daniels' && (data.trend.length > 1 || historyData.length > 1) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {chartView === 'monthly' ? 'Monthly trend (last 12 months)' : 'All-time history (per activity)'}
            </p>
            {historyData.length > 0 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setChartView('monthly')}
                  className={`text-xs px-2 py-0.5 rounded ${chartView === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  12M
                </button>
                <button
                  onClick={() => setChartView('history')}
                  className={`text-xs px-2 py-0.5 rounded ${chartView === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  All
                </button>
              </div>
            )}
          </div>
          {chartView === 'monthly' && data.trend.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.trend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 9 }} domain={[20, 75]} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} mL/kg/min`, 'VO2max']} labelFormatter={l => l} />
                <ReferenceArea y1={20} y2={35} fill="#9ca3af" fillOpacity={0.15} label={{ value: 'Poor', position: 'insideLeft', fontSize: 8, fill: '#9ca3af' }} />
                <ReferenceArea y1={35} y2={42} fill="#3b82f6" fillOpacity={0.15} label={{ value: 'Fair', position: 'insideLeft', fontSize: 8, fill: '#3b82f6' }} />
                <ReferenceArea y1={42} y2={50} fill="#22c55e" fillOpacity={0.15} label={{ value: 'Good', position: 'insideLeft', fontSize: 8, fill: '#22c55e' }} />
                <ReferenceArea y1={50} y2={57} fill="#f97316" fillOpacity={0.15} label={{ value: 'Excellent', position: 'insideLeft', fontSize: 8, fill: '#f97316' }} />
                <ReferenceArea y1={57} y2={75} fill="#ef4444" fillOpacity={0.15} label={{ value: 'Superior', position: 'insideLeft', fontSize: 8, fill: '#ef4444' }} />
                {data.vo2max != null && <ReferenceLine y={data.vo2max} stroke="#6366f1" strokeDasharray="3 3" />}
                <Bar dataKey="vo2max" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartView === 'history' && historyData.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <ComposedChart data={historyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 9 }} domain={[20, 75]} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} mL/kg/min`, 'VO2max']} labelFormatter={l => l} />
                <ReferenceArea y1={20} y2={35} fill="#9ca3af" fillOpacity={0.15} />
                <ReferenceArea y1={35} y2={42} fill="#3b82f6" fillOpacity={0.15} />
                <ReferenceArea y1={42} y2={50} fill="#22c55e" fillOpacity={0.15} />
                <ReferenceArea y1={50} y2={57} fill="#f97316" fillOpacity={0.15} />
                <ReferenceArea y1={57} y2={75} fill="#ef4444" fillOpacity={0.15} />
                <Area type="monotone" dataKey="value" fill="#6366f1" fillOpacity={0.1} stroke="none" />
                <Line type="monotone" dataKey="value" stroke="#6366f1" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-2">
        {formula === 'daniels'
          ? "Estimated using Jack Daniels' VDOT formula from your PRs and recent runs."
          : 'Uth-Sørensen: 15 × (MaxHR / RestingHR). Set both values in your Profile.'}
      </p>
    </div>
  );
}

export default function RunningLevelPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: level, isLoading } = useRunningLevel();

  if (profileLoading || isLoading) return <LoadingSpinner size="lg" />;

  if (!profile?.birthYear) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-4">📊</p>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Birth Year Required</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Set your birth year on your profile to see where your times rank against age-group standards.
        </p>
        <Link
          to="/profile"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Go to Profile
        </Link>
      </div>
    );
  }

  if (!level?.hasData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">No data available.</p>
      </div>
    );
  }

  const age = new Date().getFullYear() - profile.birthYear;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Running Level</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            How your PRs compare to age-group standards · {level.userAgeGroup} · {profile.gender === 1 ? 'Male' : profile.gender === 2 ? 'Female' : 'Open'}
          </p>
        </div>
        <Link
          to="/race-predictor"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Race Predictor →
        </Link>
      </div>

      <Vo2maxCard />

      {/* Level legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'WR'].map((lvl) => (
          <span key={lvl} className={`px-2 py-1 rounded text-xs font-medium ${LEVEL_COLORS[lvl]}`}>
            {lvl}
          </span>
        ))}
        <span className="text-xs text-gray-400 dark:text-gray-500 self-center ml-2">✓ = your PR meets this standard</span>
      </div>

      <div className="space-y-4">
        {level.distances.map((d) => (
          <DistanceTable key={d.distance} dist={d} />
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        Standards are approximate age-group benchmarks. Male 5K data from runninglevel.com; other distances scaled using Riegel's formula.
        {profile.gender !== 1 && ' Female times adjusted ~12% slower than male standards.'}
        {` Age used: ${age}.`}
      </p>
    </div>
  );
}
