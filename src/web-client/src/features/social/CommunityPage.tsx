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
      <span className="text-sm font-bold text-[#cffc00]">{initial}</span>
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
        className="px-3 py-1 text-xs border border-[#484847]/30 rounded-full text-gray-600 dark:text-[#adaaaa] hover:bg-[#20201f] transition-colors disabled:opacity-50"
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
    <div className="p-6 sm:p-8 min-h-screen bg-[#0e0e0e] text-white sm:py-8">
      <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter uppercase mb-8">Community</h1>

      {/* Tabs */}
      <div className="flex border-b border-[#484847]/20 mb-6">
        {(['feed', 'leaderboard', 'friends'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-500 text-[#cffc00]'
                : 'border-transparent text-[#767575] hover:text-gray-700 dark:text-[#767575] dark:hover:text-gray-200'
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
            <div className="bg-[#20201f] p-8 text-center text-[#767575] dark:text-gray-400">
              No activity yet. Follow some runners to see their activities here!
            </div>
          )}
          {feed?.map((a) => (
            <div key={a.activityId} className="bg-[#20201f] p-4">
              <div className="flex items-center gap-3 mb-3">
                <UserAvatar displayName={a.displayName} pictureUrl={a.profilePictureUrl} />
                <div>
                  <p className="font-label text-sm font-bold text-white">{a.displayName ?? 'Runner'}</p>
                  <p className="text-xs text-[#767575] dark:text-gray-500">{formatDate(a.startDate)} · {sportTypeName(a.sportType)}</p>
                </div>
              </div>
              <Link to={`/activities/${a.activityId}`} className="block hover:text-[#cffc00]">
                <p className="font-semibold text-gray-800 dark:text-[#adaaaa] mb-2">{a.activityName}</p>
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
                    : 'bg-gray-100 dark:bg-[#131313] text-gray-600 dark:text-[#adaaaa] hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {lbLoading && <LoadingSpinner />}
          <div className="bg-[#20201f] border border-[#484847]/30 overflow-hidden">
            {leaderboard?.map((entry, i) => (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-4 py-3 border-b border-[#484847]/20 last:border-0"
              >
                <span className={`w-6 text-sm font-bold ${i < 3 ? 'text-yellow-500' : 'text-[#767575] dark:text-gray-500'}`}>
                  {i + 1}
                </span>
                <UserAvatar displayName={entry.displayName} pictureUrl={entry.profilePictureUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{entry.displayName ?? 'Runner'}</p>
                  <p className="text-xs text-[#767575] dark:text-gray-500">{entry.runCount} run{entry.runCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-bold text-white">{formatDistance(entry.totalDistanceM)}</span>
              </div>
            ))}
            {leaderboard?.length === 0 && (
              <div className="p-8 text-center text-[#767575] dark:text-gray-400">No runs recorded this {period} yet.</div>
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
              className="w-full border border-[#484847]/30 rounded-xl px-4 py-2.5 text-sm bg-[#20201f] dark:text-white focus:outline-none focus:ring-2 focus:border-[#cffc00] focus:outline-none"
            />
            {searchResults && searchResults.length > 0 && (
              <div className="mt-2 bg-[#20201f] border border-[#484847]/30 overflow-hidden">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#484847]/20 last:border-0">
                    <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{u.displayName ?? u.email}</p>
                    </div>
                    <FollowButton userId={u.id} isFollowing={u.isFollowing} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Following */}
          <div>
            <h3 className="text-sm font-semibold text-[#767575] dark:text-[#767575] uppercase tracking-wide mb-2">
              Following ({following?.length ?? 0})
            </h3>
            <div className="bg-[#20201f] border border-[#484847]/30 overflow-hidden">
              {following && following.length === 0 && (
                <div className="p-4 text-sm text-[#767575] dark:text-gray-400">You're not following anyone yet.</div>
              )}
              {following?.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#484847]/20 last:border-0">
                  <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.displayName ?? u.email}</p>
                  </div>
                  <FollowButton userId={u.id} isFollowing={true} />
                </div>
              ))}
            </div>
          </div>

          {/* Followers */}
          <div>
            <h3 className="text-sm font-semibold text-[#767575] dark:text-[#767575] uppercase tracking-wide mb-2">
              Followers ({followers?.length ?? 0})
            </h3>
            <div className="bg-[#20201f] border border-[#484847]/30 overflow-hidden">
              {followers && followers.length === 0 && (
                <div className="p-4 text-sm text-[#767575] dark:text-gray-400">No followers yet.</div>
              )}
              {followers?.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#484847]/20 last:border-0">
                  <UserAvatar displayName={u.displayName} pictureUrl={u.profilePictureUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.displayName ?? u.email}</p>
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



