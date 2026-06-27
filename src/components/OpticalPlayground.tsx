import { useEffect, useMemo, useState } from "react";
import { calculateOpticalPlayground, type ElementAdjustment, type LightObjectMode, type PlaygroundControls } from "../lib/optics";
import type { OpticalPlaygroundPreset, PlaygroundElement } from "../types/lens";

interface OpticalPlaygroundProps {
  lensName: string;
  preset: OpticalPlaygroundPreset;
}

type ScalarControlKey = Exclude<keyof PlaygroundControls, "elementAdjustments">;

const VIEW = {
  minX: -160,
  maxX: 130,
  minY: -78,
  maxY: 78,
  width: 1000,
  height: 320,
};

function initialControls(preset: OpticalPlaygroundPreset): PlaygroundControls {
  return {
    lightObjectMode: "near",
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
      return "sensor after focus";
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
  const [selectedElementId, setSelectedElementId] = useState(preset.groups[0]?.elements[0]?.id ?? "");

  useEffect(() => {
    setControls(initialControls(preset));
    setSelectedElementId(preset.groups[0]?.elements[0]?.id ?? "");
  }, [preset]);

  const result = useMemo(() => calculateOpticalPlayground(preset, controls), [preset, controls]);
  const baselineControls = useMemo(
    () => ({
      ...controls,
      elementAdjustments: initialControls(preset).elementAdjustments,
    }),
    [controls, preset],
  );
  const baselineResult = useMemo(() => calculateOpticalPlayground(preset, baselineControls), [preset, baselineControls]);
  const presetElements = useMemo(() => preset.groups.flatMap((group) => group.elements), [preset]);
  const selectedPresetElement = presetElements.find((element) => element.id === selectedElementId) ?? presetElements[0];
  const selectedTraceElement = result.elements.find((element) => element.id === selectedPresetElement?.id);
  const selectedAdjustment = selectedPresetElement
    ? controls.elementAdjustments[selectedPresetElement.id] ?? {
        axialShift: selectedPresetElement.defaultAxialShift,
        decenter: selectedPresetElement.defaultDecenter,
        tilt: selectedPresetElement.defaultTilt,
      }
    : undefined;
  const objectX = controls.infinityMode ? VIEW.minX + 12 : -controls.objectDistance;
  const objectBaseY = 0;
  const objectTopY = controls.infinityMode ? controls.objectHeight : -controls.objectHeight;
  const focusX = clampX(result.focusPosition);
  const blurRadius = Math.max(3, Math.min(24, result.sensorBlurRadius * 2.2));
  const modeLabels: Record<LightObjectMode, string> = {
    infinity: "Infinity parallel rays",
    near: "Near object",
    "off-axis": "Off-axis field",
  };
  const isNearObjectMode = controls.lightObjectMode === "near";

  const updateControl = <Key extends ScalarControlKey>(key: Key, value: PlaygroundControls[Key]) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const updateElement = (elementId: string, key: keyof ElementAdjustment, value: number) => {
    setSelectedElementId(elementId);
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
    setSelectedElementId(element.id);
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

  const resetSelectedElement = () => {
    if (selectedPresetElement) {
      resetElement(selectedPresetElement);
    }
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
        <div className="playground-actions">
          <button className="reset-button secondary" type="button" onClick={resetSelectedElement}>
            Reset selected
          </button>
          <button className="reset-button" type="button" onClick={() => setControls(initialControls(preset))}>
            Reset all
          </button>
        </div>
      </div>

      {selectedPresetElement && selectedAdjustment ? (
        <div className="selected-element-readout">
          <div>
            <span>Selected element</span>
            <strong>{selectedPresetElement.label}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{selectedPresetElement.elementType}</strong>
          </div>
          <div>
            <span>Axial</span>
            <strong>{selectedAdjustment.axialShift.toFixed(1)}</strong>
          </div>
          <div>
            <span>Decenter</span>
            <strong>{selectedAdjustment.decenter.toFixed(1)}</strong>
          </div>
          <div>
            <span>Tilt</span>
            <strong>{selectedAdjustment.tilt.toFixed(2)}</strong>
          </div>
          <div>
            <span>Trace x</span>
            <strong>{selectedTraceElement?.baseX.toFixed(1) ?? "n/a"}</strong>
          </div>
        </div>
      ) : null}

      {selectedPresetElement && selectedAdjustment ? (
        <section className="selected-element-panel">
          <div className="selected-element-panel-heading">
            <div>
              <h4>{selectedPresetElement.label}</h4>
              <p>selected element controls / relative units</p>
            </div>
            <button type="button" onClick={resetSelectedElement}>
              Reset selected
            </button>
          </div>
          <div className="selected-element-sliders">
            <label>
              <span>Axial shift</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={selectedAdjustment.axialShift}
                onChange={(event) => updateElement(selectedPresetElement.id, "axialShift", Number(event.target.value))}
              />
              <small>{selectedAdjustment.axialShift.toFixed(1)} rel.</small>
            </label>
            <label>
              <span>Vertical decenter</span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={selectedAdjustment.decenter}
                onChange={(event) => updateElement(selectedPresetElement.id, "decenter", Number(event.target.value))}
              />
              <small>{selectedAdjustment.decenter.toFixed(1)} rel.</small>
            </label>
            <label>
              <span>Tilt</span>
              <input
                type="range"
                min="-8"
                max="8"
                step="0.25"
                value={selectedAdjustment.tilt}
                onChange={(event) => updateElement(selectedPresetElement.id, "tilt", Number(event.target.value))}
              />
              <small>{selectedAdjustment.tilt.toFixed(2)} rel.</small>
            </label>
          </div>
        </section>
      ) : null}

      <div className="mode-selector" role="group" aria-label="Light and object mode">
        {(Object.keys(modeLabels) as LightObjectMode[]).map((mode) => (
          <button
            className={controls.lightObjectMode === mode ? "active" : ""}
            key={mode}
            type="button"
            onClick={() => updateControl("lightObjectMode", mode)}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      <div className="playground-stage" aria-label={`${lensName} optical playground ray trace`}>
        <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img">
          <title>{`${lensName} simplified optical ray trace`}</title>
          <line className="play-axis" x1="24" y1={yToView(0)} x2={VIEW.width - 24} y2={yToView(0)} />

          {controls.lightObjectMode === "near" ? (
            <g className="play-object tree-object" transform={`translate(${xToView(clampX(objectX))} ${yToView(objectBaseY)})`}>
              <line x1="0" y1="0" x2="0" y2={yToView(objectTopY) - yToView(objectBaseY) + 10} />
              <circle cx="0" cy={yToView(objectTopY) - yToView(objectBaseY)} r="15" />
              <circle cx="-10" cy={yToView(objectTopY) - yToView(objectBaseY) + 10} r="10" />
              <circle cx="10" cy={yToView(objectTopY) - yToView(objectBaseY) + 10} r="10" />
              <line x1="-13" y1="0" x2="13" y2="0" />
            </g>
          ) : (
            <g className="parallel-source" aria-label={modeLabels[controls.lightObjectMode]}>
              <line x1={xToView(-154)} y1={yToView(-26)} x2={xToView(-128)} y2={yToView(-26)} />
              <line x1={xToView(-154)} y1={yToView(0)} x2={xToView(-128)} y2={yToView(0)} />
              <line x1={xToView(-154)} y1={yToView(26)} x2={xToView(-128)} y2={yToView(26)} />
              {[-26, 0, 26].map((y) => (
                <polygon
                  key={y}
                  points={`${xToView(-128)},${yToView(y)} ${xToView(-134)},${yToView(y - 4)} ${xToView(-134)},${yToView(y + 4)}`}
                />
              ))}
            </g>
          )}

          {baselineResult.rays.map((ray) => (
            <path key={`baseline-${ray.id}`} className={`play-ray baseline ${ray.id}`} d={pathForPoints(ray.points)} />
          ))}
          {result.rays.map((ray) => (
            <path key={ray.id} className={`play-ray current ${ray.id}`} d={pathForPoints(ray.points)} />
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
              className={`play-element ${elementTone(element)} ${element.id === selectedElementId ? "selected" : ""}`}
              transform={`translate(${xToView(element.baseX)} ${yToView(element.defaultDecenter)}) rotate(${element.defaultTilt})`}
              onClick={() => setSelectedElementId(element.id)}
            >
              <rect
                x="-6"
                y={-Math.abs(yToView(element.diameter / 2) - yToView(-element.diameter / 2)) / 2}
                width="12"
                height={Math.abs(yToView(element.diameter / 2) - yToView(-element.diameter / 2))}
                rx="5"
              />
              {element.id === selectedElementId ? (
                <circle className="selected-element-ring" cx="0" cy="0" r={Math.max(18, element.diameter * 0.55)} />
              ) : null}
            </g>
          ))}

          <g className="play-stop">
            <line x1={xToView(result.stopPosition)} y1={yToView(controls.apertureSize / 2)} x2={xToView(result.stopPosition)} y2={yToView(34)} />
            <line x1={xToView(result.stopPosition)} y1={yToView(-controls.apertureSize / 2)} x2={xToView(result.stopPosition)} y2={yToView(-34)} />
            <circle cx={xToView(result.stopPosition)} cy={yToView(0)} r={Math.max(8, controls.apertureSize * 1.1)} />
          </g>

          <g className="play-focus">
            <line x1={xToView(focusX)} y1={yToView(54)} x2={xToView(focusX)} y2={yToView(-54)} />
            <text x={xToView(focusX)} y={yToView(-62)}>
              focus
            </text>
          </g>

          <g className={`play-sensor ${result.focusState}`}>
            <line x1={xToView(controls.sensorPosition)} y1={yToView(66)} x2={xToView(controls.sensorPosition)} y2={yToView(-66)} />
            <circle className="sensor-blur-circle" cx={xToView(controls.sensorPosition)} cy={yToView(result.sensorImageY)} r={blurRadius} />
            <circle className="sensor-image-point" cx={xToView(controls.sensorPosition)} cy={yToView(result.sensorImageY)} r="4" />
            <text x={xToView(controls.sensorPosition) + 8} y={yToView(70)}>
              sensor
            </text>
          </g>
        </svg>
      </div>

      <div className="playground-readout">
        <span>{focusLabel(result.focusState)}</span>
        <span>focus plane {result.focusPosition.toFixed(1)} rel.</span>
        <span>sensor blur radius {result.sensorBlurRadius.toFixed(1)} rel.</span>
        <span>image point {result.sensorImageY.toFixed(1)} rel.</span>
      </div>
      <p className="playground-helper">
        Focus plane is where the traced rays meet. Sensor plane is the adjustable image plane. Image point marks the ray
        bundle center on the sensor; blur circle shows how spread out it is.
      </p>

      <div className="playground-controls">
        <label>
          <span>Object distance</span>
          <input
            type="range"
            min="70"
            max="150"
            value={controls.objectDistance}
            disabled={!isNearObjectMode}
            onChange={(event) => updateControl("objectDistance", Number(event.target.value))}
          />
          <small>{isNearObjectMode ? `${controls.objectDistance} rel.` : "parallel rays from infinity"}</small>
        </label>

        <label>
          <span>{isNearObjectMode ? "Object height" : "Field height"}</span>
          <input
            type="range"
            min="8"
            max="34"
            value={controls.objectHeight}
            onChange={(event) => updateControl("objectHeight", Number(event.target.value))}
          />
          <small>{controls.objectHeight} rel.</small>
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
          <small>{presetElements.length} elements</small>
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
                <details
                  className={`element-control-card ${element.id === selectedElementId ? "selected" : ""}`}
                  key={element.id}
                  open={element.id === selectedElementId}
                >
                  <summary className="element-control-heading" onClick={() => setSelectedElementId(element.id)}>
                    <span
                      className="element-name-button"
                      onClick={() => setSelectedElementId(element.id)}
                    >
                      <span>{element.label}</span>
                      <p>
                        {group.label} / {element.elementType} / power {element.powerContribution.toFixed(4)}
                      </p>
                    </span>
                    <button type="button" onClick={() => resetElement(element)}>
                      Reset
                    </button>
                  </summary>

                  <label>
                    <span>Axial shift</span>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="0.5"
                      value={adjustment.axialShift}
                      onFocus={() => setSelectedElementId(element.id)}
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
                      onFocus={() => setSelectedElementId(element.id)}
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
                      onFocus={() => setSelectedElementId(element.id)}
                      onChange={(event) => updateElement(element.id, "tilt", Number(event.target.value))}
                    />
                    <small>{adjustment.tilt.toFixed(2)}</small>
                  </label>
                </details>
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
