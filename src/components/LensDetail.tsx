import type { LensArchitecture } from "../types/lens";
import LensDiagram from "./LensDiagram";
import TechnicalRayDiagram from "./TechnicalRayDiagram";

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

      <TechnicalRayDiagram lens={lens} />

      <details className="secondary-panel">
        <summary>Structure view</summary>
        <LensDiagram lens={lens} />
      </details>

      <details className="detail-accordion">
        <summary>Lens notes</summary>
        <p className="description">{lens.description}</p>

        <section className="detail-section why-section">
          <h3>Why this design matters</h3>
          <p>{lens.whyMatters}</p>
        </section>
      </details>

      <details className="detail-accordion">
        <summary>Tags and examples</summary>
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
      </details>

      <details className="detail-accordion">
        <summary>Optical summary</summary>
        <dl className="workbench-summary-cards">
          <div>
            <dt>Groups</dt>
            <dd>{lens.playground.groupCount}</dd>
          </div>
          <div>
            <dt>Power</dt>
            <dd>{lens.playground.effectivePowerDistribution.map((power) => power.toFixed(3)).join(" / ")}</dd>
          </div>
          <div>
            <dt>Stop</dt>
            <dd>{lens.playground.stopPosition.toFixed(1)} rel.</dd>
          </div>
          <div>
            <dt>Symmetry</dt>
            <dd>{lens.playground.symmetryTendency}</dd>
          </div>
          <div>
            <dt>Back focus</dt>
            <dd>{lens.playground.backFocusTendency}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{lens.playground.speedTendency}</dd>
          </div>
        </dl>
        <div className="caution-note">
          Caution note: this is a simplified archetype diagram, not an exact optical formula or a full lens
          prescription.
        </div>
      </details>
    </article>
  );
}
