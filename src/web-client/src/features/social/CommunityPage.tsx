import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useFollowing, useFollowers, useLeaderboard, useFriendFeed,
  useUserSearch, useFollowUser, useUnfollowUser,
} from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDistance, formatDuration, formatPace, formatDate, sportTypeName } from '../../utils/formatters';

type Tab = 'feed' | 'leaderboard' | 'friends';
type LeaderboardPeriod = 'weekly' | 'monthly' | 'yearly';

function UserAvatar({ displayName, pictureUrl, size = 8 }: { displayName?: string | null; pictureUrl?: string | null; size?: number }) {
  const initial = (displayName ?? '?')[0].toUpperCase();
  if (pictureUrl) {
    return <img src={pictureUrl} alt={displayName ?? ''} className={`w-${size} h-${size} rounded-full object-cover`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center`}>
      <span className="text-sm font-bold text-primary-600">{initial}</span>
    </div>
  );
}

function FollowButton({ userId, isFollowing }: { userId: string; isFollowing: boolean }) {
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  const loading = follow.isPending || unfollow.isPending;

  if (isFollowing) {
    return (
      <button
        onClick={() => unfollow.mutate(userId)}
        disabled={loading}
        className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        Following
      </button>
    );
  }
  return (
    <button
      onClick={() => follow.mutate(userId)}
      disabled={loading}
      className="px-3 py-1 text-xs bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50"
    >
      Follow
    </button>
  );
}

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('feed');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [searchQ, setSearchQ] = useState('');

  const { data: feed, isLoading: feedLoading } = useFriendFeed();
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard(period);
  const { data: following } = useFollowing();
  const { data: followers } = useFollowers();
  const { data: searchResults } = useUserSearch(searchQ);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">Community</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {(['feed', 'leaderboard', 'friends'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t === 'feed' ? 'Activity Feed' : t === 'leaderboard' ? 'Leaderboard' : 'Friends'}
          </button>
        ))}
      </div>

      {/* Feed Tab */}
      {tab === 'feed' && (
        <div className="space-y-4">
          {feedLoading && <LoadingSpinner />}
          {feed && feed.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
              No activity yet. Follow some runners to see their activities here!
            </div>
          )}
          {feed?.map((a) => (
            <div key={a.activityId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3 mb-3">
                <UserAvatar displayName={a.displayName} pictureUrl={a.profilePictureUrl} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{a.displayName ?? 'Runner'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(a.startDate)} · {sportTypeName(a.sportType)}</p>
                </div>
              </div>
              <Link to={`/activities/${a.activityId}`} className="block hover:text-primary-600">
                <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{a.activityName}</p>
              </Link>
              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{formatDistance(a.distance)}</span>
                <span>·</span>
                <span>{formatDuration(a.movingTime)}</span>
                <span>·</span>
                <span>{formatPace(a.averagePaceMinPerKm)} /km</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          <div className="flex gap-2 mb-4">
            {(['weekly', 'monthly', 'yearly'] as LeaderboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
                  period === p
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {lbLoading && <LoadingSpinner />}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {leaderboard?.map((entry, i) => (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className={`w-6 text-sm font-bold ${i < 3 ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {i + 1}
                </span>
                <UserAvatar displayName={entry.displayName} pictureUrl={entry.profilePictureUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.displayName ?? 'Runner'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{entry.runCount} run{entry.runCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDistance(entry.totalDistanceM)}</span>
              </div>
            ))}
            {leaderboard?.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">No runs recorded this {period} yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Friends Tab */}
      {tab === 'friends' && (
        <div className="space-y-6">
          {/* Search */}
          <div>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search runners by name or email…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {searchResults && searchResults.length > 0 && (
              <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.displayName ?? u.email}</p>
                    </div>
                    <FollowButton userId={u.id} isFollowing={u.isFollowing} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Following */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Following ({following?.length ?? 0})
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {following && following.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">You're not following anyone yet.</div>
              )}
              {following?.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.displayName ?? u.email}</p>
                  </div>
                  <FollowButton userId={u.id} isFollowing={true} />
                </div>
              ))}
            </div>
          </div>

          {/* Followers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Followers ({followers?.length ?? 0})
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {followers && followers.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No followers yet.</div>
              )}
              {followers?.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.displayName ?? u.email}</p>
                  </div>
                  <FollowButton userId={u.id} isFollowing={u.isFollowing} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
