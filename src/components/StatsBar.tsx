import { CATEGORIES, CATEGORY_META, type Category } from '../../shared/categories.ts';

interface Props {
  counts: Map<Category, number>;
  selected: Set<Category>;
  onToggle: (category: Category) => void;
  onOnly: (category: Category) => void;
  onAll: () => void;
}

/** Category legend that doubles as the category filter: click toggles, double-click shows only that category. */
export function StatsBar({ counts, selected, onToggle, onOnly, onAll }: Props) {
  const allOn = selected.size === CATEGORIES.length;
  return (
    <div className="stats">
      <div className="stats-head">
        <span>Categories</span>
        {!allOn && (
          <button type="button" className="link" onClick={onAll}>
            Show all
          </button>
        )}
      </div>
      <ul>
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const on = selected.has(c);
          return (
            <li key={c}>
              <button
                type="button"
                className="stat"
                aria-pressed={on}
                title={`${meta.description}. Click to toggle, double-click to show only this category.`}
                onClick={() => onToggle(c)}
                onDoubleClick={() => onOnly(c)}
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
