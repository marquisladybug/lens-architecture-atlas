import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  defaultTechnicalControls,
  glassSegmentsFor,
  isCementedSurface,
  traceTechnicalPrescription,
  type TechnicalElementAdjustment,
  type TechnicalGlassSegment,
  type TechnicalObjectMode,
  type TechnicalTraceControls,
} from "../lib/technicalOptics";
import type { LensArchitecture, TechnicalPrescription, TechnicalSurface } from "../types/lens";

interface TechnicalRayDiagramProps {
  lens: LensArchitecture;
}

type DisplayOptionKey =
  | "focusPlane"
  | "imagePlane"
  | "stop"
  | "surfaceNumbers"
  | "cementedBoundaries"
  | "chiefRays"
  | "marginalRays"
  | "fieldRays"
  | "modelBlocks";

type DragState =
  | {
      kind: "element";
      segmentId: string;
      startZ: number;
      startY: number;
      startAdjustment: TechnicalElementAdjustment;
    }
  | {
      kind: "image";
      startZ: number;
      startSensorPosition: number;
    }
  | {
      kind: "stop";
      startZ: number;
      startStopShift: number;
    };

const VIEW = {
  width: 1200,
  height: 520,
};

const modeLabels: Record<TechnicalObjectMode, string> = {
  near: "Near object",
  infinity: "Infinity rays",
  "off-axis": "Off-axis field",
};

const displayOptions: { key: DisplayOptionKey; label: string }[] = [
  { key: "focusPlane", label: "focus plane" },
  { key: "imagePlane", label: "image plane" },
  { key: "stop", label: "stop" },
  { key: "surfaceNumbers", label: "surface numbers" },
  { key: "cementedBoundaries", label: "cemented boundaries" },
  { key: "chiefRays", label: "principal/chief rays" },
  { key: "marginalRays", label: "marginal rays" },
  { key: "fieldRays", label: "field rays" },
  { key: "modelBlocks", label: "show model blocks" },
];

const defaultOptions: Record<DisplayOptionKey, boolean> = {
  focusPlane: true,
  imagePlane: true,
  stop: true,
  surfaceNumbers: true,
  cementedBoundaries: true,
  chiefRays: true,
  marginalRays: true,
  fieldRays: true,
  modelBlocks: false,
};

const emptyAdjustment: TechnicalElementAdjustment = {
  axialShift: 0,
  decenter: 0,
  tilt: 0,
};

