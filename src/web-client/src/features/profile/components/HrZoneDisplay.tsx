import type { HrZone } from '../../../types';
import { HrZoneAlgorithm } from '../../../types';

const ZONE_COLORS = [
  { bg: 'bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20', bar: 'bg-sky-400', text: 'text-sky-300' },
  { bg: 'bg-green-500/10 dark:bg-green-500/15 border border-green-500/20', bar: 'bg-green-400', text: 'text-green-300' },
  { bg: 'bg-yellow-500/10 dark:bg-yellow-500/15 border border-yellow-500/20', bar: 'bg-yellow-400', text: 'text-yellow-300' },
  { bg: 'bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20', bar: 'bg-orange-400', text: 'text-orange-300' },
  { bg: 'bg-red-500/10 dark:bg-red-500/15 border border-red-500/20', bar: 'bg-red-400', text: 'text-red-300' },
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

  const minBpm = Math.min(...displayZones.map((z) => z.lower));
  const maxBpm = Math.max(...displayZones.map((z) => z.upper));
  const range = maxBpm - minBpm || 1;

  return (
    <div className="mt-4 max-w-lg">
      <p className="text-xs font-semibold text-[#767575] dark:text-[#767575] uppercase tracking-wider mb-3">
        HR Zones — {ALGORITHM_NAMES[algorithm]}
      </p>
      <div className="space-y-1.5">
        {displayZones.map((zone, i) => {
          const colors = ZONE_COLORS[i] ?? ZONE_COLORS[ZONE_COLORS.length - 1];
          // Bar width based on zone range relative to total range, offset from left
          const leftPct = ((zone.lower - minBpm) / range) * 100;
          const widthPct = ((zone.upper - zone.lower) / range) * 100;
          return (
            <div key={zone.zone} className={`rounded-lg px-3 py-2 ${colors.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold ${colors.text}`}>
                  Z{zone.zone} — {zone.label}
                </span>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {zone.lower}–{zone.upper} bpm
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors.bar}`}
                  style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


