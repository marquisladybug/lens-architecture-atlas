import type { TechnicalPrescription, TechnicalSurface } from "../types/lens";

export type TechnicalObjectMode = "near" | "infinity" | "off-axis";
export type TechnicalRayKind = "chief" | "marginal" | "field";

export interface TechnicalRayPoint {
  z: number;
  y: number;
}

export interface TechnicalRayTrace {
  id: string;
  kind: TechnicalRayKind;
  points: TechnicalRayPoint[];
  sensorY: number;
  exitZ: number;
  exitY: number;
  exitSlope: number;
}

export interface TechnicalTraceResult {
  surfacePositions: number[];
  rays: TechnicalRayTrace[];
  focusPlaneZ: number;
  imagePlaneZ: number;
  sensorSpread: number;
}

export interface TechnicalElementAdjustment {
  axialShift: number;
  decenter: number;
  tilt: number;
}

export interface TechnicalTraceControls {
  objectDistance: number;
  apertureSize: number;
  sensorPosition: number;
  groupSpacingDelta: number;
  groupAxialShift: number;
  stopShift: number;
  elementAdjustments: Record<string, TechnicalElementAdjustment>;
}

export interface TechnicalGlassSegment {
  id: string;
  frontSurfaceIndex: number;
  rearSurfaceIndex: number;
  startZ: number;
  endZ: number;
  semiDiameter: number;
  power: number;
  polarity: "positive" | "negative";
}

const EPSILON = 0.0001;

export function isGlassIndex(index: number) {
  return index > 1.05;
}

export function isCementedSurface(surface: TechnicalSurface) {
  return !surface.isStop && isGlassIndex(surface.refractiveIndexBefore) && isGlassIndex(surface.refractiveIndexAfter);
}

export function surfacePower(surface: TechnicalSurface) {
  if (!Number.isFinite(surface.radius) || Math.abs(surface.radius) < EPSILON) {
    return 0;
  }

  return (surface.refractiveIndexAfter - surface.refractiveIndexBefore) / surface.radius;
}

function refractAtSurface(y: number, slope: number, surface: TechnicalSurface, adjustment?: TechnicalElementAdjustment) {
  const n1 = surface.refractiveIndexBefore;
  const n2 = surface.refractiveIndexAfter;
  const decenteredY = y - (adjustment?.decenter ?? 0);
  const tiltKick = (adjustment?.tilt ?? 0) * 0.0018;

  if (!Number.isFinite(surface.radius) || Math.abs(surface.radius) < EPSILON || Math.abs(n2) < EPSILON) {
    return slope * (n1 / n2) + tiltKick;
  }

  return (n1 / n2) * slope - ((n2 - n1) / (n2 * surface.radius)) * decenteredY + tiltKick;
}

export function surfacePositionsFor(prescription: TechnicalPrescription) {
  let z = 0;
  return prescription.surfaces.map((surface) => {
    const current = z;
    z += surface.thicknessToNext;
    return current;
  });
}

export function defaultTechnicalControls(prescription: TechnicalPrescription): TechnicalTraceControls {
  return {
    objectDistance: prescription.defaultObjectDistance,
    apertureSize:
      prescription.surfaces.find((surface) => surface.isStop)?.semiDiameter ??
      Math.min(...prescription.surfaces.map((surface) => surface.semiDiameter)),
    sensorPosition: prescription.imagePlaneZ,
    groupSpacingDelta: 0,
    groupAxialShift: 0,
    stopShift: 0,
    elementAdjustments: Object.fromEntries(
      glassSegmentsFor(prescription).map((segment) => [
        segment.id,
        {
          axialShift: 0,
          decenter: 0,
          tilt: 0,
        },
      ]),
    ),
  };
}

