import { useEffect, useMemo, useState } from "react";
import { calculateOpticalPlayground, type ElementAdjustment, type PlaygroundControls } from "../lib/optics";
import type { OpticalPlaygroundPreset, PlaygroundElement } from "../types/lens";

interface OpticalPlaygroundProps {
  lensName: string;
  preset: OpticalPlaygroundPreset;
}

type ScalarControlKey = Exclude<keyof PlaygroundControls, "elementAdjustments">;

const VIEW = {
  minX: -160,
  maxX: 130,
  minY: -70,
  maxY: 70,
  width: 1000,
  height: 260,
};

function initialControls(preset: OpticalPlaygroundPreset): PlaygroundControls {
  return {
    objectDistance: preset.defaultObjectDistance,
    objectHeight: preset.defaultObjectHeight,
    infinityMode: false,
    sensorPosition: preset.defaultSensorPosition,
    apertureSize: preset.defaultApertureSize,
    groupSpacingDelta: 0,
    groupAxialShift: 0,
    elementAdjustments: Object.fromEntries(
      preset.groups.flatMap((group) =>
        group.elements.map((element) => [
          element.id,
          {
            axialShift: element.defaultAxialShift,
            decenter: element.defaultDecenter,
            tilt: element.defaultTilt,
          },
        ]),
      ),
    ),
  };
}

function xToView(x: number) {
  return ((x - VIEW.minX) / (VIEW.maxX - VIEW.minX)) * VIEW.width;
}

function yToView(y: number) {
  return VIEW.height / 2 - ((y - VIEW.minY) / (VIEW.maxY - VIEW.minY) - 0.5) * VIEW.height;
}

function clampX(x: number) {
  return Math.max(VIEW.minX, Math.min(VIEW.maxX, x));
}

