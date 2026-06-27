import type { OpticalPlaygroundPreset, PlaygroundElement, PlaygroundGroup } from "../types/lens";

export interface ElementAdjustment {
  axialShift: number;
  decenter: number;
  tilt: number;
}

export type LightObjectMode = "infinity" | "near" | "off-axis";

export interface PlaygroundControls {
  lightObjectMode: LightObjectMode;
  objectDistance: number;
  objectHeight: number;
  infinityMode: boolean;
  sensorPosition: number;
  apertureSize: number;
  groupSpacingDelta: number;
  groupAxialShift: number;
  elementAdjustments: Record<string, ElementAdjustment>;
}

export interface OpticalRayPoint {
  x: number;
  y: number;
}

export interface OpticalRayTrace {
  id: "chief" | "marginal-upper" | "marginal-lower";
  label: string;
  points: OpticalRayPoint[];
  sensorY: number;
}

export interface OpticalPlaygroundResult {
  groups: PlaygroundGroup[];
  elements: PlaygroundElement[];
  stopPosition: number;
  focusPosition: number;
  sensorBlurRadius: number;
  sensorImageY: number;
  focusState: "focused" | "front-focus" | "back-focus";
  rays: OpticalRayTrace[];
}

interface RayState {
  y: number;
  theta: number;
}

const EPSILON = 0.0001;

function cloneGroupsWithSpacing(preset: OpticalPlaygroundPreset, controls: PlaygroundControls) {
  const center = preset.groups.reduce((sum, group) => sum + group.position, 0) / preset.groups.length;

  return preset.groups.map((group) => ({
    ...group,
    position: center + (group.position - center) * (1 + controls.groupSpacingDelta) + controls.groupAxialShift,
    elements: group.elements.map((element) => ({
      ...element,
      surfaces: element.surfaces.map((surface) => ({ ...surface })),
    })),
  }));
}

function flattenAdjustedElements(groups: PlaygroundGroup[], controls: PlaygroundControls) {
  return groups
    .flatMap((group) =>
      group.elements.map((element) => {
        const adjustment = controls.elementAdjustments[element.id] ?? {
          axialShift: element.defaultAxialShift,
          decenter: element.defaultDecenter,
          tilt: element.defaultTilt,
        };

        return {
          ...element,
          baseX: group.position + element.baseX + adjustment.axialShift,
          defaultDecenter: adjustment.decenter,
          defaultTilt: adjustment.tilt,
        };
      }),
    )
    .sort((left, right) => left.baseX - right.baseX);
}

function transferTo(ray: RayState, distance: number): RayState {
  return {
    y: ray.y + distance * ray.theta,
    theta: ray.theta,
  };
}

function refractThinElement(ray: RayState, element: PlaygroundElement): RayState {
  return {
    y: ray.y,
    theta:
      ray.theta -
      element.powerContribution * (ray.y - element.defaultDecenter) +
      element.defaultTilt * 0.0018,
  };
}

function propagateThroughGroupsTo(
  startY: number,
  theta: number,
  startX: number,
  targetX: number,
  elements: PlaygroundElement[],
) {
  let ray: RayState = { y: startY, theta };
  let x = startX;

  elements
    .filter((element) => element.baseX > startX && element.baseX < targetX)
    .forEach((element) => {
      ray = transferTo(ray, element.baseX - x);
      x = element.baseX;
      ray = refractThinElement(ray, element);
    });

  return transferTo(ray, targetX - x);
}

function solveThetaForStop(
  startY: number,
  startX: number,
  targetStopY: number,
  stopPosition: number,
  elements: PlaygroundElement[],
) {
  const baseRay = propagateThroughGroupsTo(startY, 0, startX, stopPosition, elements);
  const unitRay = propagateThroughGroupsTo(startY, 1, startX, stopPosition, elements);
  const response = unitRay.y - baseRay.y;

  if (Math.abs(response) < EPSILON) {
    return (targetStopY - startY) / Math.max(EPSILON, stopPosition - startX);
  }

  return (targetStopY - baseRay.y) / response;
}