const DIAGRAM_MIN_Z = -170;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signed(value: number, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function fallbackPrescriptionFromLens(lens: LensArchitecture): TechnicalPrescription {
  const rawEntries: { z: number; surface: TechnicalSurface }[] = [];
  const elementCenters = lens.playground.groups.flatMap((group) =>
    group.elements.map((element) => group.position + element.baseX),
  );
  const minElementZ = Math.min(...elementCenters, lens.playground.stopPosition);
  const offset = Math.max(0, -minElementZ + 4);

  lens.playground.groups.forEach((group) => {
    group.elements.forEach((element) => {
      const centerZ = group.position + element.baseX + offset;
      const isNegative = element.elementType === "negative" || element.powerContribution < 0;
      const refractiveIndex = isNegative ? 1.68 : 1.58;
      const radius = isNegative ? 34 : 42;
      const halfThickness = element.elementType === "cemented" ? 1.6 : 2.2;
      const label = element.label;

      rawEntries.push({
        z: centerZ - halfThickness,
        surface: {
          id: `${element.id}-front`,
          label,
          radius: isNegative ? -radius : radius,
          thicknessToNext: halfThickness * 2,
          semiDiameter: element.diameter / 2,
          refractiveIndexBefore: 1,
          refractiveIndexAfter: refractiveIndex,
          glass: isNegative ? "flint" : "crown",
        },
      });
      rawEntries.push({
        z: centerZ + halfThickness,
        surface: {
          id: `${element.id}-rear`,
          radius: isNegative ? radius : -radius,
          thicknessToNext: 4,
          semiDiameter: element.diameter / 2,
          refractiveIndexBefore: refractiveIndex,
          refractiveIndexAfter: 1,
        },
      });
    });
  });

  rawEntries.push({
    z: lens.playground.stopPosition + offset,
    surface: {
      id: `${lens.id}-fallback-stop`,
      label: "stop",
      radius: Infinity,
      thicknessToNext: 4,
      semiDiameter: lens.playground.defaultApertureSize / 2,
      refractiveIndexBefore: 1,
      refractiveIndexAfter: 1,
      isStop: true,
    },
  });

  const sortedEntries = rawEntries.sort((a, b) => a.z - b.z);
  sortedEntries.forEach((entry, index) => {
    if (index > 0) {
      entry.z = Math.max(entry.z, sortedEntries[index - 1].z + 0.45);
    }
  });

  const lastSurfaceZ = sortedEntries[sortedEntries.length - 1]?.z ?? 0;
  const imagePlaneZ = Math.max(lens.playground.defaultSensorPosition + offset, lastSurfaceZ + 24);
  const surfaces = sortedEntries.map((entry, index) => ({
    ...entry.surface,
    thicknessToNext: sortedEntries[index + 1] ? sortedEntries[index + 1].z - entry.z : imagePlaneZ - entry.z,
  }));

  return {
    id: `${lens.id}-fallback-tech`,
    label: `${lens.name} derived educational prescription`,
    surfaces,
    imagePlaneZ,
    defaultObjectDistance: lens.playground.defaultObjectDistance,
    defaultObjectHeight: lens.playground.defaultObjectHeight,
    defaultFieldHeight: lens.playground.defaultObjectHeight * 0.65,
  };
}

function surfacePath(surface: TechnicalSurface, x: number, yTop: number, yBottom: number) {
  if (surface.isStop) {
    const mid = (yTop + yBottom) / 2;
    return `M ${x} ${yTop} L ${x} ${mid - 28} M ${x} ${mid + 28} L ${x} ${yBottom}`;
  }

  const curve = Number.isFinite(surface.radius) ? clamp(720 / surface.radius, -26, 26) : 0;
  return `M ${x} ${yTop} Q ${x + curve} ${(yTop + yBottom) / 2} ${x} ${yBottom}`;
}

function sampledBoundaryPoints(x: number, curve: number, yTop: number, yBottom: number, reverse = false) {
  const steps = 10;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const bend = 2 * (1 - t) * t * curve;
    return {
      x: x + bend,
      y: yTop + (yBottom - yTop) * t,
    };
  });

  return reverse ? points.reverse() : points;
}

function safeElementCurves(polarity: TechnicalGlassSegment["polarity"], xFront: number, xRear: number) {
  const width = Math.max(1.2, xRear - xFront);

  if (polarity === "negative") {
    const minimumCenterThickness = clamp(width * 0.24, 1.2, 4.8);
    const inset = Math.max(0, Math.min(width * 0.38, (width - minimumCenterThickness) / 2));

    return {
      frontCurve: inset,
      rearCurve: -inset,
    };
  }

  const bulge = clamp(width * 0.42, 1.4, 10);

  return {
    frontCurve: -bulge,
    rearCurve: bulge,
  };
}

function elementSilhouettePath(
  polarity: TechnicalGlassSegment["polarity"],
  xFront: number,
  xRear: number,
  yTop: number,
  yBottom: number,
) {
  const { frontCurve, rearCurve } = safeElementCurves(polarity, xFront, xRear);
  const frontPoints = sampledBoundaryPoints(xFront, frontCurve, yTop, yBottom);
  const rearPoints = sampledBoundaryPoints(xRear, rearCurve, yTop, yBottom, true);
  const outline = [...frontPoints, ...rearPoints];

  return [
    outline
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" "),
    "Z",
  ].join(" ");
}

