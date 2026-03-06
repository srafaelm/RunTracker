import { useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAllTimeStats, usePersonalRecords, useProfile, useBadges, useStravaSync, useStravaCredentials, useWeightLog, useAddWeightEntry, useDeleteWeightEntry, useWeeklyStats } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import StravaSyncDialog from '../../components/StravaSyncDialog';
import { authApi, settingsApi } from '../../api/client';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatDate,
  recordTypeName,
  sportTypeName,
} from '../../utils/formatters';
import { RecordType, HrZoneAlgorithm, Gender, SportType } from '../../types';
import type { UpdateProfileData, PersonalRecord } from '../../types';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { useMemo } from 'react';
import HrZoneDisplay from './components/HrZoneDisplay';
import RunningLevelCard from './components/RunningLevelCard';
import { FitnessBenchmarkSection } from './components/FitnessBenchmarkSection';
import { useQueryClient } from '@tanstack/react-query';

// ── HR Algorithm Info ──────────────────────────────────────────────────────

const HR_ALGORITHM_INFO: Record<HrZoneAlgorithm, { name: string; description: string }> = {
  [HrZoneAlgorithm.FiveZonePercentMax]: {
    name: '5-Zone % of Max HR',
    description: 'Zones based on fixed percentages of your max HR. Z1: 50–60%, Z2: 60–70%, Z3: 70–80%, Z4: 80–90%, Z5: 90–100%.',
  },
  [HrZoneAlgorithm.FiveZoneKarvonen]: {
    name: '5-Zone Karvonen (HRR)',
    description: 'Uses Heart Rate Reserve (MaxHR − RestingHR). Accounts for fitness level. Requires resting HR.',
  },
  [HrZoneAlgorithm.GarminFiveZone]: {
    name: 'Garmin 5-Zone',
    description: "Garmin's default model. Z1: <60%, Z2: 60–70%, Z3: 70–80%, Z4: 80–90%, Z5: >90%.",
  },
  [HrZoneAlgorithm.SevenZonePolarized]: {
    name: '7-Zone Polarized',
    description: '7 finely-graded zones for polarized training.',
  },
  [HrZoneAlgorithm.Custom]: {
    name: 'Custom',
    description: 'Set your own upper bpm boundary for each of the 5 zones.',
  },
};

type ZonePreview = { zone: number; label: string; lower: number; upper: number };

function computeZonePreview(algorithm: HrZoneAlgorithm, maxHr: number, restingHr: number): ZonePreview[] {
  const bpm = (pct: number) => Math.round(pct * (maxHr - restingHr) + restingHr);
  const pct = (p: number) => Math.round(maxHr * p);
  const LABELS = ['Easy', 'Aerobic', 'Tempo', 'Threshold', 'Max'];
  switch (algorithm) {
    case HrZoneAlgorithm.FiveZoneKarvonen:
      return [
        { zone: 1, label: 'Easy',      lower: bpm(0.50), upper: bpm(0.60) },
        { zone: 2, label: 'Aerobic',   lower: bpm(0.60), upper: bpm(0.70) },
        { zone: 3, label: 'Tempo',     lower: bpm(0.70), upper: bpm(0.80) },
        { zone: 4, label: 'Threshold', lower: bpm(0.80), upper: bpm(0.90) },
        { zone: 5, label: 'Max',       lower: bpm(0.90), upper: maxHr },
      ];
    case HrZoneAlgorithm.GarminFiveZone:
      return [
        { zone: 1, label: 'Warm Up',   lower: 0,           upper: pct(0.60) },
        { zone: 2, label: 'Easy',      lower: pct(0.60),   upper: pct(0.70) },
        { zone: 3, label: 'Aerobic',   lower: pct(0.70),   upper: pct(0.80) },
        { zone: 4, label: 'Threshold', lower: pct(0.80),   upper: pct(0.90) },
        { zone: 5, label: 'Max',       lower: pct(0.90),   upper: maxHr },
      ];
    default:
      return LABELS.map((label, i) => ({
        zone: i + 1,
        label,
        lower: pct(0.50 + i * 0.10),
        upper: i === 4 ? maxHr : pct(0.60 + i * 0.10),
      }));
  }
}

const ZONE_BAR_COLORS = [
  'bg-sky-400', 'bg-green-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-500',
];

// ── Personal Records display ───────────────────────────────────────────────

