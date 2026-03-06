import type { HrZone } from '../../../types';
import { HrZoneAlgorithm } from '../../../types';

const ZONE_COLORS = [
  { bg: 'bg-sky-200 dark:bg-sky-900', bar: 'bg-sky-400', text: 'text-sky-700 dark:text-sky-300' },
  { bg: 'bg-green-100 dark:bg-green-900', bar: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-yellow-100 dark:bg-yellow-900', bar: 'bg-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-red-100 dark:bg-red-900', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
];

const ALGORITHM_NAMES: Record<HrZoneAlgorithm, string> = {
  [HrZoneAlgorithm.FiveZonePercentMax]: '5-Zone % of Max HR',
  [HrZoneAlgorithm.FiveZoneKarvonen]: '5-Zone Karvonen (HRR)',
  [HrZoneAlgorithm.GarminFiveZone]: 'Garmin 5-Zone',
  [HrZoneAlgorithm.SevenZonePolarized]: '7-Zone Polarized',
  [HrZoneAlgorithm.Custom]: 'Custom',
};

interface HrZoneDisplayProps {
  zones: HrZone[];
  algorithm: HrZoneAlgorithm;
}

export default function HrZoneDisplay({ zones, algorithm }: HrZoneDisplayProps) {
  const displayZones = zones.slice(0, 5);
  if (displayZones.length === 0) return null;

  const maxBpm = Math.max(...displayZones.map((z) => z.upper));

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        HR Zones — {ALGORITHM_NAMES[algorithm]}
      </p>
      <div className="space-y-2">
        {displayZones.map((zone, i) => {
          const colors = ZONE_COLORS[i] ?? ZONE_COLORS[ZONE_COLORS.length - 1];
          const widthPct = maxBpm > 0 ? (zone.upper / maxBpm) * 100 : 0;
          return (
            <div key={zone.zone} className={`rounded-lg px-3 py-2 ${colors.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${colors.text}`}>
                  Z{zone.zone} — {zone.label}
                </span>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {zone.lower}–{zone.upper} bpm
                </span>
              </div>
              <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors.bar}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
