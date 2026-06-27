import type { OpticalPlaygroundPreset, PlaygroundGroup } from "../types/lens";

export interface PlaygroundControls {
  objectDistance: number;
  objectHeight: number;
  infinityMode: boolean;
  sensorPosition: number;
  apertureSize: number;
  groupSpacingDelta: number;
  groupAxialShift: number;
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
  stopPosition: number;
  focusPosition: number;
  sensorBlurRadius: number;
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

function transferTo(ray: RayState, distance: number): RayState {
  return {
    y: ray.y + distance * ray.theta,
    theta: ray.theta,
  };
}

function refractThinGroup(ray: RayState, power: number): RayState {
  return {
    y: ray.y,
    theta: ray.theta - power * ray.y,
  };
}

function propagateThroughGroupsTo(
  startY: number,
  theta: number,
  startX: number,
  targetX: number,
  groups: PlaygroundGroup[],
) {
  let ray: RayState = { y: startY, theta };
  let x = startX;

  groups
    .filter((group) => group.position > startX && group.position < targetX)
    .forEach((group) => {
      ray = transferTo(ray, group.position - x);
      x = group.position;
      ray = refractThinGroup(ray, group.power);
    });

  return transferTo(ray, targetX - x);
}

function solveThetaForStop(
  startY: number,
  startX: number,
  targetStopY: number,
  stopPosition: number,
  groups: PlaygroundGroup[],
) {
  const baseRay = propagateThroughGroupsTo(startY, 0, startX, stopPosition, groups);
  const unitRay = propagateThroughGroupsTo(startY, 1, startX, stopPosition, groups);
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
  groups: PlaygroundGroup[],
  stopPosition: number,
  sensorPosition: number,
) {
  const theta = solveThetaForStop(startY, startX, targetStopY, stopPosition, groups);
  let ray: RayState = { y: startY, theta };
  let x = startX;
  const points: OpticalRayPoint[] = [{ x, y: ray.y }];
  let finalGroupExit = { x: startX, y: ray.y, theta: ray.theta };
  const events = [
    ...groups.map((group) => ({ type: "group" as const, x: group.position, power: group.power })),
    { type: "stop" as const, x: stopPosition, power: 0 },
  ].sort((left, right) => left.x - right.x);

  events.forEach((event) => {
    if (event.x <= startX || event.x >= sensorPosition) {
      return;
    }

    ray = transferTo(ray, event.x - x);
    x = event.x;
    points.push({ x, y: ray.y });

    if (event.type === "group") {
      ray = refractThinGroup(ray, event.power);
      finalGroupExit = { x, y: ray.y, theta: ray.theta };
    }
  });

  ray = transferTo(ray, sensorPosition - x);
  points.push({ x: sensorPosition, y: ray.y });

  return {
    id,
    label,
    points,
    sensorY: ray.y,
    exitY: finalGroupExit.y,
    exitTheta: finalGroupExit.theta,
    exitX: finalGroupExit.x,
  };
}

export function calculateOpticalPlayground(
  preset: OpticalPlaygroundPreset,
  controls: PlaygroundControls,
): OpticalPlaygroundResult {
  const groups = cloneGroupsWithSpacing(preset, controls);
  const stopPosition = preset.stopPosition + controls.groupAxialShift;
  const startX = controls.infinityMode ? -150 : -controls.objectDistance;
  const objectHeight = controls.objectHeight;
  const apertureRadius = controls.apertureSize / 2;
  const objectY = controls.infinityMode ? objectHeight : -objectHeight;
  const sensorPosition = controls.sensorPosition;

  const rawRays = [
    traceRay("marginal-upper", "marginal ray", objectY, startX, -apertureRadius, groups, stopPosition, sensorPosition),
    traceRay("chief", "chief ray", objectY, startX, 0, groups, stopPosition, sensorPosition),
    traceRay("marginal-lower", "marginal ray", objectY, startX, apertureRadius, groups, stopPosition, sensorPosition),
  ];

  const focusCandidates = rawRays
    .filter((ray) => Math.abs(ray.exitTheta) > EPSILON)
    .map((ray) => ray.exitX - ray.exitY / ray.exitTheta)
    .filter((position) => Number.isFinite(position) && position > groups[groups.length - 1].position);

  const focusPosition =
    focusCandidates.length > 0
      ? focusCandidates.reduce((sum, position) => sum + position, 0) / focusCandidates.length
      : sensorPosition;

  const sensorYs = rawRays.map((ray) => ray.sensorY);
  const sensorBlurRadius = (Math.max(...sensorYs) - Math.min(...sensorYs)) / 2;
  const focusDelta = sensorPosition - focusPosition;
  const focusState =
    Math.abs(focusDelta) < 4 ? "focused" : focusDelta < 0 ? "front-focus" : "back-focus";

  return {
    groups,
    stopPosition,
    focusPosition,
    sensorBlurRadius,
    focusState,
    rays: rawRays.map(({ exitX: _exitX, exitTheta: _exitTheta, exitY: _exitY, ...ray }) => ray),
  };
}
