import type { CreateWorkoutData, ScheduledWorkout } from '../../types';

interface ImportPreviewDialogProps {
  parsed: CreateWorkoutData[];
  existingWorkouts: ScheduledWorkout[];
  onConfirm: (toImport: CreateWorkoutData[]) => Promise<void>;
  onClose: () => void;
}

export default function ImportPreviewDialog({
  parsed,
  existingWorkouts,
  onConfirm,
  onClose,
}: ImportPreviewDialogProps) {
  // Build a set of dates that already have workouts
  const existingDates = new Set(existingWorkouts.map((w) => w.date));

  // Annotate each parsed row with duplicate status
  const rows = parsed.map((w) => ({
    workout: w,
    isDuplicate: existingDates.has(w.date),
  }));

  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const newCount = rows.length - duplicateCount;

  const handleConfirmAll = () => onConfirm(parsed);
  const handleConfirmNew = () => onConfirm(rows.filter((r) => !r.isDuplicate).map((r) => r.workout));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Preview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Found <span className="font-semibold">{parsed.length}</span> workouts in CSV.
            {duplicateCount > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                {duplicateCount} date{duplicateCount !== 1 ? 's' : ''} already have workouts in this month.
              </span>
            )}
            {duplicateCount === 0 && (
              <span className="ml-1 text-green-600 dark:text-green-400">No duplicates detected.</span>
            )}
          </p>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map(({ workout: w, isDuplicate }, i) => (
                <tr key={i} className={isDuplicate ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 tabular-nums">{w.date}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white max-w-[160px] truncate">{w.title}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{w.workoutType}</td>
                  <td className="px-4 py-2">
                    {isDuplicate ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                        ⚠ Duplicate date
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                        ✓ New
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700 gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {duplicateCount > 0 && newCount > 0 && (
              <button
                onClick={handleConfirmNew}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                Import {newCount} new only
              </button>
            )}
            <button
              onClick={handleConfirmAll}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
            >
              Import all {parsed.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
