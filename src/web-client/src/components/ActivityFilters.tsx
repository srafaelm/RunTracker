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
        <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">
          Sport Type
        </label>
        <select
          value={sportType ?? ''}
          onChange={(e) =>
            onSportTypeChange(
              e.target.value !== '' ? (Number(e.target.value) as SportType) : undefined
            )
          }
          className="bg-[#131313] border border-[#484847] text-white px-3 py-2 font-label text-xs focus:border-[#cffc00] focus:outline-none transition-colors"
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
            <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">
              From
            </label>
            <input
              type="date"
              value={from ?? ''}
              onChange={(e) =>
                onDateChange(e.target.value || undefined, to)
              }
              className="bg-[#131313] border border-[#484847] text-white px-3 py-2 font-label text-xs focus:border-[#cffc00] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block font-label text-[10px] uppercase tracking-widest text-[#767575] mb-1.5">
              To
            </label>
            <input
              type="date"
              value={to ?? ''}
              onChange={(e) =>
                onDateChange(from, e.target.value || undefined)
              }
              className="bg-[#131313] border border-[#484847] text-white px-3 py-2 font-label text-xs focus:border-[#cffc00] focus:outline-none transition-colors"
            />
          </div>
        </>
      )}
    </div>
  );
}
