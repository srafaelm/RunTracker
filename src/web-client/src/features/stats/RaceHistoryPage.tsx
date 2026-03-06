import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRaces, useCreateScheduledWorkout, useUpdateScheduledWorkout, useDeleteScheduledWorkout, useActivities } from '../../hooks/useQueries';
import type { ScheduledWorkout } from '../../types';
import { formatDate, formatDistance } from '../../utils/formatters';
import { WorkoutType, SportType } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function pace(distMeters?: number, secs?: number): string | null {
  if (!distMeters || !secs || distMeters < 100) return null;
  const secPerKm = secs / (distMeters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

function getOnTrackStatus(race: ScheduledWorkout, recentRuns: { distanceMeters: number; avgPaceSecPerKm: number }[]): 'on-track' | 'close' | 'behind' | null {
  const dist = race.raceDistanceMeters ?? race.plannedDistanceMeters;
  if (!race.goalTimeSecs || !dist || dist < 100) return null;
  const goalPace = race.goalTimeSecs / (dist / 1000); // sec/km
  // Find recent runs within ±30% of race distance
  const candidates = recentRuns.filter((r) => {
    const ratio = r.distanceMeters / dist;
    return ratio >= 0.7 && ratio <= 1.3;
  });
  if (candidates.length === 0) return null;
  const bestPace = Math.min(...candidates.map((r) => r.avgPaceSecPerKm));
  const diff = (bestPace - goalPace) / goalPace; // positive = slower than goal
  if (diff <= 0.05) return 'on-track';
  if (diff <= 0.10) return 'close';
  return 'behind';
}

export default function RaceHistoryPage() {
  const { data: races, isLoading } = useRaces();
  const createRace = useCreateScheduledWorkout();
  const updateRace = useUpdateScheduledWorkout();
  const deleteRace = useDeleteScheduledWorkout();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    raceDistanceMeters: '',
    goalTimeSecs: '',
    resultTimeSecs: '',
    location: '',
    notes: '',
    linkedActivityId: '',
  });

  // Recent runs for "On Track" computation (last 60 days)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const { data: recentRunsData } = useActivities({ pageSize: 200, sportType: SportType.Run, from: sixtyDaysAgo });
  const recentRuns = (recentRunsData?.items ?? [])
    .filter((a) => a.distance > 0 && a.movingTime > 0)
    .map((a) => ({ distanceMeters: a.distance, avgPaceSecPerKm: a.movingTime / (a.distance / 1000) }));

  // Load activities near the selected race date for linking
  const fromDate = form.date ? new Date(new Date(form.date).getTime() - 7 * 86400000).toISOString().slice(0, 10) : undefined;
  const toDate = form.date ? new Date(new Date(form.date).getTime() + 7 * 86400000).toISOString().slice(0, 10) : undefined;
  const { data: nearbyActivities } = useActivities({
    pageSize: 50,
    sportType: SportType.Run,
    from: showForm ? fromDate : undefined,
    to: showForm ? toDate : undefined,
  });

  const today = new Date().toISOString().slice(0, 10);
  const pastRaces = (races ?? []).filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const upcomingRaces = (races ?? []).filter((r) => r.date > today).sort((a, b) => a.date.localeCompare(b.date));

  const raceDistance = (r: ScheduledWorkout) => r.raceDistanceMeters ?? r.plannedDistanceMeters;

  const chartData = pastRaces
    .filter((r) => r.resultTimeSecs && raceDistance(r))
    .slice(0, 12)
    .reverse()
    .map((r) => ({
      name: r.title,
      date: r.date,
      result: r.resultTimeSecs ? Math.round(r.resultTimeSecs / 60) : null,
      goal: r.goalTimeSecs ? Math.round(r.goalTimeSecs / 60) : null,
    }));

  function openNew() {
    setEditId(null);
    setForm({ title: '', date: new Date().toISOString().slice(0, 10), raceDistanceMeters: '', goalTimeSecs: '', resultTimeSecs: '', location: '', notes: '', linkedActivityId: '' });
    setShowForm(true);
  }

  function openEdit(race: ScheduledWorkout) {
    setEditId(race.id);
    const dist = race.raceDistanceMeters ?? race.plannedDistanceMeters;
    setForm({
      title: race.title,
      date: race.date,
      raceDistanceMeters: dist ? String(dist / 1000) : '',
      goalTimeSecs: race.goalTimeSecs ? String(race.goalTimeSecs) : '',
      resultTimeSecs: race.resultTimeSecs ? String(race.resultTimeSecs) : '',
      location: race.location ?? '',
      notes: race.notes ?? '',
      linkedActivityId: race.linkedActivityId ?? '',
    });
    setShowForm(true);
  }

  function parseTimeSecs(val: string): number | undefined {
    if (!val.trim()) return undefined;
    // Accept h:mm:ss, m:ss, or plain seconds
    const parts = val.split(':').map(Number);
    if (parts.some(isNaN)) return undefined;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      date: form.date,
      workoutType: WorkoutType.Race,
      raceDistanceMeters: form.raceDistanceMeters ? parseFloat(form.raceDistanceMeters) * 1000 : undefined,
      goalTimeSecs: parseTimeSecs(form.goalTimeSecs),
      resultTimeSecs: parseTimeSecs(form.resultTimeSecs),
      location: form.location || undefined,
      notes: form.notes || undefined,
      linkedActivityId: form.linkedActivityId || undefined,
    };

    if (editId) {
      await updateRace.mutateAsync({ id: editId, data: payload });
    } else {
      await createRace.mutateAsync(payload);
    }
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this race?')) return;
    await deleteRace.mutateAsync(id);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Race Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your races, goals, and results</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          + Add Race
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editId ? 'Edit Race' : 'Add Race'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Race Name *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date *</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Race Distance (km)</label>
              <input type="number" step="0.001" min="0" value={form.raceDistanceMeters}
                onChange={(e) => setForm({ ...form, raceDistanceMeters: e.target.value })}
                placeholder="e.g. 42.195"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, Country"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Goal Time (h:mm:ss)</label>
              <input value={form.goalTimeSecs} onChange={(e) => setForm({ ...form, goalTimeSecs: e.target.value })}
                placeholder="e.g. 3:30:00"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Result Time (h:mm:ss)</label>
              <input value={form.resultTimeSecs} onChange={(e) => setForm({ ...form, resultTimeSecs: e.target.value })}
                placeholder="Leave blank if upcoming"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Linked Strava Activity</label>
              <select
                value={form.linkedActivityId}
                onChange={(e) => setForm({ ...form, linkedActivityId: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {(nearbyActivities?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.startDate.slice(0, 10)})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-0.5">Activities within ±7 days of race date</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={createRace.isPending || updateRace.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {editId ? 'Save Changes' : 'Add Race'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <p className="text-gray-500 dark:text-gray-400 text-sm">Loading…</p>}

      {/* Upcoming Races */}
      {upcomingRaces.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcomingRaces.map((race) => {
              const daysUntil = Math.ceil((new Date(race.date).getTime() - Date.now()) / 86400000);
              const onTrack = getOnTrackStatus(race, recentRuns);
              const onTrackLabel = onTrack === 'on-track' ? 'On Track' : onTrack === 'close' ? 'Close' : onTrack === 'behind' ? 'Behind' : null;
              const onTrackColor = onTrack === 'on-track' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : onTrack === 'close' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
              return (
                <div key={race.id} className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-4 flex items-center gap-4">
                  <div className="w-16 text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{daysUntil}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">days</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{race.title}</p>
                      {onTrackLabel && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${onTrackColor}`}>{onTrackLabel}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span>{formatDate(race.date)}</span>
                      {race.location && <span>{race.location}</span>}
                      {raceDistance(race) && <span>{formatDistance(raceDistance(race)!)}</span>}
                      {race.goalTimeSecs && <span>Goal: {formatTime(race.goalTimeSecs)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {race.linkedActivityId && (
                      <Link to={`/activities/${race.linkedActivityId}`} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Activity →</Link>
                    )}
                    <button onClick={() => openEdit(race)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(race.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Finish Times (minutes)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip formatter={(v: number) => `${v} min`} />
              <Bar dataKey="result" fill="#7c3aed" name="Result" radius={[3, 3, 0, 0]} />
              <Bar dataKey="goal" fill="#a78bfa" name="Goal" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Past Races */}
      {pastRaces.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Past Races</h2>
          <div className="space-y-3">
            {pastRaces.map((race) => {
              const achieved = race.goalTimeSecs && race.resultTimeSecs ? race.resultTimeSecs <= race.goalTimeSecs : null;
              return (
                <div key={race.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{race.title}</p>
                        {achieved === true && <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">Goal achieved</span>}
                        {achieved === false && <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 px-2 py-0.5 rounded-full">Goal missed</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{formatDate(race.date)}</span>
                        {race.location && <span>{race.location}</span>}
                        {raceDistance(race) && <span>{formatDistance(raceDistance(race)!)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {race.resultTimeSecs && (
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(race.resultTimeSecs)}</p>
                      )}
                      {race.goalTimeSecs && (
                        <p className="text-xs text-gray-400">Goal: {formatTime(race.goalTimeSecs)}</p>
                      )}
                      {race.resultTimeSecs && raceDistance(race) && (
                        <p className="text-xs text-gray-400">{pace(raceDistance(race), race.resultTimeSecs)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {race.linkedActivityId && (
                        <Link to={`/activities/${race.linkedActivityId}`} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Activity →</Link>
                      )}
                      <button onClick={() => openEdit(race)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(race.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                  {race.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">{race.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && (races ?? []).length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏁</p>
          <p className="text-gray-500 dark:text-gray-400">No races yet. Add your first race above!</p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
        <Link to="/training" className="text-sm text-primary-600 hover:text-primary-800">← Back to Training Calendar</Link>
      </div>
    </div>
  );
}
