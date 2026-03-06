import { useEffect, useState } from 'react';
import { authApi } from '../api/client';
import type { StravaSyncDetail } from '../types';

interface Props {
  onClose: () => void;
  onSyncNow: () => void;
  syncing: boolean;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function StravaSyncDialog({ onClose, onSyncNow, syncing }: Props) {
  const [detail, setDetail] = useState<StravaSyncDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.getSyncStatus()
      .then(r => setDetail(r.data))
      .catch(() => {/* show partial info from profile fallback */})
      .finally(() => setLoading(false));
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const complete = detail?.stravaHistoricalSyncComplete ?? false;
  const localCount = detail?.localActivityCount ?? null;
  const approxTotal = detail?.stravaApproxTotal ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Strava Sync Status</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="w-6 h-6 text-blue-500" />
            </div>
          ) : (
            <>
              {/* Historical sync status row */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {complete ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                      <Spinner className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {complete ? 'Full history synced' : 'Historical sync in progress'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {complete
                      ? 'All past Strava activities have been imported.'
                      : detail?.stravaHistoricalSyncCursor
                        ? `Synced back to ${fmt(detail.stravaHistoricalSyncCursor)}. Resumes automatically on next app start.`
                        : 'Starting — activities will appear shortly.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700" />

              {/* Activity count comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Imported here</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {localCount != null ? localCount.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    On Strava
                    <span className="ml-1 text-gray-400 dark:text-gray-500" title="Run + ride + swim only. Other sports (hiking, walking, etc.) are not included in Strava's stats API.">~</span>
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {approxTotal != null ? approxTotal.toLocaleString() : '—'}
                  </p>
                  {approxTotal != null && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      run · ride · swim only
                    </p>
                  )}
                </div>
              </div>

              {/* Strava sport breakdown */}
              {detail && (detail.stravaRunCount != null || detail.stravaRideCount != null || detail.stravaSwimCount != null) && (
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {detail.stravaRunCount != null && (
                    <span>🏃 {detail.stravaRunCount.toLocaleString()} runs</span>
                  )}
                  {detail.stravaRideCount != null && (
                    <span>🚴 {detail.stravaRideCount.toLocaleString()} rides</span>
                  )}
                  {detail.stravaSwimCount != null && (
                    <span>🏊 {detail.stravaSwimCount.toLocaleString()} swims</span>
                  )}
                </div>
              )}

              {/* Latest synced + note */}
              {detail?.stravaNewestSyncedAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Latest synced activity: <span className="font-medium">{fmt(detail.stravaNewestSyncedAt)}</span>
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500">
                New activities sync automatically via webhook. Use the button below to pull any that were missed.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSyncNow}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <><Spinner className="w-4 h-4" />Syncing…</>
            ) : 'Sync New Activities'}
          </button>
        </div>
      </div>
    </div>
  );
}
