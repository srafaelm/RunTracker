import { useState } from 'react';
import { usePersonalRecords, useRecentPredictions, useTags } from '../../hooks/useQueries';
import { RecordType } from '../../types';
import { formatDuration, formatDate } from '../../utils/formatters';

// All supported distances
const RACE_DISTANCES: { label: string; meters: number; recordType?: RecordType }[] = [
  { label: '100 m',        meters: 100,   recordType: RecordType.Fastest100m   },
  { label: '400 m',        meters: 400,   recordType: RecordType.Fastest400m   },
  { label: '800 m',        meters: 800,   recordType: RecordType.Fastest800m   },
  { label: '1 km',         meters: 1000,  recordType: RecordType.Fastest1K     },
  { label: '2 km',         meters: 2000,  recordType: RecordType.Fastest2K     },
  { label: '3 km',         meters: 3000,  recordType: RecordType.Fastest3K     },
  { label: '4 km',         meters: 4000,  recordType: RecordType.Fastest4K     },
  { label: '5 km',         meters: 5000,  recordType: RecordType.Fastest5K     },
  { label: '10 km',        meters: 10000, recordType: RecordType.Fastest10K    },
  { label: '15 km',        meters: 15000, recordType: RecordType.Fastest15K    },
  { label: '20 km',        meters: 20000, recordType: RecordType.Fastest20K    },
  { label: 'Half Marathon',meters: 21097, recordType: RecordType.FastestHalf   },
  { label: '30 km',        meters: 30000, recordType: RecordType.Fastest30K    },
  { label: 'Marathon',     meters: 42195, recordType: RecordType.FastestMarathon },
];

// Key target columns shown in the "from records" grid
const GRID_TARGETS: { label: string; meters: number }[] = [
  { label: '1 km',   meters: 1000  },
  { label: '5 km',   meters: 5000  },
  { label: '10 km',  meters: 10000 },
  { label: 'Half',   meters: 21097 },
  { label: 'Marathon', meters: 42195 },
];

/** Riegel formula: T2 = T1 × (D2/D1)^1.06 */
function riegel(t1: number, d1: number, d2: number): number {
  return t1 * Math.pow(d2 / d1, 1.06);
}

