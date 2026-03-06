import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import ActivityPreviewDialog from './ActivityPreviewDialog';
import ExportDialog, { type ExportFormat } from './ExportDialog';
import ImportPreviewDialog from './ImportPreviewDialog';
import AddAbsenceDialog from './AddAbsenceDialog';
import TrainingPlanDialog from './TrainingPlanDialog';
import MyTemplatesDialog from './MyTemplatesDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useActivities, useScheduledWorkouts, useWorkoutComparison, useWorkoutComparisons, useAbsenceDays } from '../../hooks/useQueries';
import { trainingApi, activitiesApi, absenceApi } from '../../api/client';
import { WorkoutType, AbsenceType, SportType, type ActivitySummary, type ScheduledWorkout, type CreateWorkoutData, type WorkoutComparison, type AbsenceDay } from '../../types';
import { formatDistance, formatDate } from '../../utils/formatters';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';

// ── Absence type config ────────────────────────────────────────────────────────

const ABSENCE_TYPES: { value: AbsenceType; label: string; emoji: string; color: string }[] = [
  { value: AbsenceType.Sick,     label: 'Sick',     emoji: '🤒', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
  { value: AbsenceType.Rest,     label: 'Rest',     emoji: '😴', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600' },
  { value: AbsenceType.Vacation, label: 'Vacation', emoji: '🏖️', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
  { value: AbsenceType.Injury,   label: 'Injury',   emoji: '🤕', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' },
  { value: AbsenceType.Other,    label: 'Other',    emoji: '📌', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' },
];

function absenceTypeConfig(type: AbsenceType) {
  return ABSENCE_TYPES.find((t) => t.value === type) ?? ABSENCE_TYPES[ABSENCE_TYPES.length - 1];
}

// ── Workout type config ────────────────────────────────────────────────────────

const WORKOUT_TYPES: { value: WorkoutType; label: string; classes: string }[] = [
  { value: WorkoutType.Easy,      label: 'Easy',      classes: 'bg-green-100 text-green-800 border-green-300' },
  { value: WorkoutType.Tempo,     label: 'Tempo',     classes: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: WorkoutType.Long,      label: 'Long',      classes: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: WorkoutType.Intervals, label: 'Intervals', classes: 'bg-red-100 text-red-800 border-red-300' },
  { value: WorkoutType.Recovery,  label: 'Recovery',  classes: 'bg-teal-100 text-teal-800 border-teal-300' },
  { value: WorkoutType.Rest,      label: 'Rest',      classes: 'bg-gray-100 text-gray-600 border-gray-300' },
  { value: WorkoutType.Race,      label: 'Race',      classes: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: WorkoutType.Other,     label: 'Other',     classes: 'bg-gray-100 text-gray-500 border-gray-200' },
];

function workoutTypeConfig(type: WorkoutType) {
  return WORKOUT_TYPES.find((t) => t.value === type) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
}

// ── Sport type config ──────────────────────────────────────────────────────────

const SPORT_TYPES: { value: SportType; label: string; emoji: string }[] = [
  { value: SportType.Run,            label: 'Run',        emoji: '🏃' },
  { value: SportType.TrailRun,       label: 'Trail Run',  emoji: '🏔️' },
  { value: SportType.Ride,           label: 'Cycle',      emoji: '🚴' },
  { value: SportType.Swim,           label: 'Swim',       emoji: '🏊' },
  { value: SportType.Walk,           label: 'Walk',       emoji: '🚶' },
  { value: SportType.Hike,           label: 'Hike',       emoji: '⛰️' },
  { value: SportType.WeightTraining, label: 'Strength',   emoji: '🏋️' },
  { value: SportType.Other,          label: 'Other',      emoji: '💪' },
];

function sportTypeEmoji(type?: SportType): string {
  return SPORT_TYPES.find((s) => s.value === type)?.emoji ?? '🏃';
}

// ── Duration / pace helpers ────────────────────────────────────────────────────

function secondsToHhmm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function hhmmToSeconds(value: string): number | undefined {
  const parts = value.split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 3600 + m * 60;
  }
  return undefined;
}

/** "5:30" → 330 */
function mmssToSeconds(value: string): number | undefined {
  const parts = value.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  return undefined;
}

/** 330 → "5:30" */
function secondsToMmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDistKm(m: number | null | undefined): string {
  if (m == null) return '—';
  return (m / 1000).toFixed(2) + ' km';
}

function formatDurHhmm(sec: number | null | undefined): string {
  if (sec == null) return '—';
  return secondsToHhmm(sec);
}

function formatPaceMmss(secPerKm: number | null | undefined): string {
  if (secPerKm == null) return '—';
  return secondsToMmss(secPerKm) + ' /km';
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseTrainingCsv(text: string): CreateWorkoutData[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const nameToType: Record<string, WorkoutType> = {
    easy: WorkoutType.Easy, tempo: WorkoutType.Tempo, long: WorkoutType.Long,
    intervals: WorkoutType.Intervals, recovery: WorkoutType.Recovery, rest: WorkoutType.Rest,
    race: WorkoutType.Race, strength: WorkoutType.Strength, other: WorkoutType.Other,
  };

  return lines.slice(1).flatMap((line) => {
    const cols = parseCsvLine(line);
    if (cols.length < 3) return [];
    const [date, title, typeName, distKmStr, durationStr, notes] = cols;
    const workoutType = nameToType[typeName.toLowerCase()] ?? WorkoutType.Other;
    const plannedDistanceMeters = distKmStr ? parseFloat(distKmStr) * 1000 : undefined;
    const plannedDurationSeconds = durationStr ? hhmmToSeconds(durationStr) : undefined;
    return [{ date, title, workoutType, notes: notes || undefined, plannedDistanceMeters, plannedDurationSeconds }];
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Calendar helpers ───────────────────────────────────────────────────────────

function calendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Comparison panel ───────────────────────────────────────────────────────────

function ComparisonPanel({ workoutId }: { workoutId: string }) {
  const { data: cmp, isLoading } = useWorkoutComparison(workoutId);

  if (isLoading) return <p className="text-xs text-gray-400 py-2">Loading comparison…</p>;
  if (!cmp) return null;

  const hasActivity = !!cmp.activityId;

  const rows: { label: string; planned: string; actual: string; good?: boolean | null }[] = [];
  if (cmp.plannedDistanceM != null || cmp.actualDistanceM != null) {
    const good = cmp.actualDistanceM != null && cmp.plannedDistanceM != null
      ? cmp.actualDistanceM >= cmp.plannedDistanceM * 0.95
      : null;
    rows.push({ label: 'Distance', planned: formatDistKm(cmp.plannedDistanceM), actual: formatDistKm(cmp.actualDistanceM), good });
  }
  if (cmp.plannedDurationSec != null || cmp.actualDurationSec != null) {
    const good = cmp.actualDurationSec != null && cmp.plannedDurationSec != null
      ? cmp.actualDurationSec >= cmp.plannedDurationSec * 0.9
      : null;
    rows.push({ label: 'Duration', planned: formatDurHhmm(cmp.plannedDurationSec), actual: formatDurHhmm(cmp.actualDurationSec), good });
  }
  if (cmp.plannedPaceSecPerKm != null || cmp.actualPaceSecPerKm != null) {
    // For pace: lower = better, so actual <= planned * 1.05 is good
    const good = cmp.actualPaceSecPerKm != null && cmp.plannedPaceSecPerKm != null
      ? cmp.actualPaceSecPerKm <= cmp.plannedPaceSecPerKm * 1.05
      : null;
    rows.push({ label: 'Pace', planned: formatPaceMmss(cmp.plannedPaceSecPerKm), actual: formatPaceMmss(cmp.actualPaceSecPerKm), good });
  }
  if (cmp.plannedHrZone != null || cmp.actualHrZone != null) {
    const good = cmp.actualHrZone != null && cmp.plannedHrZone != null
      ? Math.abs(cmp.actualHrZone - cmp.plannedHrZone) <= 1
      : null;
    const actualHrLabel = cmp.actualHrZone
      ? `Zone ${cmp.actualHrZone}${cmp.actualAvgHr ? ` (${Math.round(cmp.actualAvgHr)} bpm)` : ''}`
      : '—';
    rows.push({ label: 'HR Zone', planned: cmp.plannedHrZone ? `Zone ${cmp.plannedHrZone}` : '—', actual: actualHrLabel, good });
  }

  if (rows.length === 0 && !hasActivity) {
    return (
      <p className="text-xs text-gray-400 py-1">No planned targets set and no run found on this date.</p>
    );
  }

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          vs Actual {hasActivity ? `· ${cmp.activityName}` : ''}
        </p>
        {hasActivity && (
          <Link
            to={`/activities/${cmp.activityId}`}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            View activity →
          </Link>
        )}
      </div>
      {!hasActivity ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No run activity found on this date.</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Add planned targets above to compare.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 dark:text-gray-500">
              <th className="text-left pb-1 font-medium"></th>
              <th className="text-right pb-1 font-medium">Planned</th>
              <th className="text-right pb-1 font-medium">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-1 text-gray-600 dark:text-gray-400">{r.label}</td>
                <td className="py-1 text-right text-gray-500 dark:text-gray-400">{r.planned}</td>
                <td className={`py-1 text-right font-medium ${
                  r.good === true ? 'text-green-600 dark:text-green-400' : r.good === false ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {r.actual}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Workout Modal ──────────────────────────────────────────────────────────────

interface ModalState {
  mode: 'create' | 'edit';
  workout?: ScheduledWorkout;
  initialDate?: string;
}

interface WorkoutModalProps {
  modal: ModalState;
  onClose: () => void;
  onSaved: () => void;
}

function WorkoutModal({ modal, onClose, onSaved }: WorkoutModalProps) {
  const existing = modal.workout;
  const [date, setDate] = useState(existing?.date ?? modal.initialDate ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [workoutType, setWorkoutType] = useState<WorkoutType>(existing?.workoutType ?? WorkoutType.Easy);
  const [sportType, setSportType] = useState<SportType>(existing?.sportType ?? SportType.Run);
  const [distKm, setDistKm] = useState(
    existing?.plannedDistanceMeters ? (existing.plannedDistanceMeters / 1000).toFixed(1) : ''
  );
  const [duration, setDuration] = useState(
    existing?.plannedDurationSeconds ? secondsToHhmm(existing.plannedDurationSeconds) : ''
  );
  const [pace, setPace] = useState(
    existing?.plannedPaceSecondsPerKm ? secondsToMmss(existing.plannedPaceSecondsPerKm) : ''
  );
  const [paceMax, setPaceMax] = useState(
    existing?.notes?.match(/paceMax:(\d+:\d+)/)?.[1] ?? ''
  );
  const [hrZone, setHrZone] = useState<string>(
    existing?.plannedHeartRateZone ? String(existing.plannedHeartRateZone) : ''
  );
  const [notes, setNotes] = useState(
    (existing?.notes ?? '').replace(/\[intervals:[^\]]+\]\s*/g, '').replace(/\[paceMax:[^\]]+\]\s*/g, '').trim()
  );
  const [intervals, setIntervals] = useState(() => {
    const m = existing?.notes?.match(/\[intervals:([^\]]+)\]/);
    return m ? m[1] : '';
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [showDuplicate, setShowDuplicate] = useState(false);

  const buildData = (): CreateWorkoutData => {
    // Encode paceMax and intervals in notes (no DB schema change needed)
    let finalNotes = notes.trim() || undefined;
    const tags: string[] = [];
    if (paceMax) tags.push(`[paceMax:${paceMax}]`);
    if (intervals.trim()) tags.push(`[intervals:${intervals.trim()}]`);
    if (tags.length > 0) finalNotes = (finalNotes ? finalNotes + '\n' : '') + tags.join(' ');
    return {
      date, title, workoutType, sportType,
      notes: finalNotes,
      plannedDistanceMeters: distKm ? parseFloat(distKm) * 1000 : undefined,
      plannedDurationSeconds: duration ? hhmmToSeconds(duration) : undefined,
      plannedPaceSecondsPerKm: pace ? mmssToSeconds(pace) : undefined,
      plannedHeartRateZone: hrZone ? parseInt(hrZone) : undefined,
    };
  };

  const handleSave = async () => {
    if (!date || !title.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'edit' && existing) {
        await trainingApi.update(existing.id, buildData());
      } else {
        await trainingApi.create(buildData());
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await trainingApi.remove(existing.id);
      onSaved();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!existing || !duplicateDate) return;
    setSaving(true);
    try {
      await trainingApi.duplicate(existing.id, duplicateDate);
      onSaved();
      setShowDuplicate(false);
      setDuplicateDate('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {modal.mode === 'create' ? 'New Workout' : 'Edit Workout'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Easy 10km"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Sport type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sport</label>
            <div className="flex flex-wrap gap-2">
              {SPORT_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSportType(s.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    sportType === s.value
                      ? 'bg-primary-100 text-primary-800 border-primary-400 ring-2 ring-offset-1 ring-primary-400'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Workout type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWorkoutType(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    workoutType === t.value
                      ? t.classes + ' ring-2 ring-offset-1 ring-primary-400'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distance + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Distance (km)</label>
              <input
                type="number" min="0" step="0.1"
                value={distKm}
                onChange={(e) => setDistKm(e.target.value)}
                placeholder="10.0"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Duration (h:mm)</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="1:00"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pace + HR Zone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pace Min (mm:ss/km)</label>
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  placeholder="5:00"
                  className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <input
                  type="text"
                  value={paceMax}
                  onChange={(e) => setPaceMax(e.target.value)}
                  placeholder="5:30"
                  className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target HR Zone (1–5)</label>
              <select
                value={hrZone}
                onChange={(e) => setHrZone(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Any</option>
                <option value="1">Zone 1 — Recovery (&lt;60%)</option>
                <option value="2">Zone 2 — Aerobic (60–70%)</option>
                <option value="3">Zone 3 — Tempo (70–80%)</option>
                <option value="4">Zone 4 — Threshold (80–90%)</option>
                <option value="5">Zone 5 — Max (&gt;90%)</option>
              </select>
            </div>
          </div>

          {/* Intervals */}
          {workoutType === WorkoutType.Intervals && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Intervals (e.g. 8×400m @ 4:30/km)</label>
              <input
                type="text"
                value={intervals}
                onChange={(e) => setIntervals(e.target.value)}
                placeholder="8×400m @ 4:30/km"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Keep HR under 140…"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none"
            />
          </div>

          {/* Duplicate section */}
          {modal.mode === 'edit' && showDuplicate && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Duplicate to:</label>
              <input
                type="date"
                value={duplicateDate}
                onChange={(e) => setDuplicateDate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                onClick={handleDuplicate}
                disabled={!duplicateDate || saving}
                className="px-3 py-1 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          )}

          {/* Comparison panel (edit mode only) */}
          {modal.mode === 'edit' && existing && (
            <ComparisonPanel workoutId={existing.id} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700 gap-2 sticky bottom-0 bg-white dark:bg-gray-800">
          <div className="flex gap-2">
            {modal.mode === 'edit' && (
              <>
                <button
                  onClick={() => setShowDuplicate(!showDuplicate)}
                  className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !date || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DnD helpers ───────────────────────────────────────────────────────────────

function DraggableWorkout({ workout, children }: { workout: ScheduledWorkout; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: workout.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab', touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

function DroppableDay({ dateStr, children }: { dateStr: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? 'rgba(37, 99, 235, 0.08)' : undefined }}>
      {children}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [exportCount, setExportCount] = useState(50);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showMyTemplates, setShowMyTemplates] = useState(false);
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseTrainingCsv> | null>(null);
  const [activityPreview, setActivityPreview] = useState<{ id: string; name: string } | null>(null);
  const [racePreview, setRacePreview] = useState<ScheduledWorkout | null>(null);
  const [absenceDetail, setAbsenceDetail] = useState<AbsenceDay | null>(null);
  const [showClearRange, setShowClearRange] = useState(false);
  const [clearFrom, setClearFrom] = useState('');
  const [clearTo, setClearTo] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const fromStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const toStr = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const { data: workouts = [] } = useScheduledWorkouts(fromStr, toStr);
  const { data: comparisons = [] } = useWorkoutComparisons(fromStr, toStr);
  const { data: activitiesPage } = useActivities({ from: fromStr, to: toStr, pageSize: 100 });
  const { data: absenceDays = [] } = useAbsenceDays(fromStr, toStr);
  const [absenceDialogDate, setAbsenceDialogDate] = useState<string | null>(null); // null = closed, string = pre-filled date

  const comparisonMap = comparisons.reduce<Record<string, WorkoutComparison>>((acc, c) => {
    acc[c.workout.id] = c;
    return acc;
  }, {});

  // Map of date-string → activities for that day
  const activityByDate = (activitiesPage?.items ?? []).reduce<Record<string, ActivitySummary[]>>((acc, a) => {
    const dateStr = a.startDate.slice(0, 10);
    (acc[dateStr] ??= []).push(a);
    return acc;
  }, {});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training'] });
    queryClient.invalidateQueries({ queryKey: ['workout-comparisons'] });
  };

  const absenceByDate = absenceDays.reduce<Record<string, AbsenceDay[]>>((acc, a) => {
    (acc[a.date] ??= []).push(a);
    return acc;
  }, {});

  const handleAddAbsence = async (dates: string[], type: AbsenceType, notes: string) => {
    await Promise.all(dates.map((date) => absenceApi.create({ date, absenceType: type, notes: notes || undefined })));
    queryClient.invalidateQueries({ queryKey: ['absence'] });
  };

  const handleRemoveAbsence = async (id: string) => {
    await absenceApi.remove(id);
    queryClient.invalidateQueries({ queryKey: ['absence'] });
    setAbsenceDetail(null);
  };

  const handleClearRange = async () => {
    if (!clearFrom || !clearTo) return;
    const toDelete = workouts.filter((w) => w.date >= clearFrom && w.date <= clearTo);
    await Promise.all(toDelete.map((w) => trainingApi.remove(w.id)));
    invalidate();
    setShowClearRange(false);
    setClearFrom('');
    setClearTo('');
    setClearConfirm(false);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const workoutId = String(active.id);
    const newDate = String(over.id);
    // over.id is the dateStr — validate it looks like a date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout || workout.date === newDate) return;
    await trainingApi.update(workoutId, { ...workout, date: newDate });
    invalidate();
  };

  const workoutMap = workouts.reduce<Record<string, ScheduledWorkout[]>>((acc, w) => {
    (acc[w.date] ??= []).push(w);
    return acc;
  }, {});

  const days = calendarDays(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleExportPlan = async (from: string, to: string, format: ExportFormat) => {
    const blob = (await trainingApi.exportCsv(from, to, format)).data;
    const suffix = from === to ? from : `${from}_${to}`;
    triggerDownload(blob, `training-plan-${suffix}.csv`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseTrainingCsv(text);
      if (parsed.length === 0) { alert('No valid rows found in CSV.'); return; }
      setImportPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async (toImport: ReturnType<typeof parseTrainingCsv>) => {
    await trainingApi.importWorkouts(toImport);
    invalidate();
    setImportPreview(null);
  };

  const handleExportActivities = async () => {
    const blob = (await activitiesApi.exportCsv({ count: exportCount })).data;
    triggerDownload(blob, `activities-last-${exportCount}.csv`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Training Schedule</h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAbsenceDialogDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            + Absence
          </button>
          <button
            onClick={() => setShowClearRange(true)}
            className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Clear Range
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Export Plan
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowPlanDialog(true)}
            className="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-700 border border-primary-300 dark:border-primary-600 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            Load Training Plan
          </button>
          <button
            onClick={() => setShowMyTemplates(true)}
            className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-600 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            My Templates
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <div className="flex items-center gap-1">
            <select
              value={exportCount}
              onChange={(e) => setExportCount(Number(e.target.value))}
              className="rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 px-2 py-2 text-sm focus:border-primary-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              {[10, 20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={handleExportActivities}
              className="px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-r-md border border-primary-600"
              title="Download last N activities as CSV for AI"
            >
              Export Activities
            </button>
          </div>
        </div>
      </div>

      {/* Month navigator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={prevMonth} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Previous month">←</button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Next month">→</button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-[100px] sm:h-[120px] border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30" />;
              }
              const dateStr = toDateStr(day);
              const dayWorkouts = workoutMap[dateStr] ?? [];
              const isToday = dateStr === toDateStr(today);

              // Activity IDs already displayed via a workout comparison
              const linkedActivityIds = new Set(
                dayWorkouts.map((w) => comparisonMap[w.id]?.activityId).filter(Boolean) as string[]
              );
              const unscheduledActivities = (activityByDate[dateStr] ?? [])
                .filter((a) => !linkedActivityIds.has(a.id));

              return (
                <DroppableDay key={dateStr} dateStr={dateStr}>
                  <div
                    onClick={() => setModal({ mode: 'create', initialDate: dateStr })}
                    className={`group h-[100px] sm:h-[120px] overflow-hidden border-b border-r border-gray-100 dark:border-gray-700 p-1.5 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors ${isToday ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-primary-600 text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayWorkouts.map((w) => {
                        const cfg = workoutTypeConfig(w.workoutType);
                        const cmp = comparisonMap[w.id];
                        const hasActivity = cmp?.activityId != null;
                        const isRace = w.workoutType === WorkoutType.Race;
                        const distLabel = w.plannedDistanceMeters ? ` (${(w.plannedDistanceMeters / 1000).toFixed(1)}k)` : '';
                        const intervalsMatch = w.notes?.match(/\[intervals:([^\]]+)\]/);
                        const paceMaxMatch = w.notes?.match(/\[paceMax:([^\]]+)\]/);
                        const paceRangeLabel = w.plannedPaceSecondsPerKm
                          ? paceMaxMatch
                            ? ` ${formatPaceMmss(w.plannedPaceSecondsPerKm)}–${paceMaxMatch[1]}`
                            : ` ${formatPaceMmss(w.plannedPaceSecondsPerKm)}`
                          : '';
                        return (
                          <DraggableWorkout key={w.id} workout={w}>
                            <div>
                              <div
                                onClick={(e) => { e.stopPropagation(); if (isRace) setRacePreview(w); else setModal({ mode: 'edit', workout: w }); }}
                                className={`text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 ${cfg.classes} ${isRace ? 'font-bold ring-1 ring-purple-400' : ''}`}
                                title={w.notes ?? w.title}
                              >
                                <span>{isRace ? '🏁' : sportTypeEmoji(w.sportType)} </span>
                                <span className="font-medium hidden sm:inline">{cfg.label} · </span>
                                <span>{w.title}{distLabel}</span>
                                {paceRangeLabel && <span className="hidden sm:inline opacity-70">{paceRangeLabel}</span>}
                                {intervalsMatch && <span className="hidden sm:inline opacity-70"> · {intervalsMatch[1]}</span>}
                              </div>
                              {hasActivity && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const act = (activitiesPage?.items ?? []).find((a) => a.id === cmp.activityId);
                                    if (act) setActivityPreview({ id: act.id, name: act.name });
                                  }}
                                  className="block w-full text-left text-xs text-gray-500 dark:text-gray-400 px-1 mt-0.5 truncate hover:text-primary-600 dark:hover:text-primary-400"
                                >
                                  ✓ {formatDistKm(cmp.actualDistanceM)}
                                  {cmp.actualPaceSecPerKm != null && (
                                    <span className="hidden sm:inline"> · {formatPaceMmss(cmp.actualPaceSecPerKm)}</span>
                                  )}
                                </button>
                              )}
                            </div>
                          </DraggableWorkout>
                        );
                      })}
                      {unscheduledActivities.map((a) => (
                        <button
                          key={a.id}
                          onClick={(e) => { e.stopPropagation(); setActivityPreview({ id: a.id, name: a.name }); }}
                          className="block w-full text-left text-xs px-1.5 py-0.5 rounded border truncate bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-primary-600 dark:hover:text-primary-400"
                          title={a.name}
                        >
                          <span className="hidden sm:inline">{formatDistKm(a.distance)} · </span>
                          <span>{a.name}</span>
                        </button>
                      ))}
                      {(absenceByDate[dateStr] ?? []).map((ab) => {
                        const cfg = absenceTypeConfig(ab.absenceType);
                        return (
                          <button
                            key={ab.id}
                            onClick={(e) => { e.stopPropagation(); setAbsenceDetail(ab); }}
                            className={`text-xs px-1.5 py-0.5 rounded border w-full text-left truncate ${cfg.color}`}
                            title={ab.notes ?? cfg.label}
                          >
                            {cfg.emoji} <span className="hidden sm:inline">{cfg.label}</span>
                            {ab.notes && <span className="hidden sm:inline text-[10px] opacity-70"> · {ab.notes}</span>}
                          </button>
                        );
                      })}
                      <button
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5 w-full text-left opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setAbsenceDialogDate(dateStr); }}
                        title="Mark absence"
                      >+ absence</button>
                    </div>
                  </div>
                </DroppableDay>
              );
            })}
          </div>
        </DndContext>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {WORKOUT_TYPES.map((t) => (
          <span key={t.value} className={`text-xs px-2 py-1 rounded-full border ${t.classes}`}>{t.label}</span>
        ))}
        <span className="text-xs text-gray-300 dark:text-gray-600 mx-1">|</span>
        {ABSENCE_TYPES.map((t) => (
          <span key={t.value} className={`text-xs px-2 py-1 rounded-full border ${t.color}`}>{t.emoji} {t.label}</span>
        ))}
      </div>

      {/* CSV format hint */}
      <details className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 font-medium">CSV format reference</summary>
        <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          <p className="text-gray-700 dark:text-gray-200 font-sans font-medium mb-2">Training Plan CSV (import/export)</p>
          <pre>{'Date,Title,Type,PlannedDistance(km),PlannedDuration(hh:mm:ss),Notes\n2026-03-03,Easy Run,Easy,10,1:00:00,Keep HR under 140\n2026-03-04,Rest Day,Rest,,,\n2026-03-05,Tempo Intervals,Intervals,8,0:45:00,"4×2km @ threshold"'}</pre>
          <p className="text-gray-700 dark:text-gray-200 font-sans font-medium mt-3 mb-2">Types: Easy · Tempo · Long · Intervals · Recovery · Rest · Race · Strength · Other</p>
        </div>
      </details>

      {/* Workout Modal */}
      {modal && (
        <WorkoutModal modal={modal} onClose={() => setModal(null)} onSaved={invalidate} />
      )}

      {/* Import Preview Dialog */}
      {importPreview && (
        <ImportPreviewDialog
          parsed={importPreview}
          existingWorkouts={workouts}
          onConfirm={handleImportConfirm}
          onClose={() => setImportPreview(null)}
        />
      )}

      {/* Training Plan Dialog */}
      {showPlanDialog && <TrainingPlanDialog onClose={() => setShowPlanDialog(false)} />}

      {/* My Templates Dialog */}
      {showMyTemplates && <MyTemplatesDialog onClose={() => setShowMyTemplates(false)} />}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          currentYear={year}
          currentMonth={month}
          onExport={handleExportPlan}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Add Absence Dialog */}
      {absenceDialogDate !== null && (
        <AddAbsenceDialog
          initialDate={absenceDialogDate}
          onConfirm={handleAddAbsence}
          onClose={() => setAbsenceDialogDate(null)}
        />
      )}

      {/* Activity Preview Dialog */}
      {activityPreview && (
        <ActivityPreviewDialog
          activityId={activityPreview.id}
          activityName={activityPreview.name}
          onClose={() => setActivityPreview(null)}
        />
      )}

      {/* Race Preview Dialog */}
      {racePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setRacePreview(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏁</span>
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{racePreview.title}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 ml-7">{formatDate(racePreview.date)}</p>
              </div>
              <button onClick={() => setRacePreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-3 shrink-0">×</button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              {racePreview.location && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">📍</span>
                  <span>{racePreview.location}</span>
                </div>
              )}
              {racePreview.raceDistanceMeters != null && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">📏</span>
                  <span>{formatDistance(racePreview.raceDistanceMeters)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Goal time</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {racePreview.goalTimeSecs != null ? secondsToHhmm(racePreview.goalTimeSecs) : '—'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Result</p>
                  <p className={`font-semibold ${racePreview.resultTimeSecs != null ? (racePreview.goalTimeSecs != null && racePreview.resultTimeSecs <= racePreview.goalTimeSecs ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white') : 'text-gray-400'}`}>
                    {racePreview.resultTimeSecs != null ? secondsToHhmm(racePreview.resultTimeSecs) : '—'}
                  </p>
                </div>
              </div>
              {racePreview.notes && !/^\[/.test(racePreview.notes.trim()) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">{racePreview.notes.replace(/\[[^\]]+\]/g, '').trim()}</p>
              )}
              {racePreview.linkedActivityId && (
                <Link
                  to={`/activities/${racePreview.linkedActivityId}`}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  onClick={() => setRacePreview(null)}
                >
                  View linked activity →
                </Link>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setRacePreview(null); setModal({ mode: 'edit', workout: racePreview }); }}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Edit
              </button>
              <button onClick={() => setRacePreview(null)} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absence Detail Dialog */}
      {absenceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setAbsenceDetail(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              {(() => {
                const cfg = absenceTypeConfig(absenceDetail.absenceType);
                return <p className="font-semibold text-gray-900 dark:text-white">{cfg.emoji} {cfg.label}</p>;
              })()}
              <button onClick={() => setAbsenceDetail(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <div><p className="text-xs text-gray-400">Date</p><p className="font-medium text-gray-900 dark:text-white">{formatDate(absenceDetail.date)}</p></div>
              {absenceDetail.notes && <div><p className="text-xs text-gray-400">Notes</p><p className="text-gray-700 dark:text-gray-300">{absenceDetail.notes}</p></div>}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => handleRemoveAbsence(absenceDetail.id)}
                className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-md"
              >
                Delete
              </button>
              <button onClick={() => setAbsenceDetail(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Range Dialog */}
      {showClearRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowClearRange(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <p className="font-semibold text-gray-900 dark:text-white">Clear Schedule Range</p>
              <button onClick={() => setShowClearRange(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Remove all scheduled workouts between these dates.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
                  <input type="date" value={clearFrom} onChange={(e) => setClearFrom(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
                  <input type="date" value={clearTo} onChange={(e) => setClearTo(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
                </div>
              </div>
              {clearFrom && clearTo && (
                <label className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 cursor-pointer">
                  <input type="checkbox" checked={clearConfirm} onChange={(e) => setClearConfirm(e.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                  I confirm I want to delete {workouts.filter((w) => w.date >= clearFrom && w.date <= clearTo).length} workout(s)
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowClearRange(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={handleClearRange}
                disabled={!clearFrom || !clearTo || !clearConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
              >
                Clear Workouts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
