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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
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
    await deleteRace.mutateAsync(id);
    setConfirmDelete(null);
  }

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase">Race Calendar</h1>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575] mt-2">Track your races, goals, and results</p>
        </div>
        <button
          onClick={openNew}
          className="px-5 py-2.5 bg-[#cffc00] text-[#3b4a00] font-label font-bold text-xs uppercase tracking-widest hover:bg-[#c2ed00] transition-colors"
        >
          + Add Race
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-[#20201f] p-6 mb-6">
          <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">{editId ? 'Edit Race' : 'Add Race'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Race Name *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Date *</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Race Distance (km)</label>
              <input type="number" step="0.001" min="0" value={form.raceDistanceMeters}
                onChange={(e) => setForm({ ...form, raceDistanceMeters: e.target.value })}
                placeholder="e.g. 42.195"
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, Country"
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Goal Time (h:mm:ss)</label>
              <input value={form.goalTimeSecs} onChange={(e) => setForm({ ...form, goalTimeSecs: e.target.value })}
                placeholder="e.g. 3:30:00"
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Result Time (h:mm:ss)</label>
              <input value={form.resultTimeSecs} onChange={(e) => setForm({ ...form, resultTimeSecs: e.target.value })}
                placeholder="Leave blank if upcoming"
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Linked Activity</label>
              <select
                value={form.linkedActivityId}
                onChange={(e) => setForm({ ...form, linkedActivityId: e.target.value })}
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors"
              >
                <option value="">— None —</option>
                {(nearbyActivities?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.startDate.slice(0, 10)})</option>
                ))}
              </select>
              <p className="font-label text-[10px] uppercase tracking-widest text-[#767575] mt-1">Activities within ±7 days of race date</p>
            </div>
            <div className="md:col-span-2">
              <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full bg-[#131313] border border-[#484847] text-white font-label text-xs px-3 py-2 focus:border-[#cffc00] focus:outline-none transition-colors" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={createRace.isPending || updateRace.isPending}
                className="px-5 py-2.5 bg-[#cffc00] text-[#3b4a00] font-label font-bold text-xs uppercase tracking-widest hover:bg-[#c2ed00] transition-colors disabled:opacity-50">
                {editId ? 'Save Changes' : 'Add Race'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-[#20201f] border border-[#484847] text-[#adaaaa] font-label text-xs uppercase tracking-widest hover:border-[#cffc00] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <p className="font-label text-xs uppercase tracking-widest text-[#767575]">Loading…</p>}

      {upcomingRaces.length > 0 && (
        <div className="mb-8">
          <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-white mb-4 border-b border-[#484847]/20 pb-2">Upcoming</h2>
          <div className="space-y-3">
            {upcomingRaces.map((race) => {
              const daysUntil = Math.ceil((new Date(race.date).getTime() - Date.now()) / 86400000);
              const onTrack = getOnTrackStatus(race, recentRuns);
              const onTrackLabel = onTrack === 'on-track' ? 'On Track' : onTrack === 'close' ? 'Close' : onTrack === 'behind' ? 'Behind' : null;
              const onTrackColor = onTrack === 'on-track' ? 'bg-[#cffc00]/10 text-[#cffc00]' : onTrack === 'close' ? 'bg-yellow-400/10 text-yellow-300' : 'bg-[#ff734a]/10 text-[#ff734a]';
              return (
                <div key={race.id} className="bg-[#20201f] border-l-2 border-purple-500 p-4 flex items-center gap-4">
                  <div className="w-16 text-center">
                    <p className="font-headline text-3xl font-bold text-purple-400">{daysUntil}</p>
                    <p className="font-label text-[10px] uppercase tracking-widest text-[#767575]">days</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-headline text-base font-bold text-white uppercase tracking-tight">{race.title}</p>
                      {onTrackLabel && (
                        <span className={`font-label text-[10px] uppercase tracking-widest px-2 py-0.5 ${onTrackColor}`}>{onTrackLabel}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 font-label text-xs text-[#767575] mt-1">
                      <span>{formatDate(race.date)}</span>
                      {race.location && <span>{race.location}</span>}
                      {raceDistance(race) && <span>{formatDistance(raceDistance(race)!)}</span>}
                      {race.goalTimeSecs && <span>Goal: {formatTime(race.goalTimeSecs)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0 items-center">
                    {race.linkedActivityId && (
                      <Link to={`/activities/${race.linkedActivityId}`} className="font-label text-[10px] uppercase tracking-widest text-[#cffc00] hover:text-white transition-colors">Activity →</Link>
                    )}
                    <button onClick={() => openEdit(race)} className="font-label text-[10px] uppercase tracking-widest text-[#81ecff] hover:text-white transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete({ id: race.id, title: race.title })} className="font-label text-[10px] uppercase tracking-widest text-[#ff734a] hover:text-white transition-colors">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-[#20201f] p-6 mb-8">
          <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-4">Finish Times (minutes)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#484847" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#adaaaa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#adaaaa' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #484847', borderRadius: 0 }} labelStyle={{ color: '#adaaaa' }} itemStyle={{ color: '#fff' }} formatter={(v: number) => `${v} min`} />
              <Bar dataKey="result" fill="#cffc00" name="Result" radius={[2, 2, 0, 0]} />
              <Bar dataKey="goal" fill="#484847" name="Goal" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {pastRaces.length > 0 && (
        <div>
          <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-white mb-4 border-b border-[#484847]/20 pb-2">Past Races</h2>
          <div className="space-y-3">
            {pastRaces.map((race) => {
              const achieved = race.goalTimeSecs && race.resultTimeSecs ? race.resultTimeSecs <= race.goalTimeSecs : null;
              return (
                <div key={race.id} className="bg-[#20201f] border-l-2 border-[#484847] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-headline text-base font-bold text-white uppercase tracking-tight">{race.title}</p>
                        {achieved === true && <span className="font-label text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#cffc00]/10 text-[#cffc00]">Goal achieved</span>}
                        {achieved === false && <span className="font-label text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#ff734a]/10 text-[#ff734a]">Goal missed</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 font-label text-xs text-[#767575] mt-1">
                        <span>{formatDate(race.date)}</span>
                        {race.location && <span>{race.location}</span>}
                        {raceDistance(race) && <span>{formatDistance(raceDistance(race)!)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {race.resultTimeSecs && (
                        <p className="font-headline text-xl font-bold text-[#cffc00]">{formatTime(race.resultTimeSecs)}</p>
                      )}
                      {race.goalTimeSecs && (
                        <p className="font-label text-xs text-[#767575]">Goal: {formatTime(race.goalTimeSecs)}</p>
                      )}
                      {race.resultTimeSecs && raceDistance(race) && (
                        <p className="font-label text-xs text-[#767575]">{pace(raceDistance(race), race.resultTimeSecs)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {race.linkedActivityId && (
                        <Link to={`/activities/${race.linkedActivityId}`} className="font-label text-[10px] uppercase tracking-widest text-[#cffc00] hover:text-white transition-colors">Activity →</Link>
                      )}
                      <button onClick={() => openEdit(race)} className="font-label text-[10px] uppercase tracking-widest text-[#81ecff] hover:text-white transition-colors">Edit</button>
                      <button onClick={() => setConfirmDelete({ id: race.id, title: race.title })} className="font-label text-[10px] uppercase tracking-widest text-[#ff734a] hover:text-white transition-colors">Delete</button>
                    </div>
                  </div>
                  {race.notes && <p className="font-label text-xs text-[#767575] mt-2 border-t border-[#484847]/20 pt-2">{race.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && (races ?? []).length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🏁</p>
          <p className="font-label text-xs uppercase tracking-widest text-[#767575]">No races yet. Add your first race above!</p>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-[#484847]/20">
        <Link to="/training" className="font-label text-xs uppercase tracking-widest text-[#cffc00] hover:text-white transition-colors">← Back to Training Calendar</Link>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#484847] w-full max-w-sm p-6">
            <h3 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-2">Delete race</h3>
            <p className="font-label text-xs text-[#767575] mb-4">This action cannot be undone.</p>
            <p className="font-label text-sm text-[#adaaaa] mb-6">
              Are you sure you want to delete <span className="font-bold text-white">"{confirmDelete.title}"</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-[#20201f] border border-[#484847] text-[#adaaaa] font-label text-xs uppercase tracking-widest hover:border-[#cffc00] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deleteRace.isPending}
                className="px-4 py-2 bg-[#ff734a] text-white font-label text-xs uppercase tracking-widest hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {deleteRace.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