function traceRay(
  id: OpticalRayTrace["id"],
  label: string,
  startY: number,
  startX: number,
  targetStopY: number,
  elements: PlaygroundElement[],
  stopPosition: number,
  sensorPosition: number,
  initialTheta?: number,
) {
  const theta = initialTheta ?? solveThetaForStop(startY, startX, targetStopY, stopPosition, elements);
  let ray: RayState = { y: startY, theta };
  let x = startX;
  const points: OpticalRayPoint[] = [{ x, y: ray.y }];
  let finalElementExit = { x: startX, y: ray.y, theta: ray.theta };
  const events = [
    ...elements.map((element) => ({ type: "element" as const, x: element.baseX, element })),
    { type: "stop" as const, x: stopPosition, element: undefined },
  ].sort((left, right) => left.x - right.x);

  events.forEach((event) => {
    if (event.x <= startX || event.x >= sensorPosition) {
      return;
    }

    ray = transferTo(ray, event.x - x);
    x = event.x;
    points.push({ x, y: ray.y });

    if (event.type === "element" && event.element) {
      ray = refractThinElement(ray, event.element);
      finalElementExit = { x, y: ray.y, theta: ray.theta };
    }
  });

  ray = transferTo(ray, sensorPosition - x);
  points.push({ x: sensorPosition, y: ray.y });

  return {
    id,
    label,
    points,
    sensorY: ray.y,
    exitY: finalElementExit.y,
    exitTheta: finalElementExit.theta,
    exitX: finalElementExit.x,
  };
}

export function calculateOpticalPlayground(
  preset: OpticalPlaygroundPreset,
  controls: PlaygroundControls,
): OpticalPlaygroundResult {
  const groups = cloneGroupsWithSpacing(preset, controls);
  const elements = flattenAdjustedElements(groups, controls);
  const stopPosition = preset.stopPosition + controls.groupAxialShift;
  const startX = controls.infinityMode ? -150 : -controls.objectDistance;
  const objectHeight = controls.objectHeight;
  const apertureRadius = controls.apertureSize / 2;
  const sensorPosition = controls.sensorPosition;
  const mode = controls.infinityMode ? "infinity" : controls.lightObjectMode;
  const fieldAngle = mode === "off-axis" ? 0.12 : 0;
  const objectY = mode === "near" ? -objectHeight : objectHeight;
  const rawRays =
    mode === "near"
      ? [
          traceRay("marginal-upper", "marginal ray", objectY, startX, -apertureRadius, elements, stopPosition, sensorPosition),
          traceRay("chief", "chief ray", objectY, startX, 0, elements, stopPosition, sensorPosition),
          traceRay("marginal-lower", "marginal ray", objectY, startX, apertureRadius, elements, stopPosition, sensorPosition),
        ]
      : [
          traceRay("marginal-upper", "parallel marginal", -apertureRadius, -150, -apertureRadius, elements, stopPosition, sensorPosition, fieldAngle),
          traceRay("chief", "parallel chief", 0, -150, 0, elements, stopPosition, sensorPosition, fieldAngle),
          traceRay("marginal-lower", "parallel marginal", apertureRadius, -150, apertureRadius, elements, stopPosition, sensorPosition, fieldAngle),
        ];

  const focusCandidates = rawRays
    .filter((ray) => Math.abs(ray.exitTheta) > EPSILON)
    .map((ray) => ray.exitX - ray.exitY / ray.exitTheta)
    .filter((position) => Number.isFinite(position) && position > elements[elements.length - 1].baseX);

  const focusPosition =
    focusCandidates.length > 0
      ? focusCandidates.reduce((sum, position) => sum + position, 0) / focusCandidates.length
      : sensorPosition;

  const sensorYs = rawRays.map((ray) => ray.sensorY);
  const sensorBlurRadius = (Math.max(...sensorYs) - Math.min(...sensorYs)) / 2;
  const sensorImageY = sensorYs.reduce((sum, y) => sum + y, 0) / sensorYs.length;
  const focusDelta = sensorPosition - focusPosition;
  const focusState =
    Math.abs(focusDelta) < 4 ? "focused" : focusDelta < 0 ? "front-focus" : "back-focus";

  return {
    groups,
    elements,
    stopPosition,
    focusPosition,
    sensorBlurRadius,
    sensorImageY,
    focusState,
    rays: rawRays.map(({ exitX: _exitX, exitTheta: _exitTheta, exitY: _exitY, ...ray }) => ray),
  };
}
