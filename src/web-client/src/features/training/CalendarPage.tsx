import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trainingApi } from '../../api/client';
import type { ScheduledWorkout } from '../../types';
import { WorkoutType } from '../../types';

const WORKOUT_TYPE_COLORS: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Easy]:      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  [WorkoutType.Tempo]:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  [WorkoutType.Intervals]: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  [WorkoutType.Long]:      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  [WorkoutType.Race]:      'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  [WorkoutType.Rest]:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  [WorkoutType.Recovery]:  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  [WorkoutType.Strength]:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  [WorkoutType.Other]:     'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const WORKOUT_TYPE_LABELS: Partial<Record<WorkoutType, string>> = {
  [WorkoutType.Easy]: 'Easy',
  [WorkoutType.Tempo]: 'Tempo',
  [WorkoutType.Intervals]: 'Intervals',
  [WorkoutType.Long]: 'Long',
  [WorkoutType.Race]: 'Race',
  [WorkoutType.Rest]: 'Rest',
  [WorkoutType.Recovery]: 'Recovery',
  [WorkoutType.Strength]: 'Strength',
  [WorkoutType.Other]: 'Other',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0 = Sun, convert to Mon-based (0 = Mon)
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface AddWorkoutModalProps {
  date: string;
  onClose: () => void;
}

function AddWorkoutModal({ date, onClose }: AddWorkoutModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Add for {date}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-2">
          <Link
            to="/training"
            state={{ addDate: date }}
            className="block w-full text-center py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            onClick={onClose}
          >
            Add Training Workout
          </Link>
          <Link
            to="/races"
            state={{ addDate: date }}
            className="block w-full text-center py-2 rounded-lg border border-purple-400 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20"
            onClick={onClose}
          >
            Add Race ★
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [addDate, setAddDate] = useState<string | null>(null);

  const fromDate = isoDate(year, month, 1);
  const toDate = isoDate(year, month, getDaysInMonth(year, month));

  const { data: workouts = [] } = useQuery({
    queryKey: ['training', fromDate, toDate],
    queryFn: () => trainingApi.getList(fromDate, toDate).then(r => r.data),
  });

  // Group workouts by date
  const byDate = new Map<string, ScheduledWorkout[]>();
  for (const w of workouts) {
    const list = byDate.get(w.date) ?? [];
    list.push(w);
    byDate.set(w.date, list);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month); // 0=Mon
  const todayStr = today.toISOString().slice(0, 10);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build grid cells: leading empty + day cells
  const cells: { day: number | null; date: string | null }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: isoDate(year, month, d) });
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push({ day: null, date: null });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scheduled workouts &amp; races</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/training" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Training →</Link>
          <Link to="/races" className="text-sm text-purple-600 hover:text-purple-700 font-medium ml-4">Races →</Link>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{monthName} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
          →
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(WORKOUT_TYPE_LABELS).filter(([k]) => Number(k) !== WorkoutType.Rest).map(([k, label]) => (
          <span key={k} className={`px-2 py-0.5 rounded text-xs font-medium ${WORKOUT_TYPE_COLORS[Number(k) as WorkoutType]}`}>
            {Number(k) === WorkoutType.Race ? '★ ' : ''}{label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isToday = cell.date === todayStr;
            const dayWorkouts = cell.date ? (byDate.get(cell.date) ?? []) : [];
            const hasRace = dayWorkouts.some(w => w.workoutType === WorkoutType.Race);

            return (
              <div
                key={i}
                className={`min-h-[90px] border-b border-r border-gray-100 dark:border-gray-700 p-1 ${
                  cell.day == null ? 'bg-gray-50 dark:bg-gray-800/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer'
                }`}
                onClick={() => cell.date && setAddDate(cell.date)}
              >
                {cell.day != null && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-primary-600 text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {hasRace ? <span title="Race day">★</span> : cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayWorkouts.slice(0, 3).map(w => (
                        <Link
                          key={w.id}
                          to="/training"
                          onClick={e => e.stopPropagation()}
                          className={`block truncate text-xs px-1 py-0.5 rounded font-medium ${WORKOUT_TYPE_COLORS[w.workoutType]}`}
                          title={w.title}
                        >
                          {w.workoutType === WorkoutType.Race ? '★ ' : ''}{w.title}
                          {w.plannedDistanceMeters && ` · ${(w.plannedDistanceMeters / 1000).toFixed(0)}k`}
                        </Link>
                      ))}
                      {dayWorkouts.length > 3 && (
                        <p className="text-xs text-gray-400 px-1">+{dayWorkouts.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {addDate && <AddWorkoutModal date={addDate} onClose={() => setAddDate(null)} />}
    </div>
  );
}
