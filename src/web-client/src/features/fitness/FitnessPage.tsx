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
  if (tsb >= 5 && tsb <= 25) return <span className="text-[#cffc00] font-label font-bold text-xs">Optimal Form</span>;
  if (tsb > 25) return <span className="text-[#81ecff] font-label font-bold text-xs">Freshness</span>;
  if (tsb < -30) return <span className="text-[#ff734a] font-label font-bold text-xs">Overreaching Risk</span>;
  if (tsb < -10) return <span className="text-yellow-400 font-label font-bold text-xs">Productive / Fatigued</span>;
  return <span className="text-[#adaaaa] font-label text-xs">Neutral</span>;
}

export default function FitnessPage() {
  const [sportType, setSportType] = useState<SportType | undefined>(undefined);
  const { data, isLoading } = useTrainingLoad(sportType);

  const hasData = (data?.points ?? []).length > 0;

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase">Fitness &amp; Fatigue</h1>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575] mt-2">
            Performance Management Chart &mdash; CTL &middot; ATL &middot; TSB
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SPORT_OPTIONS.map(opt => (
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
      ) : !hasData ? (
        <p className="text-center font-label text-xs uppercase tracking-widest text-[#767575] py-20">No activity data available.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#20201f] border-l-2 border-[#81ecff] p-6 text-center">
              <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Fitness (CTL)</p>
              <p className="font-headline text-5xl font-bold text-[#81ecff]">{data!.currentCtl}</p>
              <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-2">42-day avg</p>
            </div>
            <div className="bg-[#20201f] border-l-2 border-[#ff734a] p-6 text-center">
              <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Fatigue (ATL)</p>
              <p className="font-headline text-5xl font-bold text-[#ff734a]">{data!.currentAtl}</p>
              <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-2">7-day avg</p>
            </div>
            <div className="bg-[#20201f] border-l-2 border-[#cffc00] p-6 text-center">
              <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Form (TSB)</p>
              <p className={`font-headline text-5xl font-bold ${data!.currentTsb >= 0 ? 'text-[#cffc00]' : 'text-[#ff734a]'}`}>
                {data!.currentTsb > 0 ? '+' : ''}{data!.currentTsb}
              </p>
              <p className="mt-2"><FormZone tsb={data!.currentTsb} /></p>
            </div>
          </div>

          {/* CTL + ATL chart */}
          <div className="bg-[#20201f] p-6 mb-4">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Fitness &amp; Fatigue Over Time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data!.points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#adaaaa' }}
                  tickFormatter={d => d.slice(5)}
                  interval={Math.floor(data!.points.length / 8)}
                  axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }}
                  labelStyle={{ color: '#adaaaa' }}
                  itemStyle={{ color: '#fff' }}
                  labelFormatter={l => `Date: ${l}`}
                  formatter={(val: number, name: string) => [val.toFixed(1), name === 'ctl' ? 'Fitness (CTL)' : 'Fatigue (ATL)']}
                />
                <Legend formatter={v => v === 'ctl' ? 'Fitness (CTL)' : 'Fatigue (ATL)'} wrapperStyle={{ fontSize: 10, color: '#adaaaa' }} />
                <Line type="monotone" dataKey="ctl" stroke="#81ecff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="atl" stroke="#ff734a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* TSB chart */}
          <div className="bg-[#20201f] p-6">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-1">Form (TSB)</h2>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mb-4">
              Positive = fresh &middot; -10 to -30 = productive &middot; below -30 = overreaching risk
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data!.points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#484847" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#adaaaa' }}
                  tickFormatter={d => d.slice(5)}
                  interval={Math.floor(data!.points.length / 8)}
                  axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#adaaaa' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }}
                  labelStyle={{ color: '#adaaaa' }}
                  itemStyle={{ color: '#fff' }}
                  labelFormatter={l => `Date: ${l}`}
                  formatter={(val: number) => [val.toFixed(1), 'Form (TSB)']}
                />
                <ReferenceLine y={0} stroke="#484847" strokeDasharray="4 2" />
                <ReferenceLine y={5} stroke="#cffc00" strokeDasharray="4 2" strokeOpacity={0.4} />
                <ReferenceLine y={-30} stroke="#ff734a" strokeDasharray="4 2" strokeOpacity={0.4} />
                <Line type="monotone" dataKey="tsb" stroke="#cffc00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
