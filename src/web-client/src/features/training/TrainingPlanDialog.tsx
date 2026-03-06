import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../../api/client';

const WORKOUT_TYPE_LABELS: Record<number, string> = {
  0: 'Easy', 1: 'Tempo', 2: 'Intervals', 3: 'Long', 4: 'Race', 5: 'Rest', 6: 'Cross', 7: 'Strength',
};

interface Props {
  onClose: () => void;
}

export default function TrainingPlanDialog({ onClose }: Props) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plan-templates'],
    queryFn: () => trainingApi.getPlanTemplates().then(r => r.data),
  });

  const qc = useQueryClient();
  const apply = useMutation({
    mutationFn: ({ planId, raceDate, intensity }: { planId: string; raceDate: string; intensity: number }) =>
      trainingApi.applyPlanTemplate(planId, raceDate, intensity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training'] });
      onClose();
    },
  });

  const [selectedPlan, setSelectedPlan] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [intensity, setIntensity] = useState(100); // percent 70–120
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');

  const plan = plans.find(p => p.id === selectedPlan);
  const multiplier = intensity / 100;
  const adjustedTotalKm = plan ? +(plan.totalDistanceMeters * multiplier / 1000).toFixed(1) : 0;
  const avgWeeklyKm = plan ? +(adjustedTotalKm / plan.weeksCount).toFixed(1) : 0;
  const intensityLabel = intensity === 100 ? 'Base' : intensity < 100 ? `${intensity - 100}%` : `+${intensity - 100}%`;
  const intensityColor = intensity < 85 ? 'text-blue-600 dark:text-blue-400' : intensity > 110 ? 'text-orange-500' : 'text-green-600 dark:text-green-400';

  // Compute preview workout dates
  const previewWorkouts = useMemo(() => {
    if (!plan || !raceDate) return [];
    const race = new Date(raceDate + 'T00:00:00');
    return plan.workouts
      .map(w => {
        const d = new Date(race);
        d.setDate(d.getDate() + w.daysFromRace);
        return { ...w, date: d.toISOString().slice(0, 10) };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [plan, raceDate]);

  // Load existing workouts in the preview date range to detect conflicts
  const firstDate = previewWorkouts[0]?.date;
  const lastDate = previewWorkouts[previewWorkouts.length - 1]?.date;
  const { data: existingWorkouts } = useQuery({
    queryKey: ['training', firstDate, lastDate],
    queryFn: () => trainingApi.getList(firstDate!, lastDate!).then(r => r.data),
    enabled: showPreview && !!firstDate && !!lastDate,
  });
  const existingDates = useMemo(
    () => new Set((existingWorkouts ?? []).map(w => w.date)),
    [existingWorkouts]
  );

  function handlePreview() {
    if (!selectedPlan) { setError('Please select a plan.'); return; }
    if (!raceDate) { setError('Please enter a race date.'); return; }
    if (new Date(raceDate) <= new Date()) { setError('Race date must be in the future.'); return; }
    setError('');
    setShowPreview(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Load Training Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading plans…</p>
        ) : !showPreview ? (
          /* Step 1: Select plan + date */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
              <select
                value={selectedPlan}
                onChange={e => { setSelectedPlan(e.target.value); setShowPreview(false); }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Select a plan —</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.weeksCount} weeks)</option>
                ))}
              </select>
              {plan && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Race Date</label>
              <input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={handlePreview} className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
                Preview &amp; Adjust →
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Intensity slider + volume preview */
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{plan?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Race: {raceDate} · {plan?.weeksCount} weeks</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Intensity</label>
                <span className={`text-sm font-semibold tabular-nums ${intensityColor}`}>{intensityLabel}</span>
              </div>
              <input
                type="range" min={70} max={120} step={5} value={intensity}
                onChange={e => setIntensity(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>−30%</span><span>Base</span><span>+20%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{adjustedTotalKm}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total km</p>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{avgWeeklyKm}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg km/week</p>
              </div>
            </div>

            {/* Workout preview list */}
            {previewWorkouts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Workouts ({previewWorkouts.length})</p>
                  {existingDates.size > 0 && (
                    <span className="text-xs text-orange-500">{previewWorkouts.filter(w => existingDates.has(w.date)).length} conflict(s)</span>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  {previewWorkouts.map((w, i) => {
                    const hasConflict = existingDates.has(w.date);
                    return (
                      <div key={i} className={`flex items-center gap-2 px-2 py-1 text-xs ${hasConflict ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                        <span className="text-gray-400 w-20 shrink-0">{w.date}</span>
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{w.title}</span>
                        <span className="text-gray-400 shrink-0">{WORKOUT_TYPE_LABELS[w.workoutType] ?? ''}</span>
                        {w.distanceMeters && <span className="text-gray-400 shrink-0">{((w.distanceMeters * multiplier) / 1000).toFixed(1)}k</span>}
                        {hasConflict && <span className="text-orange-500 shrink-0" title="Existing workout on this date">⚠</span>}
                      </div>
                    );
                  })}
                </div>
                {existingDates.size > 0 && (
                  <p className="text-xs text-orange-500 mt-1">⚠ Conflicts will be added alongside existing workouts.</p>
                )}
              </div>
            )}

            {apply.isError && <p className="text-sm text-red-600 dark:text-red-400">Failed to apply plan. Please try again.</p>}

            <div className="flex gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                ← Back
              </button>
              <button
                onClick={() => apply.mutate({ planId: selectedPlan, raceDate, intensity: multiplier })}
                disabled={apply.isPending}
                className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {apply.isPending ? 'Applying…' : `Apply (${intensityLabel})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
