import { CATEGORIES, CATEGORY_META, type Category } from '../../shared/categories.ts';

interface Props {
  counts: Map<Category, number>;
  selected: Set<Category>;
  onSelect: (category: Category) => void;
  onAll: () => void;
}

/**
 * Category legend that doubles as the filter. With all categories shown, a click shows only
 * that category; further clicks add or remove categories; "Show all" resets.
 */
export function StatsBar({ counts, selected, onSelect, onAll }: Props) {
  const allOn = selected.size === CATEGORIES.length;
  return (
    <div className="stats">
      <div className="stats-head">
        <span id="categories-label">
          {allOn ? 'Categories · click one to show only it' : `Categories · ${selected.size} of ${CATEGORIES.length} shown`}
        </span>
        {!allOn && (
          <button type="button" className="link" onClick={onAll}>
            Show all
          </button>
        )}
      </div>
      <ul aria-labelledby="categories-label">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const on = selected.has(c);
          return (
            <li key={c}>
              <button
                type="button"
                className="stat"
                aria-pressed={!allOn && on}
                data-dimmed={!on}
                title={meta.description}
                onClick={() => onSelect(c)}
              >
                <span className="dot" style={{ background: meta.color }} aria-hidden />
                <span className="stat-label">{meta.label}</span>
                <span className="stat-count">{counts.get(c) ?? 0}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
