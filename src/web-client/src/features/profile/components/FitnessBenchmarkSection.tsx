import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { benchmarkApi } from '../../../api/client';
import type { BenchmarkItem, BenchmarkHistoryEntry } from '../../../types';

const CATEGORIES = ['Running', 'Cycling', 'Strength', 'Weight', 'Other'];

function isCompletedToday(lastCompletedAt: string | null): boolean {
  if (!lastCompletedAt) return false;
  const last = new Date(lastCompletedAt);
  const now = new Date();
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  );
}

function isCompletedRecently(lastCompletedAt: string | null): boolean {
  if (!lastCompletedAt) return false;
  const last = new Date(lastCompletedAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return last >= sevenDaysAgo;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatHistoryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FitnessBenchmarkSection() {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['benchmarkItems'],
    queryFn: () => benchmarkApi.getItems().then((r) => r.data),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['benchmarkHistory'],
    queryFn: () => benchmarkApi.getHistory().then((r) => r.data),
    enabled: showHistory,
  });

  const createItem = useMutation({
    mutationFn: () => benchmarkApi.createItem({ name: newName.trim(), category: newCategory || undefined, sortOrder: items.length }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmarkItems'] });
      setNewName('');
      setNewCategory('');
      setShowAddForm(false);
    },
  });

  const updateItem = useMutation({
    mutationFn: (item: BenchmarkItem) =>
      benchmarkApi.updateItem(item.id, { name: editName.trim(), category: editCategory || undefined, sortOrder: item.sortOrder, isActive: item.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmarkItems'] });
      setEditingId(null);
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => benchmarkApi.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmarkItems'] }),
  });

  const logCompletion = useMutation({
    mutationFn: ({ itemId, date }: { itemId: string; date: string }) =>
      benchmarkApi.logCompletion(itemId, { date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmarkItems'] });
      qc.invalidateQueries({ queryKey: ['benchmarkHistory'] });
      setCompletingId(null);
    },
  });

  const deleteCompletion = useMutation({
    mutationFn: (completionId: string) => benchmarkApi.deleteCompletion(completionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmarkItems'] });
      qc.invalidateQueries({ queryKey: ['benchmarkHistory'] });
    },
  });

  const activeItems = items.filter((i) => i.isActive);
  const recentlyCompleted = activeItems.filter((i) => isCompletedRecently(i.lastCompletedAt)).length;
  const progressPct = activeItems.length > 0 ? (recentlyCompleted / activeItems.length) * 100 : 0;

  // Group by category
  const grouped: Record<string, BenchmarkItem[]> = {};
  for (const item of items) {
    const cat = item.category ?? 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const startEdit = (item: BenchmarkItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category ?? '');
  };

  return (
    <div className="bg-[#20201f]-sm border border-[#484847]/30 p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Fitness Benchmark</h2>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="text-sm text-[#cffc00] dark:text-primary-400 hover:text-primary-700 font-medium"
        >
          + Add Item
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-[#131313] rounded-lg flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-[#767575] dark:text-[#767575] mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. 10km in 50 min"
              className="w-full border border-[#484847]/30 dark:bg-[#20201f] dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
              autoFocus
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-[#767575] dark:text-[#767575] mb-1">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full border border-[#484847]/30 dark:bg-[#20201f] dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
            >
              <option value="">None</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            onClick={() => createItem.mutate()}
            disabled={!newName.trim() || createItem.isPending}
            className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewName(''); setNewCategory(''); }}
            className="px-3 py-1.5 text-gray-600 dark:text-[#adaaaa] text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-[#767575] dark:text-[#767575] py-4 text-center">Loading...</div>
      )}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-[#767575] dark:text-[#767575] py-2">
          No benchmark items yet. Add items to track your fitness milestones.
        </p>
      )}

      {/* Progress bar */}
      {activeItems.length > 0 && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-[#767575] dark:text-[#767575] mb-1">
            <span>{recentlyCompleted} / {activeItems.length} completed recently (last 7 days)</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items grouped by category */}
      {Object.keys(grouped).sort().map((cat) => (
        <div key={cat} className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#767575] dark:text-[#767575] mb-2">{cat}</h3>
          <div className="space-y-1">
            {grouped[cat].map((item) => {
              const completedToday = isCompletedToday(item.lastCompletedAt);
              const completedRecently = isCompletedRecently(item.lastCompletedAt);
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <div key={item.id} className="flex flex-wrap gap-2 items-center p-2 bg-gray-50 dark:bg-[#131313] rounded">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-32 border border-[#484847]/30 dark:bg-[#20201f] dark:text-gray-100 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-32 border border-[#484847]/30 dark:bg-[#20201f] dark:text-gray-100 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
                    >
                      <option value="">None</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={() => updateItem.mutate(item)}
                      disabled={!editName.trim() || updateItem.isPending}
                      className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-gray-600 dark:text-[#adaaaa] text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg group ${completedRecently ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-[#20201f] transition-colors/50'}`}
                >
                  {/* Checkbox indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${completedRecently ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500'}`}>
                    {completedRecently && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Name */}
                  <span
                    className={`flex-1 text-sm cursor-pointer ${completedRecently ? 'text-gray-700 dark:text-gray-200' : 'text-gray-600 dark:text-gray-300'}`}
                    onDoubleClick={() => startEdit(item)}
                    title="Double-click to edit"
                  >
                    {item.name}
                  </span>

                  {/* Last completed */}
                  {item.lastCompletedAt && (
                    <span className="text-xs text-[#767575] dark:text-[#767575] hidden sm:block">
                      {completedToday ? 'Today' : formatDate(item.lastCompletedAt)}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {completedToday && item.lastCompletionId ? (
                      <button
                        onClick={() => deleteCompletion.mutate(item.lastCompletionId!)}
                        disabled={deleteCompletion.isPending}
                        className="text-xs text-orange-500 hover:text-orange-600 px-1.5 py-0.5 rounded border border-orange-300 dark:border-orange-600 whitespace-nowrap"
                        title="Undo today's completion"
                      >
                        Undo
                      </button>
                    ) : completingId === item.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          value={completionDate}
                          onChange={(e) => setCompletionDate(e.target.value)}
                          max={new Date().toISOString().slice(0, 10)}
                          className="border border-[#484847]/30 dark:bg-[#131313] dark:text-gray-100 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:border-[#cffc00] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => logCompletion.mutate({ itemId: item.id, date: completionDate })}
                          disabled={logCompletion.isPending}
                          className="text-xs text-[#cffc00] dark:text-primary-400 hover:text-primary-700 px-1.5 py-0.5 rounded border border-primary-300 dark:border-primary-600 whitespace-nowrap"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setCompletingId(null)}
                          className="text-xs text-[#767575] hover:text-gray-700 dark:text-[#767575] px-1 py-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setCompletingId(item.id); setCompletionDate(new Date().toISOString().slice(0, 10)); }}
                        className="text-xs text-[#cffc00] dark:text-primary-400 hover:text-primary-700 px-1.5 py-0.5 rounded border border-primary-300 dark:border-primary-600 whitespace-nowrap"
                        title="Mark as done"
                      >
                        Done
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      className="text-[#767575] hover:text-gray-600 dark:hover:text-[#adaaaa] p-0.5"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem.mutate(item.id); }}
                      className="text-[#767575] hover:text-red-500 dark:hover:text-red-400 p-0.5"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* History toggle */}
      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#484847]/20">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-[#767575] dark:text-[#767575] hover:text-gray-700 dark:hover:text-[#adaaaa] flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {showHistory ? 'Hide History' : 'View History'}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {historyLoading && (
                <div className="text-sm text-[#767575] dark:text-gray-500">Loading history...</div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="text-sm text-[#767575] dark:text-gray-500">No history yet.</div>
              )}
              {history.map((entry: BenchmarkHistoryEntry) => (
                <div key={entry.date} className="flex items-start gap-3 text-sm">
                  <span className="text-[#767575] dark:text-[#767575] w-28 flex-shrink-0 text-xs">
                    {formatHistoryDate(entry.date)}
                  </span>
                  <span className="font-medium text-gray-700 dark:text-[#adaaaa] w-12 flex-shrink-0">
                    {entry.completedCount}/{entry.totalActive}
                  </span>
                  <span className="text-[#767575] dark:text-[#767575] text-xs leading-relaxed">
                    {entry.completedItemNames.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



