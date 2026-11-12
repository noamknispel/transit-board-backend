import { DAY_LETTERS } from '../schedule';

interface TimeWindowFieldsProps {
  days: number[];
  start: string;
  end: string;
  onChange: (update: { days?: number[]; start?: string; end?: string }) => void;
  /** Fires when a time input loses focus, for callers that save on commit */
  onTimeBlur?: () => void;
  disabled?: boolean;
  idPrefix: string;
}

/** Day-of-week toggles and a from/until pair, shared by widget and display schedules. */
export function TimeWindowFields({ days, start, end, onChange, onTimeBlur, disabled, idPrefix }: TimeWindowFieldsProps) {
  const toggleDay = (day: number) => {
    onChange({ days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DAY_LETTERS.map((letter, day) => (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggleDay(day)}
            className={`h-8 w-8 rounded-full text-xs font-semibold disabled:cursor-not-allowed ${
              days.includes(day) ? 'bg-accent-cyan/25 text-accent-cyan' : 'bg-ops-800 text-ops-300 hover:bg-ops-700'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-start`} className="tb-label">From</label>
          <input
            id={`${idPrefix}-start`}
            type="time"
            value={start}
            disabled={disabled}
            onChange={(e) => onChange({ start: e.target.value })}
            onBlur={onTimeBlur}
            className="tb-input"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-end`} className="tb-label">Until</label>
          <input
            id={`${idPrefix}-end`}
            type="time"
            value={end}
            disabled={disabled}
            onChange={(e) => onChange({ end: e.target.value })}
            onBlur={onTimeBlur}
            className="tb-input"
          />
        </div>
      </div>
    </div>
  );
}
