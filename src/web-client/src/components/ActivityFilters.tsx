import { SportType } from '../types';
import { sportTypeName } from '../utils/formatters';

const sportTypeOptions = Object.values(SportType).filter(
  (v) => typeof v === 'number'
) as SportType[];

interface ActivityFiltersProps {
  sportType: SportType | undefined;
  onSportTypeChange: (value: SportType | undefined) => void;
  from?: string;
  to?: string;
  onDateChange?: (from: string | undefined, to: string | undefined) => void;
  showDateRange?: boolean;
}

export default function ActivityFilters({
  sportType,
  onSportTypeChange,
  from,
  to,
  onDateChange,
  showDateRange = false,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Sport type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Sport Type
        </label>
        <select
          value={sportType ?? ''}
          onChange={(e) =>
            onSportTypeChange(
              e.target.value !== '' ? (Number(e.target.value) as SportType) : undefined
            )
          }
          className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All types</option>
          {sportTypeOptions.map((st) => (
            <option key={st} value={st}>
              {sportTypeName(st)}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      {showDateRange && onDateChange && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              From
            </label>
            <input
              type="date"
              value={from ?? ''}
              onChange={(e) =>
                onDateChange(e.target.value || undefined, to)
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              To
            </label>
            <input
              type="date"
              value={to ?? ''}
              onChange={(e) =>
                onDateChange(from, e.target.value || undefined)
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
        </>
      )}
    </div>
  );
}
