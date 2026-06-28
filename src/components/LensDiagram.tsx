import { useMemo, useState } from "react";
import { glassSegmentsFor, isCementedSurface, surfacePositionsFor } from "../lib/technicalOptics";
import type { LensArchitecture, PlaygroundGroup, TechnicalSurface } from "../types/lens";

interface LensDiagramProps {
  lens: LensArchitecture;
}

type DiagramPolarity = "positive" | "negative";
type DiagramMode = "structure" | "ray-trace" | "overlay";

interface StructureSegment {
  id: string;
  label: string;
  groupLabel: string;
  start: number;
  end: number;
  semiDiameter: number;
  polarity: DiagramPolarity;
  cemented: boolean;
}

const modeLabels: Record<DiagramMode, string> = {
  structure: "Structure",
  "ray-trace": "Ray Trace",
  overlay: "Construction Overlay",
};

function polarityForElement(type: string, power: number): DiagramPolarity {
  if (type === "negative" || power < 0) {
    return "negative";
  }

  return "positive";
}

function positivePath(cx: number, top: number, bottom: number, halfThickness: number) {
  const verticalControl = (bottom - top) * 0.24;

  return [
    `M ${cx} ${top}`,
    `C ${cx - halfThickness} ${top + verticalControl}, ${cx - halfThickness} ${bottom - verticalControl}, ${cx} ${bottom}`,
    `C ${cx + halfThickness} ${bottom - verticalControl}, ${cx + halfThickness} ${top + verticalControl}, ${cx} ${top}`,
    "Z",
  ].join(" ");
}

function negativePath(cx: number, top: number, bottom: number, edgeHalfThickness: number) {
  const centerY = 60;
  const waistHalfThickness = Math.max(edgeHalfThickness * 0.34, 2.2);
  const verticalControl = (bottom - top) * 0.24;
  const leftEdge = cx - edgeHalfThickness;
  const rightEdge = cx + edgeHalfThickness;
  const leftWaist = cx - waistHalfThickness;
  const rightWaist = cx + waistHalfThickness;

  return [
    `M ${leftEdge} ${top}`,
    `C ${cx - edgeHalfThickness * 0.35} ${top - 1.5}, ${cx + edgeHalfThickness * 0.35} ${top - 1.5}, ${rightEdge} ${top}`,
    `C ${rightEdge} ${top + verticalControl}, ${rightWaist} ${centerY - verticalControl * 0.55}, ${rightWaist} ${centerY}`,
    `C ${rightWaist} ${centerY + verticalControl * 0.55}, ${rightEdge} ${bottom - verticalControl}, ${rightEdge} ${bottom}`,
    `C ${cx + edgeHalfThickness * 0.35} ${bottom + 1.5}, ${cx - edgeHalfThickness * 0.35} ${bottom + 1.5}, ${leftEdge} ${bottom}`,
    `C ${leftEdge} ${bottom - verticalControl}, ${leftWaist} ${centerY + verticalControl * 0.55}, ${leftWaist} ${centerY}`,
    `C ${leftWaist} ${centerY - verticalControl * 0.55}, ${leftEdge} ${top + verticalControl}, ${leftEdge} ${top}`,
    "Z",
  ].join(" ");
}

function surfaceCurve(surface: TechnicalSurface) {
  if (!Number.isFinite(surface.radius) || surface.isStop) {
    return 0;
  }

  return Math.max(-10, Math.min(10, 260 / surface.radius));
}

function fallbackSegmentsFromGroups(groups: PlaygroundGroup[]): StructureSegment[] {
  return groups.flatMap((group, groupIndex) =>
    group.elements.map((element, elementIndex) => {
      const polarity = polarityForElement(element.elementType, element.powerContribution);
      const elementCenter = group.position + element.baseX;

      return {
        id: element.id,
        label: polarity === "positive" ? "+" : "-",
        groupLabel: `G${groupIndex + 1}`,
        start: elementCenter - 2.2,
        end: elementCenter + 2.2,
        semiDiameter: element.diameter / 2,
        polarity,
        cemented: group.elements.length > 1 || element.elementType === "cemented" || elementIndex > 0,
      };
    }),
  );
}

