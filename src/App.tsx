import { useMemo, useState } from "react";
import LensDetail from "./components/LensDetail";
import LensList from "./components/LensList";
import SearchBox from "./components/SearchBox";
import { categories, lenses } from "./data/lenses";
import type { LensCategory } from "./types/lens";

function App() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<LensCategory | "All">("All");
  const [selectedId, setSelectedId] = useState(lenses[0].id);

  const filteredLenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return lenses.filter((lens) => {
      const matchesCategory = selectedCategory === "All" || lens.category === selectedCategory;
      const searchableText = [
        lens.name,
        lens.category,
        lens.description,
        lens.typicalUse,
        ...lens.traits,
        ...lens.representativeExamples,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [query, selectedCategory]);

  const selectedLens =
    filteredLenses.find((lens) => lens.id === selectedId) ?? filteredLenses[0] ?? lenses.find((lens) => lens.id === selectedId);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">photographic lens formulas</p>
          <h1>Lens Architecture Atlas</h1>
        </div>
        <p className="header-note">Educational catalog of simplified archetype diagram views.</p>
      </header>

      <section className="controls-row">
        <SearchBox value={query} onChange={setQuery} />
      </section>

      <div className="atlas-layout">
        <LensList
          lenses={filteredLenses}
          categories={categories}
          selectedId={selectedLens?.id ?? ""}
          selectedCategory={selectedCategory}
          onSelectLens={setSelectedId}
          onSelectCategory={setSelectedCategory}
        />
        {selectedLens ? (
          <LensDetail lens={selectedLens} />
        ) : (
          <section className="empty-state">
            <h2>No matching lens forms</h2>
            <p>Try a different search term or category.</p>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
