import { useState } from 'react';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useGoalHistory } from '../../hooks/useQueries';
import { GoalPeriod, SportType } from '../../types';
import type { Goal } from '../../types';
import { sportTypeName } from '../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  [GoalPeriod.Week]: 'Weekly',
  [GoalPeriod.Month]: 'Monthly',
  [GoalPeriod.Year]: 'Yearly',
};

function getYtdProjection(goal: Goal): { projected: number; status: 'ahead' | 'on-pace' | 'behind' } | null {
  if (goal.period !== GoalPeriod.Year) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const elapsed = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  if (elapsed <= 0) return null;
  const projected = +(goal.currentDistanceKm / elapsed).toFixed(1);
  const expected = goal.targetDistanceKm * elapsed;
  const diff = (goal.currentDistanceKm - expected) / goal.targetDistanceKm;
  const status = diff >= 0.02 ? 'ahead' : diff >= -0.02 ? 'on-pace' : 'behind';
  return { projected, status };
}

function GoalProgressBar({ goal }: { goal: Goal }) {
  const pct = Math.min(100, goal.progressPct);
  const isComplete = pct >= 100;
  const sportLabel = goal.sportType != null ? sportTypeName(goal.sportType) : 'All Sports';
  const projection = getYtdProjection(goal);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {PERIOD_LABELS[goal.period]} · {sportLabel}
        </span>
        <span className={`font-semibold ${isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
          {goal.currentDistanceKm.toFixed(1)} / {goal.targetDistanceKm} km
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        {projection ? (
          <span className={`text-xs font-medium ${projection.status === 'ahead' ? 'text-green-600 dark:text-green-400' : projection.status === 'on-pace' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
            {projection.status === 'ahead' ? '↑ Ahead' : projection.status === 'on-pace' ? '→ On Pace' : '↓ Behind'} · proj. {projection.projected} km
          </span>
        ) : <span />}
        <p className="text-xs text-gray-400 dark:text-gray-500">{pct.toFixed(0)}%</p>
      </div>
    </div>
  );
}

export default function GoalsWidget() {
  const { data: goals = [] } = useGoals();
  const { data: history } = useGoalHistory();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [form, setForm] = useState({ sportType: '', period: String(GoalPeriod.Week), target: '' });

  const handleCreate = () => {
    const t = parseFloat(form.target);
    if (!t || t <= 0) return;
    createGoal.mutate({
      sportType: form.sportType !== '' ? parseInt(form.sportType) : null,
      period: parseInt(form.period),
      targetDistanceKm: t,
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ sportType: '', period: String(GoalPeriod.Week), target: '' });
      },
    });
  };

  const handleUpdate = (id: string) => {
    const t = parseFloat(editValue);
    if (!t || t <= 0) return;
    updateGoal.mutate({ id, targetDistanceKm: t }, { onSuccess: () => setEditId(null) });
  };

  return (
    <div className="bg-[#20201f] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Goals</h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="px-3 py-1 text-xs font-medium rounded-lg border border-primary-600 text-[#cffc00] hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
              className="flex-1 min-w-[100px] text-sm rounded border border-[#484847]/30 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
            >
              <option value={String(GoalPeriod.Week)}>Weekly</option>
              <option value={String(GoalPeriod.Month)}>Monthly</option>
              <option value={String(GoalPeriod.Year)}>Yearly</option>
            </select>
            <select
              value={form.sportType}
              onChange={e => setForm(f => ({ ...f, sportType: e.target.value }))}
              className="flex-1 min-w-[100px] text-sm rounded border border-[#484847]/30 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
            >
              <option value="">All Sports</option>
              {Object.entries(SportType).filter(([k]) => isNaN(Number(k))).map(([label, val]) => (
                <option key={val} value={String(val)}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Target km"
              value={form.target}
              onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              className="flex-1 min-w-[90px] text-sm rounded border border-[#484847]/30 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={createGoal.isPending}
            className="w-full py-1.5 text-sm font-medium rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            Save Goal
          </button>
        </div>
      )}

      {goals.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No goals set. Click "+ Add Goal" to get started.
        </p>
      )}

      <div className="space-y-4">
        {goals.map(goal => (
          <div key={goal.id}>
            {editId === goal.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="flex-1 text-sm rounded border border-[#484847]/30 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
                />
                <button onClick={() => handleUpdate(goal.id)} className="text-xs text-[#cffc00] font-medium">Save</button>
                <button onClick={() => setEditId(null)} className="font-label text-[10px] text-[#767575]">Cancel</button>
              </div>
            ) : (
              <div className="group relative">
                <GoalProgressBar goal={goal} />
                <div className="absolute top-0 right-0 hidden group-hover:flex gap-1">
                  <button
                    onClick={() => { setEditId(goal.id); setEditValue(String(goal.targetDistanceKm)); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteGoal.mutate(goal.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Monthly achievement history chart (only shown if monthly goals exist) */}
      {history && history.months.some(m => m.goalsTotal > 0) && (
        <div className="mt-5 pt-4 border-t border-[#484847]/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Monthly goal achievement (last 12 months)</p>
            {history.consecutiveStreak > 0 && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                🔥 {history.consecutiveStreak} month streak
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={history.months} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Goals met']} labelFormatter={l => l} />
              <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
                {history.months.map((m, i) => (
                  <Cell key={i} fill={m.goalsTotal === 0 ? '#d1d5db' : m.pct >= 100 ? '#22c55e' : m.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