function parseDuration(input: string): number | null {
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function paceLabel(seconds: number, distanceM: number): string {
  const secPerKm = seconds / (distanceM / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

const PERIOD_OPTIONS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 60 days', days: 60 },
  { label: 'Last 90 days', days: 90 },
];

export default function RacePredictorPage() {
  const { data: prs } = usePersonalRecords();
  const { data: allTags = [] } = useTags();
  const [periodDays, setPeriodDays] = useState(60);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [useWeighting, setUseWeighting] = useState(false);
  const { data: recentPredictions } = useRecentPredictions(
    periodDays,
    selectedTagIds.length > 0 ? selectedTagIds : undefined,
    useWeighting,
  );

  // --- Manual calculator state ---
  const [selectedDistanceM, setSelectedDistanceM] = useState<number>(5000);
  const [timeInput, setTimeInput] = useState('');
  const [usePersonalRecord, setUsePersonalRecord] = useState(false);

  const selectedDistance = RACE_DISTANCES.find((d) => d.meters === selectedDistanceM);
  const prForDistance = prs?.find((pr) => pr.recordType === selectedDistance?.recordType);

  const inputTimeSec = usePersonalRecord && prForDistance
    ? prForDistance.value
    : parseDuration(timeInput);

  const predictions = inputTimeSec && inputTimeSec > 0
    ? RACE_DISTANCES.map((d) => ({
        ...d,
        predicted: riegel(inputTimeSec, selectedDistanceM, d.meters),
      }))
    : null;

  // --- "From your records" grid ---
  // Only include PRs that match a known race distance
  type PrRow = { pr: NonNullable<typeof prs>[0]; dist: typeof RACE_DISTANCES[0] };
  const prRows = (prs ?? [])
    .map((pr): PrRow | null => {
      const dist = RACE_DISTANCES.find((d) => d.recordType === pr.recordType);
      return dist ? { pr, dist } : null;
    })
    .filter((x): x is PrRow => x !== null)
    .sort((a, b) => a.dist.meters - b.dist.meters);

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white space-y-6">
      <div>
        <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase">Race Predictor</h1>
        <p className="font-label text-xs uppercase tracking-widest text-[#767575] mt-2">
          Predict race times using Riegel's formula
        </p>
      </div>

      {/* ── Section 0: Recent predictions ────────────────────────────────── */}
      <div className="bg-[#20201f] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#484847]/20 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Based on Recent Training</h2>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-0.5">
              Predictions from your best PR achieved in the selected period.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
            {allTags.length > 0 && (
              <div className="relative">
                <select
                  multiple
                  value={selectedTagIds}
                  onChange={(e) => {
                    const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setSelectedTagIds(vals);
                  }}
                  className="bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors max-h-24"
                  size={Math.min(allTags.length, 4)}
                >
                  {allTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTagIds.length > 0 && (
                  <button
                    onClick={() => setSelectedTagIds([])}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ff734a] text-white font-label text-xs flex items-center justify-center hover:bg-red-500"
                    title="Clear tag filter"
                  >×</button>
                )}
              </div>
            )}
            <label className="flex items-center gap-1.5 font-label text-xs text-[#adaaaa] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useWeighting}
                onChange={(e) => setUseWeighting(e.target.checked)}
                className="border-[#484847] text-[#cffc00] focus:ring-[#cffc00]"
              />
              Smart weighting
            </label>
          </div>
        </div>
        {recentPredictions?.basedOn ? (
          <>
            <div className="px-6 pt-4 pb-2">
              <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">
                Based on your <span className="text-[#cffc00] font-bold">{recentPredictions.basedOn.distance} in {recentPredictions.basedOn.displayTime}</span>{' '}
                on {formatDate(recentPredictions.basedOn.achievedAt)}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pb-6">
              {recentPredictions.predictedTimes.map((t) => (
                <div key={t.distanceMeters} className="bg-[#131313] border-l-2 border-[#cffc00] p-4 text-center">
                  <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">{t.distance}</p>
                  <p className="font-headline text-2xl font-bold text-white mt-1 tabular-nums">{t.displayTime}</p>
                  <p className="font-label text-[10px] text-[#767575] mt-0.5">{t.pace}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-label text-xs uppercase tracking-widest text-[#767575]">No PRs recorded in the last {periodDays} days. Keep training!</p>
          </div>
        )}
      </div>

      {/* ── Section 1: From your personal records ─────────────────────────── */}
      {prRows.length > 0 && (
        <div className="bg-[#20201f] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#484847]/20">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">From Your Personal Records</h2>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-0.5">
              Each row predicts your race times from that PR. Highlighted cells are your actual recorded times.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa] whitespace-nowrap">
                    Source PR
                  </th>
                  {GRID_TARGETS.map((t) => (
                    <th key={t.meters} className="text-right px-4 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa] whitespace-nowrap">
                      {t.label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa] whitespace-nowrap">
                    Use
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#484847]/10">
                {prRows.map(({ pr, dist }) => (
                  <tr key={pr.recordType} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-headline text-sm font-bold text-white uppercase">{dist.label}</span>
                      <span className="ml-2 font-label text-xs text-[#cffc00] tabular-nums">{pr.displayValue}</span>
                    </td>

                    {/* Predicted columns */}
                    {GRID_TARGETS.map((target) => {
                      const isActual = target.meters === dist.meters;
                      const predicted = riegel(pr.value, dist.meters, target.meters);
                      // Dim predictions that are very far from the source distance (ratio > 20×)
                      const ratio = Math.max(target.meters, dist.meters) / Math.min(target.meters, dist.meters);
                      const isExtrapolated = ratio > 15;

                      return (
                        <td
                          key={target.meters}
                          className={`px-4 py-3 text-right tabular-nums whitespace-nowrap font-label text-sm ${
                            isActual
                              ? 'bg-[#cffc00]/10 text-[#cffc00] font-bold'
                              : isExtrapolated
                              ? 'text-[#484847]'
                              : 'text-[#adaaaa]'
                          }`}
                        >
                          {isActual ? (
                            <span title="Your actual PR">{pr.displayValue}</span>
                          ) : (
                            <span title={paceLabel(predicted, target.meters)}>
                              {formatDuration(Math.round(predicted))}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* "Load into calculator" button */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedDistanceM(dist.meters);
                          setUsePersonalRecord(true);
                          setTimeInput('');
                        }}
                        className="font-label text-[10px] uppercase tracking-widest px-3 py-1.5 bg-[#131313] border border-[#484847] text-[#adaaaa] hover:border-[#cffc00] hover:text-white transition-colors"
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pace legend row */}
          <div className="px-6 py-2 border-t border-[#484847]/10">
            <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">Hover any cell to see the implied pace. Faded cells are distant extrapolations. Highlighted = your actual PR.</p>
          </div>
        </div>
      )}

      {/* ── Section 2: Manual calculator ─────────────────────────────────── */}
      <div>
        <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-white mb-3">Manual Calculator</h2>

        <div className="bg-[#20201f] p-6 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">
                Reference Distance
              </label>
              <select
                value={selectedDistanceM}
                onChange={(e) => {
                  setSelectedDistanceM(Number(e.target.value));
                  setTimeInput('');
                  setUsePersonalRecord(false);
                }}
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
              >
                {RACE_DISTANCES.map((d) => (
                  <option key={d.meters} value={d.meters}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">
                Time (hh:mm:ss or mm:ss)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usePersonalRecord && prForDistance
                    ? formatDuration(Math.round(prForDistance.value))
                    : timeInput}
                  onChange={(e) => { setTimeInput(e.target.value); setUsePersonalRecord(false); }}
                  placeholder="e.g. 25:00"
                  disabled={usePersonalRecord && !!prForDistance}
                  className="flex-1 bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors disabled:opacity-50"
                />
                {prForDistance && (
                  <button
                    onClick={() => setUsePersonalRecord(!usePersonalRecord)}
                    className={`px-3 py-2 font-label text-xs uppercase tracking-widest border transition-colors ${
                      usePersonalRecord
                        ? 'bg-[#cffc00] text-[#3b4a00] border-[#cffc00]'
                        : 'bg-[#20201f] border-[#484847] text-[#adaaaa] hover:border-[#cffc00]'
                    }`}
                    title="Use your personal record"
                  >
                    Use PR
                  </button>
                )}
              </div>
              {prForDistance && (
                <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-1">
                  Your PR: {prForDistance.displayValue}
                </p>
              )}
            </div>
          </div>
        </div>

        {predictions ? (
          <div className="bg-[#20201f] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#484847]/20">
              <h3 className="font-headline text-base font-bold uppercase tracking-tight text-white">Predicted Times</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Distance</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Predicted Time</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Avg Pace</th>
                    <th className="text-right px-6 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">vs Your PR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#484847]/10">
                  {predictions.map((d) => {
                    const isReference = d.meters === selectedDistanceM;
                    const actualPr = prs?.find((pr) => pr.recordType === d.recordType);
                    const diff = actualPr ? d.predicted - actualPr.value : null;
                    return (
                      <tr
                        key={d.meters}
                        className={isReference
                          ? 'bg-[#cffc00]/5'
                          : 'hover:bg-zinc-800/20 transition-colors'}
                      >
                        <td className="px-6 py-3 font-headline text-sm font-bold text-white uppercase tracking-tight">
                          {d.label}
                          {isReference && (
                            <span className="ml-2 font-label text-[10px] uppercase tracking-widest text-[#cffc00]">(reference)</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-label tabular-nums text-[#adaaaa]">
                          {formatDuration(Math.round(d.predicted))}
                        </td>
                        <td className="px-6 py-3 text-right font-label tabular-nums text-[#767575]">
                          {paceLabel(d.predicted, d.meters)}
                        </td>
                        <td className="px-6 py-3 text-right font-label tabular-nums text-xs">
                          {!isReference && diff !== null ? (
                            <span className={diff < 0 ? 'text-[#cffc00]' : 'text-[#ff734a]'}>
                              {diff < 0 ? '▲ ' : '▼ '}{formatDuration(Math.round(Math.abs(diff)))}
                              <span className="text-[#767575] ml-1">
                                {diff < 0 ? 'faster than PR' : 'slower than PR'}
                              </span>
                            </span>
                          ) : actualPr ? (
                            <span className="text-[#767575]">{actualPr.displayValue}</span>
                          ) : (
                            <span className="text-[#484847]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-[#484847]/10">
              <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">Predictions use Riegel's formula. ▲ lime = predicted faster than your PR · ▼ orange = predicted slower than PR.</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#20201f] p-12 text-center">
            <p className="font-label text-xs uppercase tracking-widest text-[#767575]">
              Enter a time above to see your predicted race times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
