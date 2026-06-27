import type { LensArchitecture } from "../types/lens";
import LensDiagram from "./LensDiagram";

interface LensDetailProps {
  lens: LensArchitecture;
}

export default function LensDetail({ lens }: LensDetailProps) {
  return (
    <article className="lens-detail">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{lens.category}</p>
          <h2>{lens.name}</h2>
        </div>
        <dl className="spec-strip">
          <div>
            <dt>Elements</dt>
            <dd>{lens.elements}</dd>
          </div>
          <div>
            <dt>Groups</dt>
            <dd>{lens.groups}</dd>
          </div>
        </dl>
      </div>

      <LensDiagram diagram={lens.diagram} title={lens.name} />

      <p className="description">{lens.description}</p>

      <section className="detail-section why-section">
        <h3>Why this design matters</h3>
        <p>{lens.whyMatters}</p>
      </section>

      <section className="detail-section">
        <h3>Traits</h3>
        <ul className="trait-list">
          {lens.traits.map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Camera Tags</h3>
        <ul className="tag-list">
          {lens.cameraTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </section>

      <section className="detail-grid">
        <div>
          <h3>Typical Use</h3>
          <p>{lens.typicalUse}</p>
        </div>
        <div>
          <h3>Representative Examples</h3>
          <ul>
            {lens.representativeExamples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      </section>

      <p className="caution-note">
        Caution note: this is a simplified archetype diagram, not an exact optical formula or a full lens prescription.
      </p>
    </article>
  );
}