function elementSurfacePaths(
  polarity: TechnicalGlassSegment["polarity"],
  xFront: number,
  xRear: number,
  yTop: number,
  yBottom: number,
) {
  const { frontCurve, rearCurve } = safeElementCurves(polarity, xFront, xRear);
  const pointsToPath = (points: { x: number; y: number }[]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

  return {
    front: pointsToPath(sampledBoundaryPoints(xFront, frontCurve, yTop, yBottom)),
    rear: pointsToPath(sampledBoundaryPoints(xRear, rearCurve, yTop, yBottom)),
  };
}

function adjustmentForSegment(controls: TechnicalTraceControls, segmentId: string) {
  return controls.elementAdjustments[segmentId] ?? emptyAdjustment;
}

function averageAdjustment(adjustments: TechnicalElementAdjustment[]) {
  if (adjustments.length === 0) {
    return emptyAdjustment;
  }

  return {
    axialShift: adjustments.reduce((sum, adjustment) => sum + adjustment.axialShift, 0) / adjustments.length,
    decenter: adjustments.reduce((sum, adjustment) => sum + adjustment.decenter, 0) / adjustments.length,
    tilt: adjustments.reduce((sum, adjustment) => sum + adjustment.tilt, 0) / adjustments.length,
  };
}

export default function TechnicalRayDiagram({ lens }: TechnicalRayDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prescription = useMemo(() => lens.technicalPrescription ?? fallbackPrescriptionFromLens(lens), [lens]);
  const linePriorityDiagram =
    lens.category === "Symmetrical wide-angle" ||
    lens.category === "Retrofocus wide-angle" ||
    lens.id === "biogon" ||
    lens.id === "distagon-retrofocus";
  const defaultControls = useMemo(() => defaultTechnicalControls(prescription), [prescription]);
  const [mode, setMode] = useState<TechnicalObjectMode>("infinity");
  const [options, setOptions] = useState(defaultOptions);
  const [controls, setControls] = useState<TechnicalTraceControls>(defaultControls);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);

  const glassSegments = useMemo(() => glassSegmentsFor(prescription), [prescription]);
  const result = useMemo(() => traceTechnicalPrescription(prescription, mode, controls), [prescription, mode, controls]);
  const baselineResult = useMemo(
    () => traceTechnicalPrescription(prescription, mode, defaultControls),
    [prescription, mode, defaultControls],
  );
  const adjustedSegments = useMemo(
    () =>
      glassSegments.map((segment) => ({
        ...segment,
        startZ: result.surfacePositions[segment.frontSurfaceIndex],
        endZ: result.surfacePositions[segment.rearSurfaceIndex],
      })),
    [glassSegments, result.surfacePositions],
  );
  const selectedSegment =
    adjustedSegments.find((segment) => segment.id === selectedSegmentId) ?? adjustedSegments[0] ?? null;
  const selectedSegmentIndex = selectedSegment
    ? adjustedSegments.findIndex((segment) => segment.id === selectedSegment.id)
    : -1;
  const selectedAdjustment = selectedSegment ? adjustmentForSegment(controls, selectedSegment.id) : emptyAdjustment;
  const selectedPosition = selectedSegment ? (selectedSegment.startZ + selectedSegment.endZ) / 2 : 0;
  const selectedSurfaceRange = selectedSegment
    ? `${selectedSegment.frontSurfaceIndex + 1}-${selectedSegment.rearSurfaceIndex + 1}`
    : "-";
  const stopSurfaceIndex = prescription.surfaces.findIndex((surface) => surface.isStop);
  const stopSurface = stopSurfaceIndex >= 0 ? prescription.surfaces[stopSurfaceIndex] : undefined;
  const stopZ = stopSurfaceIndex >= 0 ? result.surfacePositions[stopSurfaceIndex] : lens.playground.stopPosition;
  const lastSurfaceZ = result.surfacePositions[result.surfacePositions.length - 1] ?? 0;
  const maxSurfaceY = Math.max(
    ...prescription.surfaces.map((surface) => surface.semiDiameter),
    prescription.defaultObjectHeight,
    controls.apertureSize,
  );
  const minZ = DIAGRAM_MIN_Z;
  const maxZ = Math.max(prescription.imagePlaneZ + 70, controls.sensorPosition + 24, lastSurfaceZ + 92);
  const yLimit = Math.max(maxSurfaceY * 1.95, Math.abs(prescription.defaultObjectHeight) * 2.7, 30);
  const xForZ = (z: number) => ((z - minZ) / (maxZ - minZ)) * VIEW.width;
  const zForX = (x: number) => minZ + (x / VIEW.width) * (maxZ - minZ);
  const yForHeight = (y: number) => VIEW.height / 2 - (y / yLimit) * (VIEW.height * 0.42);
  const heightForY = (y: number) => ((VIEW.height / 2 - y) / (VIEW.height * 0.42)) * yLimit;
  const pathForRay = (points: { z: number; y: number }[]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${xForZ(point.z)} ${yForHeight(point.y)}`).join(" ");
  const focusX = xForZ(clamp(result.focusPlaneZ, minZ, maxZ));
  const imageX = xForZ(controls.sensorPosition);
  const objectZ = -controls.objectDistance;
  const objectX = xForZ(clamp(objectZ, minZ + 8, -18));
  const sensorYs = result.rays.map((ray) => ray.sensorY);
  const sensorMeanY =
    sensorYs.length > 0 ? sensorYs.reduce((sum, value) => sum + value, 0) / sensorYs.length : 0;
  const blurRadius = clamp((result.sensorSpread / yLimit) * (VIEW.height * 0.21), 4, 36);

  useEffect(() => {
    const nextControls = defaultTechnicalControls(prescription);
    setControls(nextControls);
    setSelectedSegmentId(glassSegmentsFor(prescription)[0]?.id ?? "");
    setDragState(null);
  }, [prescription]);

  const segmentName = (segment: TechnicalGlassSegment, index: number) => {
    const surface = prescription.surfaces[segment.frontSurfaceIndex];
    return surface.label ?? `Element ${index + 1}`;
  };

  const surfaceAdjustment = (surfaceIndex: number) =>
    averageAdjustment(
      glassSegments
        .filter((segment) => segment.frontSurfaceIndex === surfaceIndex || segment.rearSurfaceIndex === surfaceIndex)
        .map((segment) => adjustmentForSegment(controls, segment.id)),
    );
  const selectedSurfaceIndexes = useMemo(
    () =>
      selectedSegment
        ? new Set([selectedSegment.frontSurfaceIndex, selectedSegment.rearSurfaceIndex])
        : new Set<number>(),
    [selectedSegment],
  );
  const surfaceRenderData = useMemo(
    () =>
      prescription.surfaces.map((surface, index) => {
        const adjustment = surfaceAdjustment(index);
        const displaySemiDiameter = surface.isStop ? controls.apertureSize : surface.semiDiameter;
        const x = xForZ(result.surfacePositions[index]);
        const centerY = yForHeight(0);
        const decenterOffset = surface.isStop ? 0 : yForHeight(adjustment.decenter) - yForHeight(0);
        const yTop = yForHeight(displaySemiDiameter);
        const yBottom = yForHeight(-displaySemiDiameter);

        return {
          surface,
          index,
          x,
          yTop,
          yBottom,
          transform: surface.isStop ? undefined : `translate(0 ${decenterOffset}) rotate(${adjustment.tilt * 1.4} ${x} ${centerY})`,
          path: surfacePath(surface, x, yTop, yBottom),
          selected: selectedSurfaceIndexes.has(index),
        };
      }),
    [controls.apertureSize, prescription.surfaces, result.surfacePositions, selectedSurfaceIndexes],
  );

  const visibleRays = result.rays.filter((ray) => {
    if (ray.kind === "chief") {
      return options.chiefRays;
    }

    if (ray.kind === "marginal") {
      return options.marginalRays;
    }

    return options.fieldRays;
  });
  const baselineRays = baselineResult.rays.filter((ray) => {
    if (ray.kind === "chief") {
      return options.chiefRays;
    }

    if (ray.kind === "marginal") {
      return options.marginalRays;
    }

    return options.fieldRays;
  });
  const elementRenderData = adjustedSegments.map((segment) => {
    const adjustment = adjustmentForSegment(controls, segment.id);
    const xFront = xForZ(segment.startZ);
    const xRear = xForZ(segment.endZ);
    const width = Math.max(3, xRear - xFront);
    const yTop = yForHeight(segment.semiDiameter);
    const yBottom = yForHeight(-segment.semiDiameter);
    const centerX = xFront + width / 2;
    const centerY = yForHeight(0);
    const decenterOffset = yForHeight(adjustment.decenter) - yForHeight(0);
    const selected = selectedSegment?.id === segment.id;
    const dragging = dragState?.kind === "element" && dragState.segmentId === segment.id;
    const surfacePaths = elementSurfacePaths(segment.polarity, xFront, xRear, yTop, yBottom);

    return {
      segment,
      xFront,
      xRear,
      width,
      yTop,
      yBottom,
      centerX,
      transform: `translate(0 ${decenterOffset}) rotate(${adjustment.tilt * 1.4} ${centerX} ${centerY})`,
      selected,
      dragging,
      silhouettePath: elementSilhouettePath(segment.polarity, xFront, xRear, yTop, yBottom),
      surfacePaths,
    };
  });
  const glassSurfaceRenderData = Array.from(
    elementRenderData
      .reduce<
        Map<
          number,
          {
            index: number;
            surface: TechnicalSurface;
            path: string;
            transform: string;
            selected: boolean;
          }
        >
      >((surfaces, element) => {
        [
          { index: element.segment.frontSurfaceIndex, path: element.surfacePaths.front },
          { index: element.segment.rearSurfaceIndex, path: element.surfacePaths.rear },
        ].forEach((item) => {
          if (surfaces.has(item.index)) {
            return;
          }

          surfaces.set(item.index, {
            index: item.index,
            surface: prescription.surfaces[item.index],
            path: item.path,
            transform: element.transform,
            selected: selectedSurfaceIndexes.has(item.index),
          });
        });

        return surfaces;
      }, new Map())
      .values(),
  ).sort((a, b) => a.index - b.index);

  const svgPoint = (event: PointerEvent<SVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();

    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
    };
  };

  const updateElementAdjustment = (segmentId: string, patch: Partial<TechnicalElementAdjustment>) => {
    setControls((current) => ({
      ...current,
      elementAdjustments: {
        ...current.elementAdjustments,
        [segmentId]: {
          ...emptyAdjustment,
          ...(current.elementAdjustments[segmentId] ?? emptyAdjustment),
          ...patch,
        },
      },
    }));
  };

  const resetSelected = () => {
    if (!selectedSegment) {
      return;
    }

    updateElementAdjustment(selectedSegment.id, emptyAdjustment);
  };

  const resetAll = () => {
    setControls(defaultTechnicalControls(prescription));
    setDragState(null);
  };

  const toggleOption = (key: DisplayOptionKey) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const beginElementDrag = (event: PointerEvent<SVGGElement>, segment: TechnicalGlassSegment) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = svgPoint(event);
    setSelectedSegmentId(segment.id);
    setDragState({
      kind: "element",
      segmentId: segment.id,
      startZ: zForX(point.x),
      startY: heightForY(point.y),
      startAdjustment: adjustmentForSegment(controls, segment.id),
    });
  };

  const beginImageDrag = (event: PointerEvent<SVGGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "image",
      startZ: zForX(svgPoint(event).x),
      startSensorPosition: controls.sensorPosition,
    });
  };

  const beginStopDrag = (event: PointerEvent<SVGGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "stop",
      startZ: zForX(svgPoint(event).x),
      startStopShift: controls.stopShift,
    });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState) {
      return;
    }

    const point = svgPoint(event);
    const currentZ = zForX(point.x);
    const currentY = heightForY(point.y);

    if (dragState.kind === "element") {
      const deltaZ = currentZ - dragState.startZ;
      const deltaY = currentY - dragState.startY;

      if (event.altKey) {
        updateElementAdjustment(dragState.segmentId, {
          decenter: clamp(dragState.startAdjustment.decenter + deltaY, -18, 18),
        });
        return;
      }

      updateElementAdjustment(dragState.segmentId, {
        axialShift: clamp(dragState.startAdjustment.axialShift + deltaZ, -18, 18),
      });
      return;
    }

    if (dragState.kind === "image") {
      const deltaZ = currentZ - dragState.startZ;
      setControls((current) => ({
        ...current,
        sensorPosition: clamp(dragState.startSensorPosition + deltaZ, lastSurfaceZ + 6, lastSurfaceZ + 110),
      }));
      return;
    }

    const deltaZ = currentZ - dragState.startZ;
    setControls((current) => ({
      ...current,
      stopShift: clamp(dragState.startStopShift + deltaZ, -24, 24),
    }));
  };

  const endDrag = () => {
    setDragState(null);
  };

  const updateControl = (patch: Partial<TechnicalTraceControls>) => {
    setControls((current) => ({ ...current, ...patch }));
  };

  return (
    <section className="technical-ray-section ray-workbench">
      <div className="technical-heading">
        <div>
          <p className="eyebrow">Ray-based workbench</p>
          <h3>Technical Ray Diagram</h3>
          <p>{prescription.label}</p>
        </div>
        <div className="technical-mode-selector" role="group" aria-label="Ray object mode">
          {(Object.keys(modeLabels) as TechnicalObjectMode[]).map((item) => (
            <button className={mode === item ? "active" : ""} key={item} type="button" onClick={() => setMode(item)}>
              {modeLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="workbench-inspector">
        <div>
          <span className="workbench-inspector-label">Selected element</span>
          <strong>
            {selectedSegment
              ? segmentName(selectedSegment, selectedSegmentIndex)
              : "No element"}
          </strong>
        </div>
        <span>type {selectedSegment?.polarity ?? "none"}</span>
        <span>role element</span>
        <span>surfaces {selectedSurfaceRange}</span>
        <span>position {selectedSegment ? selectedPosition.toFixed(1) : "-"} rel.</span>
        <span>axial {signed(selectedAdjustment.axialShift)} rel.</span>
        <span>decenter {signed(selectedAdjustment.decenter)} rel.</span>
        <span>tilt {signed(selectedAdjustment.tilt)} deg</span>
        <button type="button" onClick={resetSelected}>
          Reset selected
        </button>
        <button type="button" onClick={resetAll}>
          Reset all
        </button>
      </div>

      {selectedSegment ? (
        <div className="workbench-selected-controls" aria-label="Selected element controls">
          <label>
            <span>Axial shift</span>
            <input
              max="18"
              min="-18"
              step="0.5"
              type="range"
              value={selectedAdjustment.axialShift}
              onChange={(event) => updateElementAdjustment(selectedSegment.id, { axialShift: Number(event.target.value) })}
            />
            <output>{signed(selectedAdjustment.axialShift)} rel.</output>
          </label>
          <label>
            <span>Vertical decenter</span>
            <input
              max="18"
              min="-18"
              step="0.5"
              type="range"
              value={selectedAdjustment.decenter}
              onChange={(event) => updateElementAdjustment(selectedSegment.id, { decenter: Number(event.target.value) })}
            />
            <output>{signed(selectedAdjustment.decenter)} rel.</output>
          </label>
          <label>
            <span>Tilt</span>
            <input
              max="12"
              min="-12"
              step="0.25"
              type="range"
              value={selectedAdjustment.tilt}
              onChange={(event) => updateElementAdjustment(selectedSegment.id, { tilt: Number(event.target.value) })}
            />
            <output>{signed(selectedAdjustment.tilt)} deg</output>
          </label>
        </div>
      ) : null}

      <div className="technical-options" aria-label="Technical diagram display options">
        {displayOptions.map((option) => (
          <label key={option.key}>
            <input checked={options[option.key]} type="checkbox" onChange={() => toggleOption(option.key)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div
        className={[
          "technical-stage",
          linePriorityDiagram ? "line-priority" : "",
          dragState ? "dragging" : "",
          dragState ? `dragging-${dragState.kind}` : "",
        ].join(" ")}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          role="img"
          onPointerLeave={endDrag}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
        >
          <title>{`${lens.name} ray-based workbench`}</title>
          <defs>
            <pattern id={`${prescription.id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" className="technical-grid-line" />
            </pattern>
          </defs>
          <desc>
            Approximate archetype diagram for learning lens architecture. It is not an exact optical prescription.
          </desc>
          <rect className="technical-grid" width={VIEW.width} height={VIEW.height} fill={`url(#${prescription.id}-grid)`} />
          <line className="technical-axis" x1="20" y1={yForHeight(0)} x2={VIEW.width - 20} y2={yForHeight(0)} />

          {mode === "near" ? (
            <g className="workbench-object" transform={`translate(${objectX} ${yForHeight(-prescription.defaultObjectHeight)})`}>
              <line x1="0" y1="34" x2="0" y2="-24" />
              <circle cx="0" cy="-30" r="11" />
              <line x1="-10" y1="34" x2="10" y2="34" />
              <text x="0" y="52">object point</text>
            </g>
          ) : (
            <g className="workbench-infinity-label">
              <text x="28" y="42">{mode === "off-axis" ? "off-axis field bundle" : "parallel rays from infinity"}</text>
            </g>
          )}

          {elementRenderData.map((element) => (
            <g
              className={`technical-element-hit ${element.selected ? "selected" : ""} ${element.dragging ? "dragging-target" : ""}`}
              key={element.segment.id}
              transform={element.transform}
              onPointerDown={(event) => beginElementDrag(event, element.segment)}
            >
              <rect
                className="technical-element-target"
                height={element.yBottom - element.yTop + 34}
                width={element.width + 30}
                x={element.xFront - 15}
                y={element.yTop - 17}
              />
              <path
                className={`technical-element-silhouette ${element.selected ? "selected" : ""} ${element.dragging ? "dragging-target" : ""}`}
                d={element.silhouettePath}
              />
              {options.modelBlocks ? (
                <rect
                  className={`technical-model-block ${element.selected ? "selected" : ""}`}
                  height={element.yBottom - element.yTop}
                  width={element.width}
                  x={element.xFront}
                  y={element.yTop}
                />
              ) : null}
            </g>
          ))}

          {glassSurfaceRenderData
            .map((item) => (
              <g className="technical-surface" key={item.surface.id} transform={item.transform}>
                <path d={item.path} />
              </g>
            ))}

          {options.cementedBoundaries
            ? glassSurfaceRenderData
                .filter((item) => isCementedSurface(item.surface))
                .map((item) => (
                  <g className="technical-cemented-boundary" key={`cemented-${item.surface.id}`} transform={item.transform}>
                    <path d={item.path} />
                  </g>
                ))
            : null}

          {baselineRays.map((ray) => (
            <path key={`baseline-${ray.id}`} className={`technical-ray baseline-ray technical-ray-${ray.kind}`} d={pathForRay(ray.points)} />
          ))}

          {visibleRays.map((ray) => (
            <path key={ray.id} className={`technical-ray technical-ray-${ray.kind}`} d={pathForRay(ray.points)} />
          ))}

          {options.stop
            ? surfaceRenderData
                .filter((item) => item.surface.isStop)
                .map((item) => (
                  <g
                    className={`technical-stop drag-target ${dragState?.kind === "stop" ? "dragging-target" : ""}`}
                    key={item.surface.id}
                    onPointerDown={beginStopDrag}
                  >
                    <path d={item.path} />
                  </g>
                ))
            : null}

          {options.focusPlane ? (
            <g className="technical-focus-plane">
              <line x1={focusX} y1="36" x2={focusX} y2={VIEW.height - 46} />
              <text x={focusX + 8} y="54">
                focus plane
              </text>
            </g>
          ) : null}

          {options.imagePlane ? (
            <g className={`technical-image-plane drag-target ${dragState?.kind === "image" ? "dragging-target" : ""}`} onPointerDown={beginImageDrag}>
              <rect x={imageX - 8} y="26" width="16" height={VIEW.height - 52} />
              <line x1={imageX} y1="26" x2={imageX} y2={VIEW.height - 26} />
              <text x={imageX + 10} y={VIEW.height - 42}>
                image plane
              </text>
              <circle className="technical-blur-circle" cx={imageX} cy={yForHeight(sensorMeanY)} r={blurRadius} />
              <circle className="technical-image-point" cx={imageX} cy={yForHeight(sensorMeanY)} r="3.5" />
            </g>
          ) : null}

          {stopSurface && options.stop ? (
            <text className="workbench-drag-label" x={xForZ(stopZ)} y="28">
              drag stop
            </text>
          ) : null}

          {glassSurfaceRenderData
            .filter((item) => item.selected)
            .map((item) => (
              <g className="technical-surface-selected" key={`selected-${item.surface.id}`} transform={item.transform}>
                <path d={item.path} />
              </g>
            ))}

          {options.surfaceNumbers
            ? surfaceRenderData.filter((item) => !item.surface.isStop || options.stop).map((item) => (
                <text
                  className="technical-surface-number"
                  key={`label-${item.surface.id}`}
                  x={item.x}
                  y={VIEW.height - 22 - (item.index % 2) * 12}
                >
                  {item.surface.isStop ? "STOP" : item.index + 1}
                </text>
              ))
            : null}
        </svg>
      </div>

      <div className="workbench-controls">
        <div className="workbench-control-grid">
          <label className={mode !== "near" ? "disabled-control" : ""}>
            <span>Object distance</span>
            <input
              disabled={mode !== "near"}
              max="160"
              min="35"
              step="1"
              type="range"
              value={controls.objectDistance}
              onChange={(event) => updateControl({ objectDistance: Number(event.target.value) })}
            />
            <output>{mode === "near" ? `${controls.objectDistance.toFixed(0)} rel.` : "parallel rays from infinity"}</output>
          </label>
          <label>
            <span>Aperture size</span>
            <input
              max={Math.max(controls.apertureSize, (stopSurface?.semiDiameter ?? 12) * 2.2)}
              min="4"
              step="0.5"
              type="range"
              value={controls.apertureSize}
              onChange={(event) => updateControl({ apertureSize: Number(event.target.value) })}
            />
            <output>{controls.apertureSize.toFixed(1)} rel.</output>
          </label>
          <label>
            <span>Sensor / image plane</span>
            <input
              max={lastSurfaceZ + 110}
              min={lastSurfaceZ + 6}
              step="0.5"
              type="range"
              value={controls.sensorPosition}
              onChange={(event) => updateControl({ sensorPosition: Number(event.target.value) })}
            />
            <output>{controls.sensorPosition.toFixed(1)} rel.</output>
          </label>
          <label>
            <span>Group spacing delta</span>
            <input
              max="0.28"
              min="-0.28"
              step="0.01"
              type="range"
              value={controls.groupSpacingDelta}
              onChange={(event) => updateControl({ groupSpacingDelta: Number(event.target.value) })}
            />
            <output>{signed(controls.groupSpacingDelta, 2)}</output>
          </label>
          <label>
            <span>Group axial shift</span>
            <input
              max="18"
              min="-18"
              step="0.5"
              type="range"
              value={controls.groupAxialShift}
              onChange={(event) => updateControl({ groupAxialShift: Number(event.target.value) })}
            />
            <output>{signed(controls.groupAxialShift)} rel.</output>
          </label>
          <label>
            <span>Aperture stop shift</span>
            <input
              max="24"
              min="-24"
              step="0.5"
              type="range"
              value={controls.stopShift}
              onChange={(event) => updateControl({ stopShift: Number(event.target.value) })}
            />
            <output>{signed(controls.stopShift)} rel.</output>
          </label>
        </div>
      </div>

      <div className="technical-readout">
        <span>{prescription.surfaces.length} surfaces</span>
        <span>focus plane {result.focusPlaneZ.toFixed(1)} rel.</span>
        <span>image plane {result.imagePlaneZ.toFixed(1)} rel.</span>
        <span>sensor blur radius {(result.sensorSpread / 2).toFixed(1)} rel.</span>
      </div>
      <p className="technical-caption">Approximate archetype diagram for exploring lens architecture, not an exact optical prescription.</p>

      <details className="technical-note">
        <summary>Educational note</summary>
        <p>
          This is an approximate archetype diagram for exploring lens architecture, not an exact optical prescription,
          engineering drawing, or full simulator. Drag lens elements horizontally for axial shift, Alt + drag for
          decenter, and use the selected element slider for tilt.
        </p>
      </details>
    </section>
  );
}
