import type { DiagramElement, LensDiagramData } from "../types/lens";

interface LensDiagramProps {
  diagram: LensDiagramData;
  title: string;
}

const toneClass = {
  clear: "diagram-element-clear",
  warm: "diagram-element-warm",
  cool: "diagram-element-cool",
};

function pathForElement(element: DiagramElement) {
  const x = element.x;
  const w = element.width;
  const top = 60 - element.height / 2;
  const bottom = 60 + element.height / 2;
  const mid = x + w / 2;
  const curve = Math.max(7, w * 1.25);

  switch (element.surface) {
    case "biconvex":
      return `M ${x} ${top} C ${x + curve} ${top + 8}, ${x + curve} ${bottom - 8}, ${x} ${bottom} C ${x + w + curve} ${bottom - 8}, ${x + w + curve} ${top + 8}, ${x} ${top} Z`;
    case "biconcave":
      return `M ${x} ${top} C ${x + curve} ${top + 16}, ${x + curve} ${bottom - 16}, ${x} ${bottom} C ${x + w - curve} ${bottom - 16}, ${x + w - curve} ${top + 16}, ${x} ${top} Z`;
    case "convex-left":
      return `M ${x + w} ${top} L ${x + w} ${bottom} C ${x - curve} ${bottom - 8}, ${x - curve} ${top + 8}, ${x + w} ${top} Z`;
    case "convex-right":
      return `M ${x} ${top} L ${x} ${bottom} C ${x + w + curve} ${bottom - 8}, ${x + w + curve} ${top + 8}, ${x} ${top} Z`;
    case "meniscus":
      return `M ${x} ${top} C ${x + curve} ${top + 10}, ${x + curve} ${bottom - 10}, ${x} ${bottom} C ${x + w + curve * 0.25} ${bottom - 12}, ${x + w + curve * 0.25} ${top + 12}, ${x} ${top} Z`;
  }
}

export default function LensDiagram({ diagram, title }: LensDiagramProps) {
  return (
    <figure className="lens-diagram" aria-label={`${title} simplified archetype diagram`}>
      <svg viewBox="0 0 120 120" role="img">
        <title>{`${title} simplified archetype diagram`}</title>
        <line className="axis-line" x1="6" y1="60" x2="114" y2="60" />
        <line className="image-plane" x1="112" y1="24" x2="112" y2="96" />
        {diagram.stop ? (
          <g className="aperture-stop">
            <line x1={diagram.stop.x} y1={60 - diagram.stop.height / 2} x2={diagram.stop.x} y2="49" />
            <line x1={diagram.stop.x} y1="71" x2={diagram.stop.x} y2={60 + diagram.stop.height / 2} />
            <circle cx={diagram.stop.x} cy="60" r="10" />
          </g>
        ) : null}
        {diagram.elements.map((element) => (
          <path
            key={element.id}
            className={`diagram-element ${toneClass[element.tone ?? "clear"]}`}
            d={pathForElement(element)}
          />
        ))}
      </svg>
      <figcaption>simplified archetype diagram</figcaption>
    </figure>
  );
}
