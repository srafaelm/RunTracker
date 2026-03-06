import { useState, useEffect } from 'react';
import { AbsenceType } from '../../types';

const ABSENCE_TYPES: { value: AbsenceType; label: string; emoji: string; color: string; activeColor: string }[] = [
  { value: AbsenceType.Sick,     label: 'Sick',     emoji: '🤒', color: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300', activeColor: 'border-red-500 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  { value: AbsenceType.Rest,     label: 'Rest',     emoji: '😴', color: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300', activeColor: 'border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' },
  { value: AbsenceType.Vacation, label: 'Vacation', emoji: '🏖️', color: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300', activeColor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { value: AbsenceType.Injury,   label: 'Injury',   emoji: '🤕', color: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300', activeColor: 'border-orange-500 bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  { value: AbsenceType.Other,    label: 'Other',    emoji: '📌', color: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300', activeColor: 'border-purple-500 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
];

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  if (cur > end) return [];
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

interface Props {
  initialDate?: string; // pre-fill both from and to with this date
  onConfirm: (dates: string[], type: AbsenceType, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function AddAbsenceDialog({ initialDate, onConfirm, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [absenceType, setAbsenceType] = useState<AbsenceType>(AbsenceType.Sick);
  const [fromDate, setFromDate] = useState(initialDate ?? today);
  const [toDate, setToDate] = useState(initialDate ?? today);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Keep toDate >= fromDate
  useEffect(() => {
    if (toDate < fromDate) setToDate(fromDate);
  }, [fromDate]);

  const dates = datesInRange(fromDate, toDate);
  const dayCount = dates.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (dayCount === 0) return;
    setSaving(true);
    try {
      await onConfirm(dates, absenceType, notes);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Absence Days</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">×</button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {ABSENCE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAbsenceType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    absenceType === t.value ? t.activeColor : `${t.color} hover:bg-gray-50 dark:hover:bg-gray-700`
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Day count hint */}
          {dayCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dayCount === 1 ? '1 day selected' : `${dayCount} days selected`}
            </p>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. flu, holiday, knee pain…"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || dayCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : dayCount <= 1 ? 'Add day' : `Add ${dayCount} days`}
          </button>
        </div>
      </div>
    </div>
  );
}