const PR_CATEGORIES: { label: string; types: RecordType[] }[] = [
  {
    label: 'Short Distance',
    types: [RecordType.Fastest100m, RecordType.Fastest400m, RecordType.Fastest800m, RecordType.Fastest1K],
  },
  {
    label: 'Middle Distance',
    types: [RecordType.Fastest2K, RecordType.Fastest3K, RecordType.Fastest4K, RecordType.Fastest5K, RecordType.Fastest10K],
  },
  {
    label: 'Long Distance',
    types: [RecordType.Fastest15K, RecordType.Fastest20K, RecordType.FastestHalf, RecordType.Fastest30K, RecordType.FastestMarathon],
  },
  {
    label: 'All Time',
    types: [RecordType.LongestRun, RecordType.LongestRunTime, RecordType.LongestRide, RecordType.LongestSwim],
  },
  {
    label: 'Other',
    types: [RecordType.MostElevation, RecordType.BestRunCadence, RecordType.BestRideCadence],
  },
];

function PrCard({ pr, recordType }: { pr: PersonalRecord | undefined; recordType: RecordType }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{recordTypeName(recordType)}</p>
      {pr ? (
        <>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{pr.displayValue}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(pr.achievedAt)}</p>
            {pr.activityId && (
              <Link
                to={`/activities/${pr.activityId}`}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                View →
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className="text-xl font-bold text-gray-300 dark:text-gray-600 mt-1">—</p>
      )}
    </div>
  );
}

