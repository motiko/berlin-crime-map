import { CATEGORIES, CATEGORY_META, DISTRICTS } from '../../shared/categories.ts';
import { type Filters as FilterState, formatDate, isoDaysAgo } from '../lib/filter.ts';

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

function presetOf(value: FilterState, minDate: string, maxDate: string): string | null {
  if (value.to !== maxDate) return null;
  if (value.from === minDate) return 'All';
  return PRESETS.find((p) => value.from === isoDaysAgo(p.days, maxDate))?.label ?? null;
}

/** 7 days / 30 days / 1 year / All. Always visible in the filter bar. */
export function TimeRange({ value, minDate, maxDate, onChange }: Props) {
  const active = presetOf(value, minDate, maxDate);
  const set = (from: string) => onChange({ ...value, from, to: maxDate });
  return (
    <div className="presets" role="group" aria-label="Time range">
      {PRESETS.map((p) => (
        <button key={p.label} type="button" className="chip" aria-pressed={active === p.label} onClick={() => set(isoDaysAgo(p.days, maxDate))}>
          {p.label}
        </button>
      ))}
      <button type="button" className="chip" aria-pressed={active === 'All'} onClick={() => set(minDate)}>
        All
      </button>
    </div>
  );
}

export function SearchBox({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  return (
    <label className="search">
      <span className="visually-hidden">Search</span>
      <input
        type="search"
        name="q"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search, e.g. Hermannplatz or Messer…"
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
    </label>
  );
}

/** Exact dates and district: inside the Filters panel. */
export function DateAndDistrict({ value, minDate, maxDate, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  return (
    <div className="filters">
      <div className="row">
        <label>
          From
          <input type="date" name="from" value={value.from} min={minDate} max={value.to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" name="to" value={value.to} min={value.from} max={maxDate} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </label>
      </div>
      <div className="row">
        <label className="grow">
          District
          <select name="district" value={value.district} onChange={(e) => set({ district: e.target.value })}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

interface Active {
  key: string;
  label: string;
  clear: () => FilterState;
}

/** Filters that differ from the defaults, other than the time range presets and the search. */
export function activeFilters(value: FilterState, minDate: string, maxDate: string): Active[] {
  const out: Active[] = [];
  const all = new Set(CATEGORIES);
  if (value.categories.size < CATEGORIES.length) {
    const names = [...value.categories].map((c) => CATEGORY_META[c].label);
    out.push({
      key: 'categories',
      label: names.length === 0 ? 'No categories' : names.length <= 2 ? names.join(', ') : `${names.length} categories`,
      clear: () => ({ ...value, categories: all }),
    });
  }
  if (value.district) out.push({ key: 'district', label: value.district, clear: () => ({ ...value, district: '' }) });
  if (!presetOf(value, minDate, maxDate)) {
    out.push({
      key: 'dates',
      label: `${formatDate(value.from)} – ${formatDate(value.to)}`,
      clear: () => ({ ...value, from: isoDaysAgo(30, maxDate), to: maxDate }),
    });
  }
  return out;
}

/** Removable chips for the active filters, so they stay visible with the panel closed. */
export function ActiveFilters({ value, minDate, maxDate, onChange }: Props) {
  const active = activeFilters(value, minDate, maxDate);
  if (!active.length) return null;
  return (
    <ul className="active-filters" aria-label="Active filters">
      {active.map((a) => (
        <li key={a.key}>
          <button type="button" className="tag" onClick={() => onChange(a.clear())} aria-label={`Remove filter: ${a.label}`}>
            {a.label}
            <span aria-hidden="true">✕</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
