import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserTemplates, useCreateUserTemplate, useUpdateUserTemplate, useDeleteUserTemplate, useApplyUserTemplate } from '../../hooks/useQueries';
import { WorkoutType, type UserTrainingTemplate } from '../../types';

const WORKOUT_TYPE_LABELS: Record<number, string> = {
  0: 'Easy', 1: 'Tempo', 2: 'Intervals', 3: 'Long', 4: 'Race', 5: 'Rest', 6: 'Recovery', 7: 'Strength', 8: 'Other',
};

interface WorkoutRow {
  daysFromRace: number;
  title: string;
  workoutType: WorkoutType;
  distanceMeters: string; // string for input
  notes: string;
}

const DEFAULT_WORKOUT: WorkoutRow = {
  daysFromRace: 0,
  title: '',
  workoutType: WorkoutType.Easy,
  distanceMeters: '',
  notes: '',
};

interface TemplateBuilderProps {
  initial?: UserTrainingTemplate | null;
  onSave: (name: string, description: string, workouts: WorkoutRow[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function TemplateBuilder({ initial, onSave, onCancel, isSaving }: TemplateBuilderProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [workouts, setWorkouts] = useState<WorkoutRow[]>(
    initial?.workouts.map(w => ({
      daysFromRace: w.daysFromRace,
      title: w.title,
      workoutType: w.workoutType,
      distanceMeters: w.distanceMeters != null ? String(w.distanceMeters / 1000) : '',
      notes: w.notes ?? '',
    })) ?? [{ ...DEFAULT_WORKOUT }]
  );

  function addWorkout() {
    setWorkouts(ws => [...ws, { ...DEFAULT_WORKOUT }]);
  }

  function removeWorkout(i: number) {
    setWorkouts(ws => ws.filter((_, idx) => idx !== i));
  }

  function updateWorkout<K extends keyof WorkoutRow>(i: number, key: K, value: WorkoutRow[K]) {
    setWorkouts(ws => ws.map((w, idx) => idx === i ? { ...w, [key]: value } : w));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim(), workouts);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. My 10K Plan"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Workouts table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Workouts ({workouts.length})</p>
          <button
            onClick={addWorkout}
            className="text-xs px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
          >
            + Add
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
          {workouts.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No workouts yet. Click "+ Add" to get started.</p>
          )}
          {workouts.map((w, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 items-center text-xs">
              <div className="col-span-2">
                <input
                  type="number"
                  value={w.daysFromRace}
                  onChange={e => updateWorkout(i, 'daysFromRace', Number(e.target.value))}
                  title="Days from race (negative = before race)"
                  placeholder="Day"
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1.5 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="col-span-3">
                <input
                  value={w.title}
                  onChange={e => updateWorkout(i, 'title', e.target.value)}
                  placeholder="Title"
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1.5 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={w.workoutType}
                  onChange={e => updateWorkout(i, 'workoutType', Number(e.target.value) as WorkoutType)}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1 py-1 text-xs focus:outline-none"
                >
                  {Object.entries(WORKOUT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={w.distanceMeters}
                  onChange={e => updateWorkout(i, 'distanceMeters', e.target.value)}
                  placeholder="km"
                  step="0.1"
                  min="0"
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1.5 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <button
                  onClick={() => removeWorkout(i)}
                  className="text-red-400 hover:text-red-600 w-full text-center"
                >✕</button>
              </div>
            </div>
          ))}
          {workouts.length > 0 && (
            <p className="text-xs text-gray-400 px-1 pt-1">Columns: day offset, title, type, km</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving…' : (initial ? 'Save Changes' : 'Create Template')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ApplyFormProps {
  templateId: string;
  onDone: () => void;
}

function ApplyForm({ templateId, onDone }: ApplyFormProps) {
  const [raceDate, setRaceDate] = useState('');
  const [intensity, setIntensity] = useState(100);
  const apply = useApplyUserTemplate();
  const qc = useQueryClient();
  const intensityLabel = intensity === 100 ? 'Base' : intensity < 100 ? `${intensity - 100}%` : `+${intensity - 100}%`;

  function handleApply() {
    if (!raceDate) return;
    apply.mutate({ id: templateId, raceDate, intensityMultiplier: intensity / 100 }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['training'] }); onDone(); },
    });
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Race Date</label>
        <input
          type="date"
          value={raceDate}
          onChange={e => setRaceDate(e.target.value)}
          min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Intensity</label>
          <span className="text-xs font-semibold tabular-nums text-green-600">{intensityLabel}</span>
        </div>
        <input
          type="range" min={70} max={120} step={5} value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}
          className="w-full accent-primary-600"
        />
      </div>
      <button
        onClick={handleApply}
        disabled={!raceDate || apply.isPending}
        className="w-full py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
      >
        {apply.isPending ? 'Applying…' : `Apply (${intensityLabel})`}
      </button>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function MyTemplatesDialog({ onClose }: Props) {
  const { data: templates = [], isLoading } = useUserTemplates();
  const createMutation = useCreateUserTemplate();
  const updateMutation = useUpdateUserTemplate();
  const deleteMutation = useDeleteUserTemplate();

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<UserTrainingTemplate | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  function handleSave(name: string, description: string, workouts: WorkoutRow[]) {
    const data = {
      name,
      description: description || null,
      workouts: workouts.map(w => ({
        daysFromRace: w.daysFromRace,
        title: w.title || 'Workout',
        workoutType: w.workoutType,
        distanceMeters: w.distanceMeters ? parseFloat(w.distanceMeters) * 1000 : null,
        notes: w.notes || null,
      })),
    };

    if (mode === 'edit' && editTarget) {
      updateMutation.mutate({ id: editTarget.id, data }, { onSuccess: () => setMode('list') });
    } else {
      createMutation.mutate(data, { onSuccess: () => setMode('list') });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === 'list' ? 'My Templates' : mode === 'create' ? 'New Template' : 'Edit Template'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
        </div>

        {mode === 'list' && (
          <>
            <button
              onClick={() => { setEditTarget(null); setMode('create'); }}
              className="w-full mb-3 py-2 rounded-lg border-2 border-dashed border-primary-400 text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              + New Template
            </button>

            {isLoading && <p className="text-sm text-gray-500 text-center py-4">Loading…</p>}

            {!isLoading && templates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No templates yet. Create one to get started.</p>
            )}

            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{t.workouts.length} workout{t.workouts.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => setApplyingId(applyingId === t.id ? null : t.id)}
                        className="text-xs px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => { setEditTarget(t); setMode('edit'); }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id); }}
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {applyingId === t.id && (
                    <ApplyForm templateId={t.id} onDone={() => setApplyingId(null)} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <TemplateBuilder
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
