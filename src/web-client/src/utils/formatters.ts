/**
 * Format distance in meters to a human-readable string (km).
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format pace (min/km) to mm:ss format.
 */
export function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || !isFinite(paceMinPerKm))
    return '--:--';
  const totalSeconds = Math.round(paceMinPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to hh:mm:ss.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format elevation in meters.
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

/**
 * Format date to a locale string.
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date with time.
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get sport type display name.
 */
export function sportTypeName(sportType: number): string {
  const names: Record<number, string> = {
    0: 'Run',
    1: 'Trail Run',
    2: 'Walk',
    3: 'Hike',
    4: 'Virtual Run',
    5: 'Ride',
    6: 'Swim',
    7: 'Other',
    8: 'Virtual Ride',
    9: 'Weight Training',
    10: 'Workout',
    11: 'Yoga',
    12: 'Elliptical',
  };
  return names[sportType] ?? 'Other';
}

/**
 * Get record type display name.
 */
export function recordTypeName(recordType: number): string {
  const names: Record<number, string> = {
    0: 'Fastest 1K',
    1: 'Fastest 5K',
    2: 'Fastest 10K',
    3: 'Fastest Half Marathon',
    4: 'Fastest Marathon',
    5: 'Longest Run',
    6: 'Fastest 100m',
    7: 'Fastest 400m',
    8: 'Fastest 800m',
    9: 'Fastest 3K',
    10: 'Fastest 15K',
    11: 'Fastest 30K',
    12: 'Longest Run (Time)',
    13: 'Fastest 2K',
    14: 'Fastest 4K',
    15: 'Fastest 20K',
    16: 'Longest Ride',
    17: 'Longest Swim',
    18: 'Most Elevation',
    19: 'Best Run Cadence',
    20: 'Best Ride Cadence',
  };
  return names[recordType] ?? 'Unknown';
}
