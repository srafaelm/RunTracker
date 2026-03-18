import { useState, useEffect } from 'react';
import { activitiesApi } from '../../api/client';

const FIELD_GROUPS = [
  {
    label: 'Basic',
    fields: [
      { id: 'date', label: 'Date' },
      { id: 'name', label: 'Name' },
      { id: 'type', label: 'Sport Type' },
      { id: 'distance', label: 'Distance' },
      { id: 'duration', label: 'Duration' },
      { id: 'elevation', label: 'Elevation' },
    ],
  },
  {
    label: 'Performance',
    fields: [
      { id: 'pace', label: 'Pace' },
      { id: 'cadence', label: 'Cadence' },
      { id: 'calories', label: 'Calories' },
    ],
  },
  {
    label: 'Heart Rate',
    fields: [
      { id: 'avghr', label: 'Avg Heart Rate' },
      { id: 'maxhr', label: 'Max Heart Rate' },
      { id: 'hrzones', label: 'HR Zone Time' },
    ],
  },
  {
    label: 'Tags & Gear',
    fields: [
      { id: 'tags', label: 'Tags' },
      { id: 'gear', label: 'Gear' },
    ],
  },
];

const DEFAULT_FIELDS = ['date', 'name', 'type', 'distance', 'duration', 'pace', 'elevation'];
const STORAGE_KEY = 'activities_export_fields';

function loadSavedFields(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as string[];
  } catch {}
  return DEFAULT_FIELDS;
}

interface Props {
  from?: string;
  to?: string;
  onClose: () => void;
}

export default function ActivityExportDialog({ from, to, onClose }: Props) {
  const [selectedFields, setSelectedFields] = useState<string[]>(loadSavedFields);
  const [count, setCount] = useState(1000);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedFields));
  }, [selectedFields]);

  function toggleField(id: string) {
    setSelectedFields((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  async function handleExport() {
    if (selectedFields.length === 0) {
      setError('Select at least one field.');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const response = await activitiesApi.exportCsv({ count, fields: selectedFields, from, to });
      const url = window.URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activities-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Activities</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4 mb-5">
          {FIELD_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">{group.label}</p>
              <div className="grid grid-cols-2 gap-1">
                {group.fields.map((field) => (
                  <label key={field.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Max rows:</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 text-sm focus:outline-none"
          >
            {[100, 500, 1000, 5000].map((n) => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
          {(from || to) && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {from && to ? `${from} – ${to}` : from ? `from ${from}` : `to ${to}`}
            </span>
          )}
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedFields.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
