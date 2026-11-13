import { DISTRICTS } from '../../shared/categories.ts';
import { type Filters as FilterState, isoDaysAgo } from '../lib/filter.ts';

interface Props {
  value: FilterState;
  minDate: string;
  maxDate: string;
  onChange: (next: FilterState) => void;
}

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '1 year', days: 365 },
] as const;

export function Filters({ value, minDate, maxDate, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const activePreset = PRESETS.find((p) => value.to === maxDate && value.from === isoDaysAgo(p.days, new Date(maxDate)));
  const isAll = value.from === minDate && value.to === maxDate;

  return (
    <div className="filters">
      <div className="presets" role="group" aria-label="Time range">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            aria-pressed={activePreset === p}
            onClick={() => set({ from: isoDaysAgo(p.days, new Date(maxDate)), to: maxDate })}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={isAll} onClick={() => set({ from: minDate, to: maxDate })}>
          All
        </button>
      </div>

      <div className="row">
        <label>
          From
          <input type="date" value={value.from} min={minDate} max={value.to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={value.to} min={value.from} max={maxDate} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </label>
      </div>

      <div className="row">
        <label className="grow">
          District
          <select value={value.district} onChange={(e) => set({ district: e.target.value })}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="search">
        <span className="visually-hidden">Search</span>
        <input type="search" placeholder="Search, e.g. Hermannplatz or Messer" value={value.query} onChange={(e) => set({ query: e.target.value })} />
      </label>
    </div>
  );
}