function PrCategories({ prs }: { prs: PersonalRecord[] }) {
  const byType = Object.fromEntries(prs.map((pr) => [pr.recordType, pr]));
  return (
    <div className="space-y-6">
      {PR_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            {cat.label}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cat.types.map((t) => <PrCard key={t} pr={byType[t] as PersonalRecord | undefined} recordType={t} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function WeightLogSection({ goalWeightKg }: { goalWeightKg?: number | null }) {
  const { data: entries, isLoading } = useWeightLog();
  const addEntry = useAddWeightEntry();
  const deleteEntry = useDeleteWeightEntry();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const currentYear = new Date().getFullYear();
  const { data: weeklyThisYear } = useWeeklyStats(currentYear);
  const { data: weeklyLastYear } = useWeeklyStats(currentYear - 1);

  const weekDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const stats of [weeklyLastYear, weeklyThisYear]) {
      if (!stats) continue;
      for (const w of stats.weeks) {
        map.set(w.weekStart.slice(0, 10), +(w.totalDistance / 1000).toFixed(1));
      }
    }
    return map;
  }, [weeklyLastYear, weeklyThisYear]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    setSubmitting(true);
    try {
      await addEntry.mutateAsync({ date, weightKg: parseFloat(weight) });
      setWeight('');
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = (entries ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map((e) => ({
    date: e.date.slice(5),
    weight: e.weightKg,
    volumeKm: showVolume ? (weekDistanceMap.get(getMondayStr(e.date)) ?? null) : undefined,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weight Log</h2>
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showVolume}
            onChange={e => setShowVolume(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Training volume
        </label>
      </div>

      <form onSubmit={handleAdd} className="flex gap-3 mb-6">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
        <input type="number" step="0.1" min="20" max="300" value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="kg"
          className="w-24 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
        <button type="submit" disabled={!weight || submitting}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          Log
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {chartData.length >= 2 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis yAxisId="weight" tick={{ fontSize: 11, fill: '#6b7280' }} domain={['auto', 'auto']} unit=" kg" />
            {showVolume && (
              <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} unit=" km" />
            )}
            <Tooltip
              formatter={(v: number, name: string) =>
                name === 'volumeKm' ? [`${v} km`, 'Weekly volume'] : [`${v} kg`, 'Weight']
              }
            />
            {showVolume && <Legend formatter={v => v === 'volumeKm' ? 'Weekly volume' : 'Weight'} />}
            {showVolume && (
              <Bar yAxisId="volume" dataKey="volumeKm" fill="#10b981" opacity={0.4} radius={[2, 2, 0, 0]} />
            )}
            <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            {goalWeightKg != null && (
              <ReferenceLine yAxisId="weight" y={goalWeightKg} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: `Goal ${goalWeightKg} kg`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {sorted.length > 0 && (
        <div className="mt-4 max-h-48 overflow-y-auto space-y-1">
          {sorted.slice().reverse().map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-gray-500 dark:text-gray-400">{entry.date}</span>
              <span className="font-medium text-gray-900 dark:text-white">{entry.weightKg} kg</span>
              <button onClick={() => deleteEntry.mutate(entry.id)}
                className="text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">No entries yet. Log your first weigh-in above.</p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  const isNewUser = (location.state as { newUser?: boolean } | null)?.newUser === true;
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: syncStatus } = useStravaSync();
  const { data: stats, isLoading: statsLoading } = useAllTimeStats();
  const { data: prs, isLoading: prsLoading } = usePersonalRecords();
  const { data: badges } = useBadges();
  const queryClient = useQueryClient();
  const weekStreak = stats?.currentWeekStreak ?? 0;

  const { data: stravaCredentials, refetch: refetchCredentials } = useStravaCredentials();

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateProfileData>({});

  // Strava credentials edit state (F1)
  const [credOpen, setCredOpen] = useState(false);
  const [credClientId, setCredClientId] = useState('');
  const [credSecret, setCredSecret] = useState('');
  const [credSaving, setCredSaving] = useState(false);
  const [credMessage, setCredMessage] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setForm({
      username: profile?.userName ?? null,
      displayName: profile?.displayName ?? null,
      bio: profile?.bio ?? null,
      weightKg: profile?.weightKg ?? null,
      goalWeightKg: profile?.goalWeightKg ?? null,
      heightCm: profile?.heightCm ?? null,
      maxHeartRate: profile?.maxHeartRate ?? null,
      restingHeartRate: profile?.restingHeartRate ?? null,
      hrZoneAlgorithm: profile?.hrZoneAlgorithm ?? HrZoneAlgorithm.FiveZonePercentMax,
      gender: profile?.gender ?? Gender.Unknown,
      birthYear: profile?.birthYear ?? null,
      birthMonth: profile?.birthMonth ?? null,
      birthDay: profile?.birthDay ?? null,
      customHrZones: profile?.customHrZones ?? null,
    });
    setEditing(true);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await authApi.updateProfile(form);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const bmi =
    form.weightKg && form.heightCm
      ? (form.weightKg / Math.pow(form.heightCm / 100, 2)).toFixed(1)
      : profile?.weightKg && profile?.heightCm
      ? (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)
      : null;

  if (statsLoading || profileLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8">Profile</h1>

      {/* Strava connect prompt — shown to new users or anyone who hasn't connected yet */}
      {!user?.stravaConnected && (
        <div className="mb-6 rounded-xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-500 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0 text-3xl">🏅</div>
          <div className="flex-1">
            <p className="font-semibold text-orange-900 dark:text-orange-300 text-base">
              {isNewUser ? 'Welcome to RunTracker! Connect Strava to get started.' : 'Connect your Strava account to sync activities.'}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">
              All your past and future runs will be imported automatically.
            </p>
          </div>
          <button
            onClick={async () => {
              const { data } = await authApi.getStravaConnectUrl();
              window.location.href = data.url;
            }}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-sm transition-colors"
          >
            Connect Strava
          </button>
        </div>
      )}

      {/* Account + physical info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 p-6 mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {profile?.profilePictureUrl ? (
              <img
                src={profile.profilePictureUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                <svg className="w-9 h-9 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
              title="Change photo"
            >
              {uploadingPic ? (
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingPic(true);
                try {
                  await authApi.uploadProfilePicture(file);
                  await queryClient.invalidateQueries({ queryKey: ['profile'] });
                } finally {
                  setUploadingPic(false);
                  e.target.value = '';
                }
              }}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{profile?.displayName ?? profile?.userName ?? user?.email}</p>
            {profile?.userName && <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.userName}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Information</h2>
          {!editing && (
            <button
              onClick={startEdit}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username ?? ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value || null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="your_username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={form.displayName ?? ''}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value || null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Your name"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="text"
                value={user?.email ?? ''}
                disabled
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 text-gray-400 dark:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
              <textarea
                value={form.bio ?? ''}
                onChange={(e) => setForm({ ...form, bio: e.target.value || null })}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="A short bio…"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  min={30} max={300} step={0.1}
                  value={form.weightKg ?? ''}
                  onChange={(e) => setForm({ ...form, weightKg: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Weight (kg)</label>
                <input
                  type="number"
                  min={30} max={300} step={0.1}
                  value={form.goalWeightKg ?? ''}
                  onChange={(e) => setForm({ ...form, goalWeightKg: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Target"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (cm)</label>
                <input
                  type="number"
                  min={100} max={250}
                  value={form.heightCm ?? ''}
                  onChange={(e) => setForm({ ...form, heightCm: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max HR (bpm)</label>
                <input
                  type="number"
                  min={100} max={220}
                  value={form.maxHeartRate ?? ''}
                  onChange={(e) => setForm({ ...form, maxHeartRate: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resting HR (bpm)</label>
                <input
                  type="number"
                  min={30} max={120}
                  value={form.restingHeartRate ?? ''}
                  onChange={(e) => setForm({ ...form, restingHeartRate: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HR Zone Algorithm</label>
                <select
                  value={form.hrZoneAlgorithm ?? HrZoneAlgorithm.FiveZonePercentMax}
                  onChange={(e) => setForm({ ...form, hrZoneAlgorithm: parseInt(e.target.value) as HrZoneAlgorithm })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={HrZoneAlgorithm.FiveZonePercentMax}>5-Zone % of Max HR</option>
                  <option value={HrZoneAlgorithm.FiveZoneKarvonen}>5-Zone Karvonen (HRR)</option>
                  <option value={HrZoneAlgorithm.GarminFiveZone}>Garmin 5-Zone</option>
                  <option value={HrZoneAlgorithm.Custom}>Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                <select
                  value={form.gender ?? Gender.Unknown}
                  onChange={(e) => setForm({ ...form, gender: parseInt(e.target.value) as Gender })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={Gender.Unknown}>Prefer not to say</option>
                  <option value={Gender.Male}>Male</option>
                  <option value={Gender.Female}>Female</option>
                  <option value={Gender.NonBinary}>Non-binary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Birth Date</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1920} max={new Date().getFullYear() - 10}
                    value={form.birthYear ?? ''}
                    onChange={(e) => setForm({ ...form, birthYear: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-24 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Year"
                  />
                  <select
                    value={form.birthMonth ?? ''}
                    onChange={(e) => setForm({ ...form, birthMonth: e.target.value ? parseInt(e.target.value) : null })}
                    className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Month</option>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={form.birthDay ?? ''}
                    onChange={(e) => setForm({ ...form, birthDay: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-20 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {/* HR algorithm info + preview */}
            {(() => {
              const algo = form.hrZoneAlgorithm ?? HrZoneAlgorithm.FiveZonePercentMax;
              const info = HR_ALGORITHM_INFO[algo];
              const maxHr = form.maxHeartRate ?? profile?.maxHeartRate;
              const restingHr = form.restingHeartRate ?? profile?.restingHeartRate ?? 60;
              const preview = maxHr && algo !== HrZoneAlgorithm.Custom
                ? computeZonePreview(algo, maxHr, restingHr)
                : null;

              // Parse existing custom zone uppers from JSON
              const customUppers: (number | '')[] = (() => {
                try {
                  const parsed = JSON.parse(form.customHrZones ?? '[]') as number[];
                  if (Array.isArray(parsed) && parsed.length === 5) return parsed;
                } catch {}
                return ['', '', '', '', ''];
              })();

              return (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{info.description}</p>
                  {algo === HrZoneAlgorithm.Custom ? (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Zone upper boundaries (bpm):</p>
                      <div className="grid grid-cols-5 gap-2">
                        {([1, 2, 3, 4, 5] as const).map((z, i) => (
                          <div key={z}>
                            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1 text-center">Z{z} max</label>
                            <input
                              type="number"
                              min={50} max={220}
                              value={customUppers[i]}
                              onChange={(e) => {
                                const next = [...customUppers];
                                next[i] = e.target.value ? parseInt(e.target.value) : '';
                                setForm({ ...form, customHrZones: JSON.stringify(next) });
                              }}
                              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="—"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : preview ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {preview.map((z, i) => (
                        <div key={z.zone} className="text-center">
                          <div className={`h-1.5 rounded-full ${ZONE_BAR_COLORS[i]} mb-1`} />
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Z{z.zone}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{z.lower}–{z.upper}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {bmi && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Computed BMI: <span className="font-medium text-gray-700 dark:text-gray-200">{bmi}</span></p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profile?.userName && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Username</span>
                <span className="font-medium dark:text-white">@{profile.userName}</span>
              </div>
            )}
            {profile?.displayName && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Name</span>
                <span className="font-medium">{profile.displayName}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-600 dark:text-gray-400">Email</span>
              <span className="font-medium dark:text-white break-all">{user?.email}</span>
            </div>
            {profile?.bio && (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Bio</span>
                <span className="font-medium text-right max-w-xs">{profile.bio}</span>
              </div>
            )}
            {(profile?.weightKg || profile?.heightCm) && (
              <div className="flex flex-wrap gap-6 pt-1">
                {profile.weightKg && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Weight</p>
                    <p className="text-sm font-medium">{profile.weightKg} kg</p>
                  </div>
                )}
                {profile.heightCm && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Height</p>
                    <p className="text-sm font-medium">{profile.heightCm} cm</p>
                  </div>
                )}
                {bmi && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">BMI</p>
                    <p className="text-sm font-medium">{bmi}</p>
                  </div>
                )}
                {profile.maxHeartRate && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Max HR</p>
                    <p className="text-sm font-medium">{profile.maxHeartRate} bpm</p>
                  </div>
                )}
                {profile.restingHeartRate && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Resting HR</p>
                    <p className="text-sm font-medium">{profile.restingHeartRate} bpm</p>
                  </div>
                )}
                {profile.birthYear && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Birth Date</p>
                    <p className="text-sm font-medium">
                      {profile.birthMonth && profile.birthDay
                        ? new Date(profile.birthYear, profile.birthMonth - 1, profile.birthDay)
                            .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                        : profile.birthYear}
                    </p>
                  </div>
                )}
              </div>
            )}
            {profile?.hrZones && profile.hrZones.length > 0 && (
              <HrZoneDisplay zones={profile.hrZones} algorithm={profile.hrZoneAlgorithm} />
            )}
            <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
              <span className="text-gray-600 dark:text-gray-400 pt-1">Strava</span>
              <div className="flex items-start">
                {user?.stravaConnected ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                        ✓ Connected
                      </span>
                      {profile?.stravaSyncStatus && (
                        <button
                          onClick={() => setSyncDialogOpen(true)}
                          title="View sync details"
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Strava sync details"
                        >
                          {profile.stravaSyncStatus.stravaHistoricalSyncComplete ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>100% synced</span>
                            </>
                          ) : (() => {
                            const local = syncStatus?.localActivityCount ?? 0;
                            const total = syncStatus?.stravaApproxTotal ?? null;
                            const pct = total && total > 0 ? Math.round((local / total) * 100) : null;
                            return (
                              <>
                                <svg className="w-3.5 h-3.5 text-yellow-500 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                <span>{pct !== null ? `${pct}% synced` : 'Syncing…'}</span>
                                {total !== null && <span className="text-gray-400 dark:text-gray-500">({local}/{total})</span>}
                              </>
                            );
                          })()}
                        </button>
                      )}
                    </div>
                    <button
                      disabled={syncing}
                      onClick={async () => {
                        setSyncing(true);
                        setSyncMessage(null);
                        try {
                          await authApi.syncStrava();
                          setSyncMessage('Sync started — activities will appear shortly.');
                        } catch {
                          setSyncMessage('Failed to start sync.');
                        } finally {
                          setSyncing(false);
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {syncing ? 'Syncing...' : 'Sync Activities'}
                    </button>
                    {syncMessage && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{syncMessage}</span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const { data } = await authApi.getStravaConnectUrl();
                      window.location.href = data.url;
                    }}
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:opacity-90"
                  >
                    Connect Strava
                  </button>
                )}
              </div>
            </div>

            {/* Strava API Credentials (F1) */}
            <div className="flex flex-wrap items-start justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-700 mt-2">
              <button
                onClick={() => {
                  if (!credOpen) {
                    setCredClientId(stravaCredentials?.clientId ?? '');
                    setCredSecret('');
                    setCredMessage(null);
                  }
                  setCredOpen((v) => !v);
                }}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
              >
                <span>Strava API Credentials</span>
                <span className="text-xs">{credOpen ? '▲' : '▼'}</span>
              </button>
              {credOpen && (
                <div className="w-full mt-2 space-y-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Override the default Strava app credentials stored in server configuration.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Client ID</label>
                      <input
                        type="text"
                        value={credClientId}
                        onChange={(e) => setCredClientId(e.target.value)}
                        placeholder="e.g. 12345"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Client Secret {stravaCredentials?.hasSecret && <span className="text-green-600 dark:text-green-400">(set)</span>}
                      </label>
                      <input
                        type="password"
                        value={credSecret}
                        onChange={(e) => setCredSecret(e.target.value)}
                        placeholder={stravaCredentials?.hasSecret ? '••••••••' : 'Paste secret'}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={credSaving}
                      onClick={async () => {
                        setCredSaving(true);
                        setCredMessage(null);
                        try {
                          await settingsApi.updateStravaCredentials(
                            credClientId || null,
                            credSecret || null,
                          );
                          await refetchCredentials();
                          setCredSecret('');
                          setCredMessage('Saved.');
                        } catch {
                          setCredMessage('Failed to save.');
                        } finally {
                          setCredSaving(false);
                        }
                      }}
                      className="px-4 py-1.5 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {credSaving ? 'Saving…' : 'Save'}
                    </button>
                    {credMessage && <span className="text-sm text-gray-500 dark:text-gray-400">{credMessage}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Type Visibility (F8) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Visible Activity Types</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Unchecked types are hidden from activity lists, statistics, and charts.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {(Object.values(SportType).filter((v) => typeof v === 'number') as SportType[]).map((st) => {
            const hidden: number[] = (() => {
              try { return JSON.parse(profile?.hiddenSportTypes ?? '[]') as number[]; }
              catch { return []; }
            })();
            const isVisible = !hidden.includes(st as number);
            return (
              <label key={st} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={async () => {
                    const next = isVisible
                      ? [...hidden, st as number]
                      : hidden.filter((h) => h !== (st as number));
                    await authApi.updateProfile({ hiddenSportTypes: JSON.stringify(next) });
                    await queryClient.invalidateQueries({ queryKey: ['profile'] });
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {sportTypeName(st as number)}
              </label>
            );
          })}
        </div>
      </div>

      {/* Badges */}
      {badges && badges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Achievements</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.badgeType}
                className="flex flex-col items-center text-center p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-gray-600 transition-colors"
                title={badge.description}
              >
                <span className="text-3xl mb-2">{badge.icon}</span>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{badge.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(badge.earnedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All-time stats */}
      {stats && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All-Time Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard title="Total Distance" value={formatDistance(stats.totalDistance)} icon="📏" />
            <StatCard title="Total Runs" value={String(stats.totalRuns)} icon="🏃" />
            <StatCard title="Total Time" value={formatDuration(stats.totalTimeSeconds)} icon="⏱️" />
            <StatCard title="Avg Pace" value={`${formatPace(stats.averagePaceMinPerKm)} /km`} icon="⚡" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Week Streak"
              value={`${weekStreak} ${weekStreak === 1 ? 'week' : 'weeks'}`}
              icon="🔥"
            />
          </div>
          {stats.firstRunDate && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Running since {formatDate(stats.firstRunDate)} · Last run on{' '}
              {stats.lastRunDate ? formatDate(stats.lastRunDate) : 'N/A'}
            </p>
          )}
        </>
      )}

      {/* Fitness Benchmark */}
      <FitnessBenchmarkSection />

      {/* Running Level */}
      <RunningLevelCard />

      {/* Personal Records */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Running Personal Records</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Road &amp; trail runs only</p>
        </div>
        {prsLoading ? (
          <LoadingSpinner />
        ) : prs && prs.length > 0 ? (
          <PrCategories prs={prs} />
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No personal records yet. Start running to earn some!</p>
        )}
      </div>

      {/* Weight Log */}
      <WeightLogSection goalWeightKg={profile?.goalWeightKg} />

      {/* Strava sync details dialog */}
      {syncDialogOpen && (
        <StravaSyncDialog
          onClose={() => setSyncDialogOpen(false)}
          syncing={syncing}
          onSyncNow={async () => {
            setSyncing(true);
            setSyncMessage(null);
            try {
              await authApi.syncStrava();
              setSyncMessage('Sync started — activities will appear shortly.');
              setSyncDialogOpen(false);
            } catch {
              setSyncMessage('Failed to start sync.');
            } finally {
              setSyncing(false);
            }
          }}
        />
      )}
    </div>
  );
}
