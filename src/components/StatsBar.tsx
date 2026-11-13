import { CATEGORIES, CATEGORY_META, FAMILIES, FAMILY_META, type Category, categoriesOf } from '../../shared/categories.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface Props {
  counts: Map<Category, number>;
  selected: Set<Category>;
  onSelect: (category: Category) => void;
  onAll: () => void;
}

/**
 * Category legend that doubles as the filter, grouped by family (the family sets the colour,
 * the icon the category). With all categories shown, a click shows only that category;
 * further clicks add or remove categories; "Show all" resets.
 */
export function StatsBar({ counts, selected, onSelect, onAll }: Props) {
  const allOn = selected.size === CATEGORIES.length;
  return (
    <div className="stats">
      <div className="stats-head">
        <h2 id="categories-label">Categories</h2>
        <span className="stats-state">{allOn ? 'Click one to show only it' : `${selected.size} of ${CATEGORIES.length} shown`}</span>
        {!allOn && (
          <button type="button" className="link" onClick={onAll}>
            Show all
          </button>
        )}
      </div>
      {FAMILIES.map((family) => (
        <section key={family} className="family" aria-labelledby={`family-${family}`}>
          <h3 id={`family-${family}`} className="family-label">
            {FAMILY_META[family].label}
          </h3>
          <ul>
            {categoriesOf(family).map((c) => {
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
                    <CategoryIcon category={c} />
                    <span className="stat-label">{meta.label}</span>
                    <span className="stat-count">{counts.get(c) ?? 0}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