export function glassSegmentsFor(prescription: TechnicalPrescription): TechnicalGlassSegment[] {
  const surfacePositions = surfacePositionsFor(prescription);

  return prescription.surfaces
    .map((surface, index) => {
      const nextSurface = prescription.surfaces[index + 1];

      if (!nextSurface || surface.isStop || !isGlassIndex(surface.refractiveIndexAfter) || surface.thicknessToNext <= 0) {
        return undefined;
      }

      const power = surfacePower(surface) + surfacePower(nextSurface);

      return {
        id: `${surface.id}-${nextSurface.id}`,
        frontSurfaceIndex: index,
        rearSurfaceIndex: index + 1,
        startZ: surfacePositions[index],
        endZ: surfacePositions[index] + surface.thicknessToNext,
        semiDiameter: Math.min(surface.semiDiameter, nextSurface.semiDiameter),
        power,
        polarity: power >= 0 ? ("positive" as const) : ("negative" as const),
      };
    })
    .filter((segment): segment is TechnicalGlassSegment => Boolean(segment));
}

export function adjustedSurfacePositionsFor(
  prescription: TechnicalPrescription,
  controls?: TechnicalTraceControls,
) {
  const basePositions = surfacePositionsFor(prescription);

  if (!controls) {
    return basePositions;
  }

  const center = (basePositions[0] + basePositions[basePositions.length - 1]) / 2;
  const segmentDeltas = new Map<number, number[]>();

  glassSegmentsFor(prescription).forEach((segment) => {
    const adjustment = controls.elementAdjustments[segment.id];

    if (!adjustment) {
      return;
    }

    [segment.frontSurfaceIndex, segment.rearSurfaceIndex].forEach((index) => {
      const list = segmentDeltas.get(index) ?? [];
      list.push(adjustment.axialShift);
      segmentDeltas.set(index, list);
    });
  });

  const adjustedPositions = basePositions.map((position, index) => {
    const surface = prescription.surfaces[index];
    const elementDelta = segmentDeltas.get(index);
    const averagedElementDelta = elementDelta
      ? elementDelta.reduce((sum, value) => sum + value, 0) / elementDelta.length
      : 0;
    const stopDelta = surface.isStop ? controls.stopShift : 0;

    return center + (position - center) * (1 + controls.groupSpacingDelta) + controls.groupAxialShift + averagedElementDelta + stopDelta;
  });

  return adjustedPositions.reduce<number[]>((positions, position, index) => {
    if (index === 0) {
      return [position];
    }

    positions.push(Math.max(position, positions[index - 1] + 0.3));
    return positions;
  }, []);
}

function surfaceAdjustmentsFor(prescription: TechnicalPrescription, controls?: TechnicalTraceControls) {
  const adjustmentMap = new Map<number, TechnicalElementAdjustment[]>();

  if (!controls) {
    return new Map<number, TechnicalElementAdjustment>();
  }

  glassSegmentsFor(prescription).forEach((segment) => {
    const adjustment = controls.elementAdjustments[segment.id];

    if (!adjustment) {
      return;
    }

    [segment.frontSurfaceIndex, segment.rearSurfaceIndex].forEach((index) => {
      const list = adjustmentMap.get(index) ?? [];
      list.push(adjustment);
      adjustmentMap.set(index, list);
    });
  });

  return new Map(
    Array.from(adjustmentMap.entries()).map(([index, adjustments]) => [
      index,
      {
        axialShift: adjustments.reduce((sum, adjustment) => sum + adjustment.axialShift, 0) / adjustments.length,
        decenter: adjustments.reduce((sum, adjustment) => sum + adjustment.decenter, 0) / adjustments.length,
        tilt: adjustments.reduce((sum, adjustment) => sum + adjustment.tilt, 0) / adjustments.length,
      },
    ]),
  );
}