function pathForPoints(points: { x: number; y: number }[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xToView(clampX(point.x))} ${yToView(point.y)}`)
    .join(" ");
}

function focusLabel(state: string) {
  switch (state) {
    case "front-focus":
      return "sensor before focus";
    case "back-focus":
      return "sensor behind focus";
    default:
      return "near focus";
  }
}

function elementTone(element: PlaygroundElement) {
  switch (element.elementType) {
    case "negative":
      return "negative";
    case "cemented":
      return "cemented";
    case "stop":
      return "stop";
    default:
      return "positive";
  }
}

export default function OpticalPlayground({ lensName, preset }: OpticalPlaygroundProps) {
  const [controls, setControls] = useState(() => initialControls(preset));

  useEffect(() => {
    setControls(initialControls(preset));
  }, [preset]);

  const result = useMemo(() => calculateOpticalPlayground(preset, controls), [preset, controls]);
  const objectX = controls.infinityMode ? VIEW.minX + 12 : -controls.objectDistance;
  const objectBaseY = 0;
  const objectTopY = controls.infinityMode ? controls.objectHeight : -controls.objectHeight;
  const focusX = clampX(result.focusPosition);
  const blurRadius = Math.max(3, Math.min(24, result.sensorBlurRadius * 2.2));

  const updateControl = (key: ScalarControlKey, value: number | boolean) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const updateElement = (elementId: string, key: keyof ElementAdjustment, value: number) => {
    setControls((current) => ({
      ...current,
      elementAdjustments: {
        ...current.elementAdjustments,
        [elementId]: {
          ...current.elementAdjustments[elementId],
          [key]: value,
        },
      },
    }));
  };

  const resetElement = (element: PlaygroundElement) => {
    setControls((current) => ({
      ...current,
      elementAdjustments: {
        ...current.elementAdjustments,
        [element.id]: {
          axialShift: element.defaultAxialShift,
          decenter: element.defaultDecenter,
          tilt: element.defaultTilt,
        },
      },
    }));
  };

  return (
    <section className="detail-section optical-playground">
      <div className="playground-heading">
        <div>
          <h3>Optical Playground</h3>
          <p>
            Explore a simplified paraxial model for {lensName}: object distance, aperture, group spacing, and sensor
            position all change the ray trace.
          </p>
        </div>
        <button className="reset-button" type="button" onClick={() => setControls(initialControls(preset))}>
          Reset all
        </button>
      </div>

      <div className="playground-stage" aria-label={`${lensName} optical playground ray trace`}>
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img">
          <title>{`${lensName} simplified optical ray trace`}</title>
          <line className="play-axis" x1="24" y1={yToView(0)} x2={VIEW.width - 24} y2={yToView(0)} />

          <g className="play-object" transform={`translate(${xToView(clampX(objectX))} ${yToView(objectBaseY)})`}>
            <line x1="0" y1="0" x2="0" y2={yToView(objectTopY) - yToView(objectBaseY)} />
            <circle cx="0" cy={yToView(objectTopY) - yToView(objectBaseY)} r="13" />
            <line x1="-11" y1="0" x2="11" y2="0" />
          </g>

          {result.rays.map((ray) => (
            <path key={ray.id} className={`play-ray ${ray.id}`} d={pathForPoints(ray.points)} />
          ))}

          {result.groups.map((group) => (
            <g key={group.id} className="play-lens-group">
              <rect
                x={xToView(group.position) - 10}
                y={yToView(group.diameter / 2)}
                width="20"
                height={Math.abs(yToView(group.diameter / 2) - yToView(-group.diameter / 2))}
                rx="9"
              />
              <text x={xToView(group.position)} y={yToView(-group.diameter / 2) + 18}>
                {group.label}
              </text>
            </g>
          ))}

          {result.elements.map((element) => (
            <g
              key={element.id}
              className={`play-element ${elementTone(element)}`}
              transform={`translate(${xToView(element.baseX)} ${yToView(element.defaultDecenter)}) rotate(${element.defaultTilt})`}
            >
              <rect
                x="-6"
                y={-Math.abs(yToView(element.diameter / 2) - yToView(-element.diameter / 2)) / 2}
                width="12"
                height={Math.abs(yToView(element.diameter / 2) - yToView(-element.diameter / 2))}
                rx="5"
              />
            </g>
          ))}

          <g className="play-stop">
            <line x1={xToView(result.stopPosition)} y1={yToView(controls.apertureSize / 2)} x2={xToView(result.stopPosition)} y2={yToView(34)} />
            <line x1={xToView(result.stopPosition)} y1={yToView(-controls.apertureSize / 2)} x2={xToView(result.stopPosition)} y2={yToView(-34)} />
            <circle cx={xToView(result.stopPosition)} cy={yToView(0)} r={Math.max(8, controls.apertureSize * 1.1)} />
          </g>

          <g className="play-focus">
            <line x1={xToView(focusX)} y1={yToView(44)} x2={xToView(focusX)} y2={yToView(-44)} />
            <text x={xToView(focusX)} y={yToView(-51)}>
              focus
            </text>
          </g>

          <g className={`play-sensor ${result.focusState}`}>
            <line x1={xToView(controls.sensorPosition)} y1={yToView(56)} x2={xToView(controls.sensorPosition)} y2={yToView(-56)} />
            <circle cx={xToView(controls.sensorPosition)} cy={yToView(0)} r={blurRadius} />
            <text x={xToView(controls.sensorPosition) + 8} y={yToView(58)}>
              sensor
            </text>
          </g>
        </svg>
      </div>

      <div className="playground-readout">
        <span>{focusLabel(result.focusState)}</span>
        <span>focus plane {result.focusPosition.toFixed(1)}</span>
        <span>sensor blur radius {result.sensorBlurRadius.toFixed(1)}</span>
      </div>

      <div className="playground-controls">
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={controls.infinityMode}
            onChange={(event) => updateControl("infinityMode", event.target.checked)}
          />
          <span>Infinity mode</span>
        </label>

        <label>
          <span>Object distance</span>
          <input
            type="range"
            min="70"
            max="150"
            value={controls.objectDistance}
            disabled={controls.infinityMode}
            onChange={(event) => updateControl("objectDistance", Number(event.target.value))}
          />
          <small>{controls.infinityMode ? "infinity" : controls.objectDistance}</small>
        </label>

        <label>
          <span>Object height</span>
          <input
            type="range"
            min="8"
            max="34"
            value={controls.objectHeight}
            onChange={(event) => updateControl("objectHeight", Number(event.target.value))}
          />
          <small>{controls.objectHeight}</small>
        </label>

        <label>
          <span>Sensor / image plane position</span>
          <input
            type="range"
            min="45"
            max="120"
            value={controls.sensorPosition}
            onChange={(event) => updateControl("sensorPosition", Number(event.target.value))}
          />
          <small>{controls.sensorPosition}</small>
        </label>

        <label>
          <span>Aperture size</span>
          <input
            type="range"
            min="8"
            max="38"
            value={controls.apertureSize}
            onChange={(event) => updateControl("apertureSize", Number(event.target.value))}
          />
          <small>{controls.apertureSize}</small>
        </label>

        <label>
          <span>Group spacing delta</span>
          <input
            type="range"
            min="-0.25"
            max="0.35"
            step="0.01"
            value={controls.groupSpacingDelta}
            onChange={(event) => updateControl("groupSpacingDelta", Number(event.target.value))}
          />
          <small>{controls.groupSpacingDelta.toFixed(2)}</small>
        </label>

        <label>
          <span>Group axial shift</span>
          <input
            type="range"
            min="-16"
            max="16"
            value={controls.groupAxialShift}
            onChange={(event) => updateControl("groupAxialShift", Number(event.target.value))}
          />
          <small>{controls.groupAxialShift}</small>
        </label>
      </div>

      <details className="element-controls">
        <summary>
          <span>Element controls</span>
          <small>{preset.groups.reduce((count, group) => count + group.elements.length, 0)} elements</small>
        </summary>
        <div className="element-control-list">
          {preset.groups.flatMap((group) =>
            group.elements.map((element) => {
              const adjustment = controls.elementAdjustments[element.id] ?? {
                axialShift: element.defaultAxialShift,
                decenter: element.defaultDecenter,
                tilt: element.defaultTilt,
              };

              return (
                <section className="element-control-card" key={element.id}>
                  <div className="element-control-heading">
                    <div>
                      <h4>{element.label}</h4>
                      <p>
                        {group.label} / {element.elementType} / power {element.powerContribution.toFixed(4)}
                      </p>
                    </div>
                    <button type="button" onClick={() => resetElement(element)}>
                      Reset
                    </button>
                  </div>

                  <label>
                    <span>Axial shift</span>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="0.5"
                      value={adjustment.axialShift}
                      onChange={(event) => updateElement(element.id, "axialShift", Number(event.target.value))}
                    />
                    <small>{adjustment.axialShift.toFixed(1)}</small>
                  </label>

                  <label>
                    <span>Vertical decenter</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={adjustment.decenter}
                      onChange={(event) => updateElement(element.id, "decenter", Number(event.target.value))}
                    />
                    <small>{adjustment.decenter.toFixed(1)}</small>
                  </label>

                  <label>
                    <span>Tilt</span>
                    <input
                      type="range"
                      min="-8"
                      max="8"
                      step="0.25"
                      value={adjustment.tilt}
                      onChange={(event) => updateElement(element.id, "tilt", Number(event.target.value))}
                    />
                    <small>{adjustment.tilt.toFixed(2)}</small>
                  </label>
                </section>
              );
            }),
          )}
        </div>
      </details>

      <dl className="playground-preset">
        <div>
          <dt>Groups</dt>
          <dd>{preset.groupCount}</dd>
        </div>
        <div>
          <dt>Power</dt>
          <dd>{preset.effectivePowerDistribution.map((power) => power.toFixed(3)).join(" / ")}</dd>
        </div>
        <div>
          <dt>Stop</dt>
          <dd>{preset.stopPosition}</dd>
        </div>
        <div>
          <dt>Symmetry</dt>
          <dd>{preset.symmetryTendency}</dd>
        </div>
        <div>
          <dt>Back focus</dt>
          <dd>{preset.backFocusTendency}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{preset.speedTendency}</dd>
        </div>
      </dl>

      <p className="playground-note">
        This is a simplified educational optical playground, not a full optical prescription or engineering simulator.
      </p>
    </section>
  );
}
