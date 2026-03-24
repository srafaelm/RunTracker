import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRunningLevel, useProfile, useVo2max, useVo2maxSnapshots } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { RunningLevelDistance } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, Line, Area } from 'recharts';

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     'bg-[#20201f] text-[#adaaaa]',
  Novice:       'bg-[#81ecff]/10 text-[#81ecff]',
  Intermediate: 'bg-[#cffc00]/10 text-[#cffc00]',
  Advanced:     'bg-yellow-400/10 text-yellow-300',
  Elite:        'bg-[#ff734a]/10 text-[#ff734a]',
  WR:           'bg-red-500/10 text-red-400',
};

function DistanceTable({ dist }: { dist: RunningLevelDistance }) {
  const achievedLevel = dist.standards.reduce<string | null>((best, s) => {
    return s.userMeetsOrBeats ? s.level : best;
  }, null);

  return (
    <div className="bg-[#20201f] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#484847]/20 flex items-center justify-between">
        <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">{dist.distance}</h2>
        {dist.userTimeDisplay ? (
          <div className="flex items-center gap-2">
            <span className="font-label text-[10px] uppercase tracking-widest text-[#767575]">Your PR:</span>
            <span className="font-headline text-sm font-bold text-[#cffc00] tabular-nums">{dist.userTimeDisplay}</span>
            {achievedLevel && (
              <span className={`px-2 py-0.5 font-label text-[10px] uppercase tracking-widest ${LEVEL_COLORS[achievedLevel]}`}>
                {achievedLevel}
              </span>
            )}
          </div>
        ) : (
          <span className="font-label text-[10px] uppercase tracking-widest text-[#767575]">No PR recorded</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {dist.standards.map((s) => (
                <th
                  key={s.level}
                  className="px-4 py-2 font-label text-[10px] uppercase tracking-widest text-[#adaaaa] text-center"
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
                  className={`px-4 py-3 text-center tabular-nums font-headline text-sm font-bold ${
                    s.userMeetsOrBeats
                      ? LEVEL_COLORS[s.level]
                      : 'text-[#adaaaa]'
                  }`}
                >
                  {s.timeDisplay}
                  {s.userMeetsOrBeats && (
                    <span className="block text-[10px] mt-0.5 text-[#cffc00]">&#10003;</span>
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
  Superior:     'bg-red-500/10 text-red-400',
  Excellent:    'bg-[#ff734a]/10 text-[#ff734a]',
  Good:         'bg-[#cffc00]/10 text-[#cffc00]',
  Fair:         'bg-[#81ecff]/10 text-[#81ecff]',
  Poor:         'bg-[#20201f] text-[#adaaaa]',
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
    <div className="bg-[#20201f] p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Estimated VO2max</h2>
        <select
          value={formula}
          onChange={e => handleFormulaChange(e.target.value as Vo2maxFormula)}
          className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-2 py-1 focus:border-[#cffc00] focus:outline-none transition-colors"
        >
          <option value="daniels">Daniels VDOT</option>
          <option value="uth">Uth-Sørensen (HR)</option>
        </select>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        {displayVo2max != null ? (
          <>
            <span className="font-headline text-5xl font-bold text-white tabular-nums">{displayVo2max.toFixed(1)}</span>
            <span className="font-label text-xs text-[#767575]">mL/kg/min</span>
            <span className={`px-2 py-0.5 font-label text-[10px] uppercase tracking-widest ${cls}`}>{displayClassification}</span>
            <span className="font-label text-[10px] text-[#767575]">{displayLevel}</span>
          </>
        ) : (
          <span className="font-label text-xs text-[#767575]">
            {formula === 'uth' ? 'Set Max HR and Resting HR in your profile' : 'No data — log some races or efforts to get an estimate'}
          </span>
        )}
      </div>
      {displayBasedOn && <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mb-3">Based on {displayBasedOn}</p>}
      {formula === 'daniels' && (data.trend.length > 1 || historyData.length > 1) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">
              {chartView === 'monthly' ? 'Monthly trend (last 12 months)' : 'All-time history (per activity)'}
            </p>
            {historyData.length > 0 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setChartView('monthly')}
                  className={`font-label text-[10px] uppercase tracking-widest px-2 py-0.5 transition-colors ${chartView === 'monthly' ? 'bg-[#cffc00] text-[#3b4a00]' : 'text-[#767575] hover:text-white'}`}
                >
                  12M
                </button>
                <button
                  onClick={() => setChartView('history')}
                  className={`font-label text-[10px] uppercase tracking-widest px-2 py-0.5 transition-colors ${chartView === 'history' ? 'bg-[#cffc00] text-[#3b4a00]' : 'text-[#767575] hover:text-white'}`}
                >
                  All
                </button>
              </div>
            )}
          </div>
          {chartView === 'monthly' && data.trend.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={data.trend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="monthLabel" tick={{ fontSize: 9, fill: '#adaaaa' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#adaaaa' }} domain={[20, 75]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#fff' }} formatter={(v: number) => [`${v.toFixed(1)} mL/kg/min`, 'VO2max']} labelFormatter={l => l} />
                <ReferenceArea y1={20} y2={35} fill="#9ca3af" fillOpacity={0.08} />
                <ReferenceArea y1={35} y2={42} fill="#81ecff" fillOpacity={0.08} />
                <ReferenceArea y1={42} y2={50} fill="#cffc00" fillOpacity={0.08} />
                <ReferenceArea y1={50} y2={57} fill="#ff734a" fillOpacity={0.08} />
                <ReferenceArea y1={57} y2={75} fill="#ef4444" fillOpacity={0.08} />
                {data.vo2max != null && <ReferenceLine y={data.vo2max} stroke="#cffc00" strokeDasharray="3 3" />}
                <Bar dataKey="vo2max" fill="#cffc00" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartView === 'history' && historyData.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <ComposedChart data={historyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#adaaaa' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#adaaaa' }} domain={[20, 75]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#fff' }} formatter={(v: number) => [`${v.toFixed(1)} mL/kg/min`, 'VO2max']} labelFormatter={l => l} />
                <ReferenceArea y1={20} y2={35} fill="#9ca3af" fillOpacity={0.08} />
                <ReferenceArea y1={35} y2={42} fill="#81ecff" fillOpacity={0.08} />
                <ReferenceArea y1={42} y2={50} fill="#cffc00" fillOpacity={0.08} />
                <ReferenceArea y1={50} y2={57} fill="#ff734a" fillOpacity={0.08} />
                <ReferenceArea y1={57} y2={75} fill="#ef4444" fillOpacity={0.08} />
                <Area type="monotone" dataKey="value" fill="#cffc00" fillOpacity={0.08} stroke="none" />
                <Line type="monotone" dataKey="value" stroke="#cffc00" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-2">
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
      <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="font-headline text-5xl mb-4">📊</p>
          <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-white mb-2">Birth Year Required</h2>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575] mb-6">
            Set your birth year on your profile to see where your times rank against age-group standards.
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center px-6 py-3 bg-[#cffc00] text-[#3b4a00] font-label font-bold text-xs uppercase tracking-widest hover:bg-[#c2ed00] transition-colors"
          >
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  if (!level?.hasData) {
    return (
      <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white flex items-center justify-center">
        <p className="font-label text-xs uppercase tracking-widest text-[#767575]">No data available.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase">Running Level</h1>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575] mt-2">
            How your PRs compare to age-group standards &middot; {level.userAgeGroup} &middot; {profile.gender === 1 ? 'Male' : profile.gender === 2 ? 'Female' : 'Open'}
          </p>
        </div>
        <Link
          to="/race-predictor"
          className="font-label text-xs uppercase tracking-widest text-[#cffc00] hover:text-white transition-colors"
        >
          Race Predictor &rarr;
        </Link>
      </div>

      <Vo2maxCard />

      {/* Level legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'WR'].map((lvl) => (
          <span key={lvl} className={`px-2 py-1 font-label text-[10px] uppercase tracking-widest ${LEVEL_COLORS[lvl]}`}>
            {lvl}
          </span>
        ))}
        <span className="font-label text-[10px] uppercase tracking-widest text-[#767575] self-center ml-2">&#10003; = your PR meets this standard</span>
      </div>

      <div className="space-y-3">
        {level.distances.map((d) => (
          <DistanceTable key={d.distance} dist={d} />
        ))}
      </div>
    </div>
  );
}