function traceSingleRay(
  id: string,
  kind: TechnicalRayKind,
  startZ: number,
  startY: number,
  startSlope: number,
  prescription: TechnicalPrescription,
  surfacePositions: number[],
  surfaceAdjustments: Map<number, TechnicalElementAdjustment>,
  imagePlaneZ: number,
) {
  let z = startZ;
  let y = startY;
  let slope = startSlope;
  const points: TechnicalRayPoint[] = [{ z, y }];

  prescription.surfaces.forEach((surface, index) => {
    const surfaceZ = surfacePositions[index];
    y += slope * (surfaceZ - z);
    z = surfaceZ;
    points.push({ z, y });
    slope = refractAtSurface(y, slope, surface, surfaceAdjustments.get(index));
  });

  y += slope * (imagePlaneZ - z);
  z = imagePlaneZ;
  points.push({ z, y });

  const lastSurfaceZ = surfacePositions[surfacePositions.length - 1] ?? 0;
  const lastSurfaceY = points[points.length - 2]?.y ?? y;

  return {
    id,
    kind,
    points,
    sensorY: y,
    exitZ: lastSurfaceZ,
    exitY: lastSurfaceY,
    exitSlope: slope,
  };
}

function raysForMode(mode: TechnicalObjectMode, prescription: TechnicalPrescription, aperture: number, objectDistance: number) {
  const objectZ = -objectDistance;
  const nearY = -prescription.defaultObjectHeight;
  const fieldSlope = 0.09;
  const marginalHeights = [-aperture, -aperture * 0.45, 0, aperture * 0.45, aperture];

  if (mode === "near") {
    return marginalHeights.map((targetY, index) => ({
      id: index === 2 ? "chief" : `marginal-${index}`,
      kind: index === 2 ? ("chief" as const) : ("marginal" as const),
      startZ: objectZ,
      startY: nearY,
      startSlope: (targetY - nearY) / Math.max(EPSILON, -objectZ),
    }));
  }

  return marginalHeights.map((height, index) => ({
    id: mode === "off-axis" ? `field-${index}` : index === 2 ? "chief" : `marginal-${index}`,
    kind: mode === "off-axis" ? ("field" as const) : index === 2 ? ("chief" as const) : ("marginal" as const),
    startZ: -150,
    startY: mode === "off-axis" ? height + prescription.defaultFieldHeight : height,
    startSlope: mode === "off-axis" ? fieldSlope : 0,
  }));
}

export function traceTechnicalPrescription(
  prescription: TechnicalPrescription,
  mode: TechnicalObjectMode,
  controls?: TechnicalTraceControls,
): TechnicalTraceResult {
  const surfacePositions = adjustedSurfacePositionsFor(prescription, controls);
  const surfaceAdjustments = surfaceAdjustmentsFor(prescription, controls);
  const stopSurface = prescription.surfaces.find((surface) => surface.isStop);
  const narrowestGlassSemiDiameter = Math.min(
    ...prescription.surfaces.filter((surface) => !surface.isStop).map((surface) => surface.semiDiameter),
  );
  const requestedAperture =
    controls?.apertureSize ?? stopSurface?.semiDiameter ?? Math.min(...prescription.surfaces.map((surface) => surface.semiDiameter));
  const aperture = Math.min(requestedAperture * 0.82, narrowestGlassSemiDiameter * 0.86);
  const imagePlaneZ = controls?.sensorPosition ?? prescription.imagePlaneZ;
  const objectDistance = controls?.objectDistance ?? prescription.defaultObjectDistance;
  const rays = raysForMode(mode, prescription, aperture, objectDistance).map((ray) =>
    traceSingleRay(ray.id, ray.kind, ray.startZ, ray.startY, ray.startSlope, prescription, surfacePositions, surfaceAdjustments, imagePlaneZ),
  );
  const focusCandidates = rays
    .filter((ray) => Math.abs(ray.exitSlope) > EPSILON)
    .map((ray) => ray.exitZ - ray.exitY / ray.exitSlope)
    .filter((z) => Number.isFinite(z) && z > (surfacePositions[surfacePositions.length - 1] ?? 0));
  const focusPlaneZ =
    focusCandidates.length > 0
      ? focusCandidates.reduce((sum, z) => sum + z, 0) / focusCandidates.length
      : prescription.imagePlaneZ;
  const sensorYs = rays.map((ray) => ray.sensorY);

  return {
    surfacePositions,
    rays,
    focusPlaneZ,
    imagePlaneZ,
    sensorSpread: Math.max(...sensorYs) - Math.min(...sensorYs),
  };
}
