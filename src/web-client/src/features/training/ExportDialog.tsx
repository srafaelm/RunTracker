import { useState } from 'react';

export type ExportScope = 'month' | 'range' | 'year';
export type ExportFormat = 'vertical' | 'horizontal';

interface ExportDialogProps {
  currentYear: number;
  currentMonth: number; // 0-indexed
  onExport: (from: string, to: string, format: ExportFormat) => Promise<void>;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function ExportDialog({ currentYear, currentMonth, onExport, onClose }: ExportDialogProps) {
  const [scope, setScope] = useState<ExportScope>('month');
  const [format, setFormat] = useState<ExportFormat>('vertical');
  const defaultFrom = `${currentYear}-${pad(currentMonth + 1)}-01`;
  const defaultTo = `${currentYear}-${pad(currentMonth + 1)}-${pad(lastDayOfMonth(currentYear, currentMonth))}`;
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(defaultTo);
  const [exporting, setExporting] = useState(false);

  const getRange = (): [string, string] => {
    if (scope === 'month') {
      return [defaultFrom, defaultTo];
    } else if (scope === 'year') {
      return [`${currentYear}-01-01`, `${currentYear}-12-31`];
    } else {
      return [rangeFrom, rangeTo];
    }
  };

  const handleExport = async () => {
    const [from, to] = getRange();
    setExporting(true);
    try {
      await onExport(from, to, format);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const radioClass = 'flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300';
  const selectedBorder = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
  const normalBorder = 'border-[#484847]/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-[#20201f]-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#484847]/20">
          <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Export Training Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Scope */}
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Scope</p>
            <div className="space-y-2">
              {([
                ['month', `Current month (${currentYear}-${pad(currentMonth + 1)})`],
                ['year', `Full year (${currentYear})`],
                ['range', 'Custom date range'],
              ] as [ExportScope, string][]).map(([val, label]) => (
                <label key={val} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${scope === val ? selectedBorder : normalBorder}`}>
                  <input
                    type="radio"
                    name="scope"
                    value={val}
                    checked={scope === val}
                    onChange={() => setScope(val)}
                    className="accent-primary-600"
                  />
                  <span className={radioClass.split(' ').slice(2).join(' ')}>{label}</span>
                </label>
              ))}
            </div>

            {scope === 'range' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1">From</label>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-full rounded-md border border-[#484847]/30 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1">To</label>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-full rounded-md border border-[#484847]/30 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Format */}
          <div>
            <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-2">Format</p>
            <div className="space-y-2">
              {([
                ['vertical', 'Vertical — one workout per row', 'Best for importing or viewing in spreadsheets'],
                ['horizontal', 'Horizontal — week grid (Mon–Sun)', 'Best for printing or sharing as a weekly plan'],
              ] as [ExportFormat, string, string][]).map(([val, label, desc]) => (
                <label key={val} className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${format === val ? selectedBorder : normalBorder}`}>
                  <input
                    type="radio"
                    name="format"
                    value={val}
                    checked={format === val}
                    onChange={() => setFormat(val)}
                    className="accent-primary-600 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#484847]/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-[#484847]/30 rounded-md hover:bg-[#20201f] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-[#3b4a00] bg-[#cffc00] hover:bg-[#c2ed00] rounded-md disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}