function annotationFor(lens: LensArchitecture) {
  if (lens.id === "distagon-retrofocus") {
    return ["front negative group", "rear positive group", "long back focus", "image plane", "retrofocus wide-angle"];
  }

  if (lens.id === "tessar") {
    return ["rear cemented group", "compact standard", "long back focus"];
  }

  if (lens.id === "planar-double-gauss") {
    return ["near-symmetry", "central stop", "balanced groups"];
  }

  return [lens.playground.backFocusTendency === "long" ? "long back focus" : `${lens.playground.backFocusTendency} back focus`];
}

export default function LensDiagram({ lens }: LensDiagramProps) {
  const [mode, setMode] = useState<DiagramMode>("structure");
  const prescription = lens.technicalPrescription;
  const surfacePositions = useMemo(() => (prescription ? surfacePositionsFor(prescription) : []), [prescription]);
  const prescriptionSegments = useMemo(() => (prescription ? glassSegmentsFor(prescription) : []), [prescription]);
  const fallbackSegments = useMemo(() => fallbackSegmentsFromGroups(lens.playground.groups), [lens.playground.groups]);
  const segments: StructureSegment[] =
    prescriptionSegments.length > 0
      ? prescriptionSegments.map((segment, index) => ({
          id: segment.id,
          label: segment.polarity === "positive" ? "+" : "-",
          groupLabel: `G${index + 1}`,
          start: segment.startZ,
          end: segment.endZ,
          semiDiameter: segment.semiDiameter,
          polarity: segment.polarity,
          cemented:
            prescription?.surfaces
              .slice(segment.frontSurfaceIndex, segment.rearSurfaceIndex + 1)
              .some((surface) => isCementedSurface(surface)) ?? false,
        }))
      : fallbackSegments;
  const allStarts = segments.map((segment) => segment.start);
  const allEnds = segments.map((segment) => segment.end);
  const minPosition = Math.min(...allStarts, lens.playground.stopPosition, 0);
  const maxPosition = Math.max(...allEnds, lens.playground.defaultSensorPosition, 1);
  const maxSemiDiameter = Math.max(...segments.map((segment) => segment.semiDiameter), 20);
  const xForPosition = (position: number) => 9 + ((position - minPosition) / (maxPosition - minPosition)) * 94;
  const yForSemiDiameter = (semiDiameter: number, sign: 1 | -1) => 60 - sign * (semiDiameter / maxSemiDiameter) * 32;
  const shouldShowStructure = mode === "structure" || mode === "overlay";
  const shouldShowConstruction = mode === "ray-trace" || mode === "overlay";
  const stopX = xForPosition(prescription ? surfacePositions[prescription.surfaces.findIndex((surface) => surface.isStop)] ?? lens.playground.stopPosition : lens.playground.stopPosition);
  const imagePlaneX = xForPosition(prescription?.imagePlaneZ ?? lens.playground.defaultSensorPosition);

  const pathForSegment = (segment: StructureSegment) => {
    const cx = (xForPosition(segment.start) + xForPosition(segment.end)) / 2;
    const top = yForSemiDiameter(segment.semiDiameter, 1);
    const bottom = yForSemiDiameter(segment.semiDiameter, -1);
    const axialWidth = Math.max(3.6, Math.abs(xForPosition(segment.end) - xForPosition(segment.start)));
    const halfThickness = Math.max(2.6, Math.min(6.6, axialWidth * 0.52));

    return segment.polarity === "positive"
      ? positivePath(cx, top, bottom, halfThickness)
      : negativePath(cx, top, bottom, Math.max(halfThickness * 0.86, 3.4));
  };

  return (
    <figure className="lens-diagram" aria-label={`${lens.name} structure view`}>
      <div className="lens-diagram-toolbar" role="group" aria-label="Lens diagram mode">
        {(Object.keys(modeLabels) as DiagramMode[]).map((item) => (
          <button className={mode === item ? "active" : ""} key={item} type="button" onClick={() => setMode(item)}>
            {modeLabels[item]}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 120 124" role="img">
        <title>{`${lens.name} ${modeLabels[mode]} view`}</title>
        <line className="axis-line" x1="6" y1="60" x2="114" y2="60" />
        <line className="image-plane" x1={imagePlaneX} y1="24" x2={imagePlaneX} y2="96" />
        <text className="diagram-plane-label" x={imagePlaneX} y="19">image</text>

        {shouldShowStructure &&
          lens.playground.groups.map((group, index) => {
            const groupSegments = fallbackSegments.filter((segment) => segment.id.startsWith(group.id));
            const start = Math.min(...groupSegments.map((segment) => segment.start), group.position - 2);
            const end = Math.max(...groupSegments.map((segment) => segment.end), group.position + 2);

            return (
              <g className={group.elements.length > 1 ? "diagram-group-band diagram-group-band-cemented" : "diagram-group-band"} key={group.id}>
                <line x1={xForPosition(start)} y1="101" x2={xForPosition(end)} y2="101" />
                <text x={(xForPosition(start) + xForPosition(end)) / 2} y="98">{`G${index + 1}`}</text>
              </g>
            );
          })}

        {shouldShowStructure &&
          segments.map((segment) => (
            <g className="diagram-element-group" key={segment.id}>
              <path className={`diagram-element diagram-element-${segment.polarity}`} d={pathForSegment(segment)} />
              <text className="diagram-element-label" x={(xForPosition(segment.start) + xForPosition(segment.end)) / 2} y="113">
                {segment.label}
              </text>
            </g>
          ))}

        <g className="diagram-stop-guide">
          <line x1={stopX} y1="27" x2={stopX} y2="49" />
          <line x1={stopX} y1="71" x2={stopX} y2="93" />
          <text x={stopX} y="24">stop</text>
        </g>

        <g className="diagram-back-focus">
          <line x1={stopX} y1="18" x2={imagePlaneX} y2="18" />
          <text x={(stopX + imagePlaneX) / 2} y="14">{lens.playground.backFocusTendency} back focus</text>
        </g>

        {lens.id === "planar-double-gauss" ? <line className="diagram-symmetry-guide" x1="60" y1="25" x2="60" y2="95" /> : null}

        {shouldShowConstruction &&
          prescription?.surfaces.map((surface, index) => {
            const x = xForPosition(surfacePositions[index]);
            const top = yForSemiDiameter(surface.semiDiameter, 1);
            const bottom = yForSemiDiameter(surface.semiDiameter, -1);
            const curve = surfaceCurve(surface);

            if (surface.isStop) {
              return null;
            }

            return (
              <path
                className={`diagram-surface-guide ${isCementedSurface(surface) ? "diagram-surface-guide-cemented" : ""}`}
                d={`M ${x} ${top} Q ${x + curve} 60 ${x} ${bottom}`}
                key={surface.id}
              />
            );
          })}

        {shouldShowConstruction && !prescription &&
          segments.map((segment) => {
            const x = (xForPosition(segment.start) + xForPosition(segment.end)) / 2;

            return (
              <line
                className={segment.cemented ? "diagram-surface-guide diagram-surface-guide-cemented" : "diagram-surface-guide"}
                key={`fallback-guide-${segment.id}`}
                x1={x}
                x2={x}
                y1={yForSemiDiameter(segment.semiDiameter, 1)}
                y2={yForSemiDiameter(segment.semiDiameter, -1)}
              />
            );
          })}
      </svg>
      <div className="power-map" aria-label={`${lens.name} power map`}>
        {lens.playground.groups.map((group, index) => (
          <span className={group.elements.length > 1 ? "power-group power-group-cemented" : "power-group"} key={group.id}>
            <span className="power-group-label">{`G${index + 1}`}</span>
            {group.elements.map((element) => (
              <span className={`power-token power-token-${polarityForElement(element.elementType, element.powerContribution)}`} key={element.id}>
                {polarityForElement(element.elementType, element.powerContribution) === "positive" ? "+" : "-"}
              </span>
            ))}
          </span>
        ))}
      </div>
      <div className="structure-annotations">
        {annotationFor(lens).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <figcaption>{modeLabels[mode]} view: polarity, cementing, air gaps, stop, and image plane</figcaption>
    </figure>
  );
}
