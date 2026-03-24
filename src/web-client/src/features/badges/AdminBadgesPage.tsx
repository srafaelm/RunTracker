import { useState } from 'react';
import { useAdminBadges, useArchiveBadge, useUnarchiveBadge, useUpdateBadgeSortOrder } from '../../hooks/useQueries';
import type { BadgeAdmin } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminBadgesPage() {
  const { data: badges, isLoading } = useAdminBadges();
  const archiveMutation = useArchiveBadge();
  const unarchiveMutation = useUnarchiveBadge();
  const sortOrderMutation = useUpdateBadgeSortOrder();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(true);
  const [editingSortOrder, setEditingSortOrder] = useState<Record<number, string>>({});

  if (isLoading) return <LoadingSpinner size="lg" />;

  const allBadges = badges ?? [];
  const categories = ['All', ...Array.from(new Set(allBadges.map((b) => b.category))).sort()];

  const filtered = allBadges.filter((b) => {
    if (!showArchived && b.isArchived) return false;
    if (categoryFilter !== 'All' && b.category !== categoryFilter) return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleSortOrderBlur(badge: BadgeAdmin) {
    const raw = editingSortOrder[badge.id];
    if (raw === undefined) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val !== badge.sortOrder) {
      sortOrderMutation.mutate({ id: badge.id, sortOrder: val });
    }
    setEditingSortOrder((prev) => {
      const next = { ...prev };
      delete next[badge.id];
      return next;
    });
  }

  return (
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Badge Management</h1>
        <p className="text-sm text-[#767575] dark:text-[#767575] mt-1">
          {allBadges.filter((b) => !b.isArchived).length} active · {allBadges.filter((b) => b.isArchived).length} archived
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search badges…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#484847]/30 bg-[#20201f] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none w-48"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#484847]/30 bg-[#20201f] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#484847]/30 bg-[#20201f] text-sm text-gray-700 dark:text-[#adaaaa] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
      </div>

      {/* Table */}
      <div className="bg-[#20201f] border border-[#484847]/30 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#484847]/20 bg-gray-50 dark:bg-[#0e0e0e]/50">
              <th className="text-left px-4 py-3 font-semibold text-[#767575] dark:text-[#767575] w-10">Icon</th>
              <th className="text-left px-4 py-3 font-semibold text-[#767575] dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-[#767575] dark:text-[#767575] hidden md:table-cell">Category</th>
              <th className="text-center px-4 py-3 font-semibold text-[#767575] dark:text-[#767575] w-24">Sort Order</th>
              <th className="text-center px-4 py-3 font-semibold text-[#767575] dark:text-[#767575] w-24">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-[#767575] dark:text-[#767575] w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#484847]/10/50">
            {filtered.map((badge) => (
              <tr
                key={badge.id}
                className={`transition-colors ${badge.isArchived ? 'opacity-50' : 'hover:bg-[#20201f] transition-colors/30'}`}
              >
                <td className="px-4 py-3 text-xl">{badge.icon}</td>
                <td className="px-4 py-3">
                  <div className="font-bold text-white">{badge.name}</div>
                  <div className="text-xs text-[#767575] dark:text-[#767575] mt-0.5 hidden sm:block">{badge.description}</div>
                </td>
                <td className="px-4 py-3 text-[#767575] dark:text-[#767575] hidden md:table-cell">{badge.category}</td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    value={editingSortOrder[badge.id] ?? badge.sortOrder}
                    onChange={(e) =>
                      setEditingSortOrder((prev) => ({ ...prev, [badge.id]: e.target.value }))
                    }
                    onBlur={() => handleSortOrderBlur(badge)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSortOrderBlur(badge)}
                    className="w-16 text-center px-2 py-1 rounded border border-[#484847]/30 bg-[#20201f] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      badge.isArchived
                        ? 'bg-gray-100 dark:bg-[#131313] text-[#767575] dark:text-gray-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {badge.isArchived ? 'Archived' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {badge.isArchived ? (
                    <button
                      onClick={() => unarchiveMutation.mutate(badge.id)}
                      disabled={unarchiveMutation.isPending}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => archiveMutation.mutate(badge.id)}
                      disabled={archiveMutation.isPending}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-[#131313] text-gray-600 dark:text-[#767575] hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#767575] dark:text-gray-500">
                  No badges match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



