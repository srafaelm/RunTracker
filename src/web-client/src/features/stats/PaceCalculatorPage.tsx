import { useState } from 'react';

const DISTANCES: { label: string; km: number; highlight?: boolean }[] = [
  { label: '1 km', km: 1 },
  { label: '2 km', km: 2 },
  { label: '3 km', km: 3 },
  { label: '4 km', km: 4 },
  { label: '5k', km: 5, highlight: true },
  { label: '6 km', km: 6 },
  { label: '7 km', km: 7 },
  { label: '8 km', km: 8 },
  { label: '9 km', km: 9 },
  { label: '10k', km: 10, highlight: true },
  { label: '11 km', km: 11 },
  { label: '12 km', km: 12 },
  { label: '13 km', km: 13 },
  { label: '14 km', km: 14 },
  { label: '15 km', km: 15 },
  { label: '16 km', km: 16 },
  { label: '17 km', km: 17 },
  { label: '18 km', km: 18 },
  { label: '19 km', km: 19 },
  { label: '20 km', km: 20 },
  { label: '21 km', km: 21 },
  { label: '½ Marathon', km: 21.0975, highlight: true },
  { label: '22 km', km: 22 },
  { label: '23 km', km: 23 },
  { label: '24 km', km: 24 },
  { label: '25 km', km: 25 },
  { label: '26 km', km: 26 },
  { label: '27 km', km: 27 },
  { label: '28 km', km: 28 },
  { label: '29 km', km: 29 },
  { label: '30 km', km: 30 },
  { label: '31 km', km: 31 },
  { label: '32 km', km: 32 },
  { label: '33 km', km: 33 },
  { label: '34 km', km: 34 },
  { label: '35 km', km: 35 },
  { label: '36 km', km: 36 },
  { label: '37 km', km: 37 },
  { label: '38 km', km: 38 },
  { label: '39 km', km: 39 },
  { label: '40 km', km: 40 },
  { label: '41 km', km: 41 },
  { label: '42 km', km: 42 },
  { label: 'Marathon', km: 42.195, highlight: true },
];

const PACE_OFFSETS = [-10, -5, 0, 5, 10];
const CENTER = 2;

function formatPaceLabel(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function formatTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PaceCalculatorPage() {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);

  const paceSeconds = minutes * 60 + seconds;
  const paces = PACE_OFFSETS.map((o) => paceSeconds + o);

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase mb-1">Pace Calculator</h1>
      <p className="font-label text-xs uppercase tracking-widest text-[#767575] mb-8">
        Estimated finish times based on your expected pace.
      </p>

      <div className="flex gap-6 items-start">
        {/* Pace input — sticky sidebar */}
        <div className="shrink-0 sticky top-4">
          <div className="bg-[#20201f] border-l-2 border-[#cffc00] p-5">
            <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Expected Pace</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Minutes</label>
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value))}
                  className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-2 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Seconds</label>
                <select
                  value={seconds}
                  onChange={(e) => setSeconds(parseInt(e.target.value))}
                  className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-2 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
                >
                  {Array.from({ length: 61 }, (_, i) => i).map((s) => (
                    <option key={s} value={s}>{s} sec</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-4 font-headline text-2xl font-bold text-[#cffc00]">
              {formatPaceLabel(paceSeconds)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-[#20201f] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#484847]/20">
                  <th className="text-left px-3 py-3 font-label text-[10px] uppercase tracking-widest text-[#adaaaa]">Distance</th>
                  {paces.map((p, i) => (
                    <th
                      key={p}
                      className={`px-3 py-3 text-right font-label text-[10px] uppercase tracking-widest whitespace-nowrap ${
                        i === CENTER
                          ? 'text-[#cffc00] bg-[#cffc00]/5'
                          : 'text-[#adaaaa]'
                      }`}
                    >
                      {formatPaceLabel(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTANCES.map((d) => (
                  <tr
                    key={d.label}
                    className={`border-b border-[#484847]/10 ${
                      d.highlight
                        ? 'bg-[#cffc00]/5'
                        : 'hover:bg-zinc-800/20 transition-colors'
                    }`}
                  >
                    <td className={`px-3 py-1.5 font-label text-xs ${d.highlight ? 'font-bold text-[#cffc00] uppercase tracking-widest' : 'text-[#adaaaa]'}`}>
                      {d.label}
                    </td>
                    {paces.map((p, i) => (
                      <td
                        key={p}
                        className={`px-3 py-1.5 text-right tabular-nums font-label text-xs ${
                          i === CENTER
                            ? 'font-bold text-[#cffc00] bg-[#cffc00]/5'
                            : 'text-[#767575]'
                        }`}
                      >
                        {formatTime(p * d.km)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
