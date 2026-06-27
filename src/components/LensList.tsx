import type { LensArchitecture, LensCategory } from "../types/lens";

interface LensListProps {
  lenses: LensArchitecture[];
  categories: LensCategory[];
  selectedId: string;
  selectedCategory: LensCategory | "All";
  onSelectLens: (id: string) => void;
  onSelectCategory: (category: LensCategory | "All") => void;
}

export default function LensList({
  lenses,
  categories,
  selectedId,
  selectedCategory,
  onSelectLens,
  onSelectCategory,
}: LensListProps) {
  return (
    <aside className="lens-list-panel">
      <div className="category-tabs" aria-label="Filter by category">
        <button
          className={selectedCategory === "All" ? "active" : ""}
          type="button"
          onClick={() => onSelectCategory("All")}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            className={selectedCategory === category ? "active" : ""}
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="lens-count">{lenses.length} archetypes</div>
      <nav className="lens-list" aria-label="Lens architecture list">
        {lenses.map((lens) => (
          <button
            className={selectedId === lens.id ? "lens-list-item selected" : "lens-list-item"}
            key={lens.id}
            type="button"
            onClick={() => onSelectLens(lens.id)}
          >
            <span>{lens.name}</span>
            <small>
              {lens.elements} elements / {lens.groups} groups
            </small>
          </button>
        ))}
      </nav>
    </aside>
  );
}
