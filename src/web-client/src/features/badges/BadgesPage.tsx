import { useState } from 'react';
import { useAllBadges } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { BadgeWithStatus } from '../../types';

const CATEGORY_ORDER = [
  'Distance Milestones',
  'Total Distance',
  'Runs',
  'Elevation',
  'Cumulative Elevation',
  'Speed',
  'Consistency',
  'Monthly Volume',
  'Habits',
  'Cadence',
  'Calorie Burn',
  'Exploration',
  'Cycling',
  'Swimming',
  'Walking & Hiking',
];

// The BadgeType enum values were assigned non-sequentially, so sortOrder (which equals the enum
// value) doesn't match logical distance order. Map each sortOrder to the correct position.
const DISTANCE_MILESTONE_SORT: Record<number, number> = {
  5:   10,  // First1K
  1:   20,  // First5K
  2:   30,  // First10K
  6:   40,  // First15K
  113: 45,  // First20K
  3:   50,  // First21K (Half Marathon)
  114: 55,  // First25K
  115: 60,  // First30K
  116: 65,  // First35K
  4:   70,  // First42K (Marathon)
  7:   80,  // First50K
  117: 90,  // First75K
  118: 100, // FirstDoubleMarathon
  8:   110, // First100K
  9:   120, // First100Mile
};

function badgeSortKey(b: BadgeWithStatus): number {
  if (b.category === 'Distance Milestones') {
    return DISTANCE_MILESTONE_SORT[b.sortOrder] ?? b.sortOrder;
  }
  return b.sortOrder;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function BadgeModal({ badge, onClose }: { badge: BadgeWithStatus; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`text-7xl mb-4 ${!badge.isEarned ? 'grayscale opacity-40' : ''}`}
        >
          {badge.icon}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
          {badge.category}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {badge.name}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          {badge.description}
        </p>
        {badge.isEarned ? (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-4 py-1.5 text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Earned {badge.earnedAt ? formatDate(badge.earnedAt) : ''}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-4 py-1.5 text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Not yet earned
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function BadgeCard({ badge, onClick }: { badge: BadgeWithStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center text-center p-4 rounded-xl border transition-all cursor-pointer group
        ${badge.isEarned
          ? 'border-amber-200 dark:border-amber-700 bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
    >
      {/* Earned ribbon */}
      {badge.isEarned && (
        <div className="absolute top-0 right-0 overflow-hidden w-16 h-16 pointer-events-none">
          <div className="absolute top-3 -right-4 rotate-45 bg-green-500 text-white text-[9px] font-bold px-5 py-0.5 shadow-sm">
            EARNED
          </div>
        </div>
      )}

      {/* Icon */}
      <div className={`text-4xl mb-2 transition-transform group-hover:scale-110 ${!badge.isEarned ? 'grayscale opacity-40' : ''}`}>
        {badge.icon}
      </div>

      {/* Name */}
      <p className={`text-xs font-semibold leading-tight mb-1 ${badge.isEarned ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
        {badge.name}
      </p>

      {/* Date or locked */}
      {badge.isEarned && badge.earnedAt ? (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
          {formatDate(badge.earnedAt)}
        </p>
      ) : (
        <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )}
    </button>
  );
}

export default function BadgesPage() {
  const { data: badges, isLoading } = useAllBadges();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null);

  if (isLoading) return <LoadingSpinner size="lg" />;

  const allBadges = badges ?? [];
  const earnedCount = allBadges.filter((b) => b.isEarned).length;
  const totalCount = allBadges.length;

  const categories = ['All', ...CATEGORY_ORDER.filter((c) => allBadges.some((b) => b.category === c))];

  const filtered = activeCategory === 'All'
    ? [...allBadges].sort((a, b) => {
        const ci = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        return ci !== 0 ? ci : badgeSortKey(a) - badgeSortKey(b);
      })
    : [...allBadges]
        .filter((b) => b.category === activeCategory)
        .sort((a, b) => badgeSortKey(a) - badgeSortKey(b));

  // Group by category when showing all
  const groups: { category: string; items: BadgeWithStatus[] }[] = activeCategory === 'All'
    ? CATEGORY_ORDER
        .filter((c) => filtered.some((b) => b.category === c))
        .map((c) => ({ category: c, items: filtered.filter((b) => b.category === c) }))
    : [{ category: activeCategory, items: filtered }];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Badges</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {earnedCount} of {totalCount} earned
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3 min-w-48">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 shrink-0">
            {totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => {
          const count = cat === 'All' ? earnedCount : allBadges.filter((b) => b.category === cat && b.isEarned).length;
          const total = cat === 'All' ? totalCount : allBadges.filter((b) => b.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
              <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                {count}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Badge groups */}
      {groups.map(({ category, items }) => (
        <div key={category} className="mb-8">
          {activeCategory === 'All' && (
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
              {category}
            </h2>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {items.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                onClick={() => setSelectedBadge(badge)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Detail modal */}
      {selectedBadge && (
        <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </div>
  );
}
