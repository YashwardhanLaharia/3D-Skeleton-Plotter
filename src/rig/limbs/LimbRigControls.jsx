import { useEffect, useRef, useState } from "react";
import { BODY_REGIONS, JOINT_ROTATIONS } from "../rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES } from "../digits/digitsConfig.js";
import { SEGMENT_GROUPS, SEGMENT_SCALES } from "../scaling/segmentConfig.js";
import { BODY_DIMENSIONS } from "../scaling/dimensionConfig.js";

// UI controls use small repeated degree steps rather than exposing raw model transforms.
const ROTATION_AXES = ["x", "y", "z"];
const ROTATION_STEP = 5;
const REPEAT_INTERVAL = 100;
const SCALE_STEP = 0.05;

/** Repeats a rotation command while the pointer remains pressed. */
function HoldButton({ children, onRepeat, className = "btn btn-outline-secondary" }) {
  const interval = useRef(null);

  function stopRepeating() {
    if (interval.current) {
      clearInterval(interval.current);
      interval.current = null;
    }
  }

  function startRepeating() {
    stopRepeating();
    onRepeat();
    interval.current = setInterval(onRepeat, REPEAT_INTERVAL);
  }

  useEffect(() => stopRepeating, []);

  return (
    <button
      type="button"
      className={className}
      onPointerDown={startRepeating}
      onPointerUp={stopRepeating}
      onPointerLeave={stopRepeating}
      onPointerCancel={stopRepeating}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}

/**
 * Renders the standalone controls window and sends model-independent commands
 * through the preload bridge to the main skeleton view.
 */
export default function LimbRigControls() {
  const [selectedRegion, setSelectedRegion] = useState("head");
  const [selectedJoint, setSelectedJoint] = useState("neck");
  const [selectedDigit, setSelectedDigit] = useState("1");
  const [selectedAxis, setSelectedAxis] = useState("x");
  const [scaleTarget, setScaleTarget] = useState("whole:all");
  const [scaleFactors, setScaleFactors] = useState({});
  const commandId = useRef(0);
  const scaleFactor = scaleFactors[scaleTarget] ?? 1;

  const jointType = DIGIT_JOINT_TYPES[selectedJoint];
  const digitConfig = jointType ? DIGITS[jointType] : null;
  const digitMode = Boolean(digitConfig);
  const digitList = digitConfig
    ? Object.entries(digitConfig.labelFor)
    : [];

  // IDs let future IPC acknowledgements correlate repeated hold-button commands.
  function sendCommand(command) {
    commandId.current += 1;
    window.electronAPI?.sendRigCommand({ ...command, id: commandId.current });
  }

  function selectRegion(region) {
    setSelectedRegion(region);
    setSelectedJoint(BODY_REGIONS[region].jointIds[0]);
  }

  // Digit selections reuse the same UI action but emit a different command type.
  function rotateJoint(direction) {
    if (digitMode) {
      sendCommand({
        type: "rotate-digit",
        jointId: selectedJoint,
        digit: selectedDigit,
        axis: selectedAxis,
        amount: direction * ROTATION_STEP,
      });
      return;
    }
    sendCommand({
      type: "rotate-joint",
      jointId: selectedJoint,
      axis: selectedAxis,
      amount: direction * ROTATION_STEP,
    });
  }

  function sendScale(factor) {
    const [targetType, targetId] = scaleTarget.split(":");
    if (targetType === "group") {
      sendCommand({ type: "set-segment-group-scale", groupId: targetId, factor });
    } else if (targetType === "dimension") {
      sendCommand({ type: "set-body-dimension", dimensionId: targetId, factor });
    } else if (targetType === "whole") {
      sendCommand({ type: "set-skeleton-scale", factor });
    } else if (targetType === "uniform") {
      sendCommand({ type: "set-uniform-scale", factor });
    } else {
      sendCommand({ type: "set-segment-scale", segmentId: targetId, factor });
    }
  }

  function rememberScale(target, factor) {
    setScaleFactors((current) => {
      const next = { ...current, [target]: factor };
      const [targetType, targetId] = target.split(":");
      if (targetType === "whole") {
        for (const segmentId of Object.keys(SEGMENT_SCALES)) {
          next[`segment:${segmentId}`] = factor;
        }
        for (const groupId of Object.keys(SEGMENT_GROUPS)) {
          next[`group:${groupId}`] = factor;
        }
        for (const dimensionId of Object.keys(BODY_DIMENSIONS)) {
          next[`dimension:${dimensionId}`] = factor;
        }
      } else if (targetType === "group") {
        delete next["whole:all"];
        for (const segmentId of SEGMENT_GROUPS[targetId].segmentIds) {
          next[`segment:${segmentId}`] = factor;
        }
      } else if (targetType === "segment") {
        delete next["whole:all"];
        for (const [groupId, group] of Object.entries(SEGMENT_GROUPS)) {
          if (group.segmentIds.includes(targetId)) delete next[`group:${groupId}`];
        }
      } else if (targetType === "dimension") {
        delete next["whole:all"];
      }
      return next;
    });
  }

  function adjustScale(direction) {
    const currentFactor = Number.isFinite(scaleFactor) ? scaleFactor : 1;
    const nextFactor = Number(
      (currentFactor + direction * SCALE_STEP).toFixed(2),
    );
    // Nudging stays positive; any positive factor renders literally.
    if (nextFactor <= 0) return;
    rememberScale(scaleTarget, nextFactor);
    sendScale(nextFactor);
  }

  function resetScale() {
    const [targetType, targetId] = scaleTarget.split(":");
    rememberScale(scaleTarget, 1);
    if (targetType === "group") {
      sendScale(1);
    } else if (targetType === "dimension") {
      sendCommand({ type: "reset-body-dimension", dimensionId: targetId });
    } else if (targetType === "whole") {
      sendScale(1);
    } else if (targetType === "uniform") {
      sendCommand({ type: "reset-uniform-scale" });
    } else {
      sendCommand({ type: "reset-segment-scale", segmentId: targetId });
    }
  }

  const joint = JOINT_ROTATIONS[selectedJoint];
  const axisLimits = digitConfig?.limits[selectedAxis] ?? joint.limits[selectedAxis];
  const selectedDigitLabel = digitConfig
    ? digitConfig.labelFor[selectedDigit] ?? ""
    : "";

  return (
    <main className="p-3">
      <h1 className="h5 mb-3">Rig Controls</h1>

      <label className="form-label small mb-1" htmlFor="limb-select">
        Body region
      </label>
      <select
        id="limb-select"
        className="form-select form-select-sm"
        value={selectedRegion}
        onChange={(event) => selectRegion(event.target.value)}
      >
        {Object.entries(BODY_REGIONS).map(([region, config]) => (
          <option key={region} value={region}>
            {config.label}
          </option>
        ))}
      </select>

      <label className="form-label small mt-3 mb-1" htmlFor="limb-joint-select">
        Joint
      </label>
      <select
        id="limb-joint-select"
        className="form-select form-select-sm"
        value={selectedJoint}
        onChange={(event) => setSelectedJoint(event.target.value)}
      >
        {BODY_REGIONS[selectedRegion].jointIds.map((jointId) => (
          <option key={jointId} value={jointId}>
            {JOINT_ROTATIONS[jointId].label}
          </option>
        ))}
      </select>

      {digitMode && (
        <>
          <label className="form-label small mt-3 mb-1" htmlFor="limb-digit-select">
            {digitConfig.label}
          </label>
          <select
            id="limb-digit-select"
            className="form-select form-select-sm"
            value={selectedDigit}
            onChange={(event) => setSelectedDigit(event.target.value)}
          >
            {digitList.map(([digit, label]) => (
              <option key={digit} value={digit}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="small text-body-secondary mt-3">
        {digitMode
          ? `${selectedDigitLabel}: ${axisLimits[0]}° to ${axisLimits[1]}°`
          : `${joint.label}: ${axisLimits[0]}° to ${axisLimits[1]}°`}
      </div>

      <div className="d-flex gap-1 mt-2">
        {ROTATION_AXES.map((axis) => (
          <button
            key={axis}
            type="button"
            className={`btn btn-sm ${
              selectedAxis === axis
                ? "btn-primary"
                : "btn-outline-secondary"
            }`}
            aria-pressed={selectedAxis === axis}
            onClick={() => setSelectedAxis(axis)}
          >
            {axis.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2 mt-2">
        <HoldButton onRepeat={() => rotateJoint(-1)}>
          {digitMode ? "Digit" : "Joint"} −{ROTATION_STEP}°
        </HoldButton>
        <HoldButton onRepeat={() => rotateJoint(1)}>
          {digitMode ? "Digit" : "Joint"} +{ROTATION_STEP}°
        </HoldButton>
      </div>

      <div className="d-flex gap-2 mt-3">
        {digitMode && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() =>
              sendCommand({ type: "reset-digit", jointId: selectedJoint, digit: selectedDigit })
            }
          >
            Reset digit
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => sendCommand({ type: "reset-joint", jointId: selectedJoint })}
        >
          Reset joint
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => sendCommand({ type: "reset-all" })}
        >
          Reset all
        </button>
      </div>

      <hr className="my-4" />
      <h2 className="h6 mb-3">Bone and body scaling</h2>

      <label className="form-label small mb-1" htmlFor="scale-target-select">
        Segment or group
      </label>
      <select
        id="scale-target-select"
        className="form-select form-select-sm"
        value={scaleTarget}
        onChange={(event) => {
          setScaleTarget(event.target.value);
        }}
      >
        <optgroup label="Entire skeleton">
          <option value="whole:all">All morphology controls</option>
          <option value="uniform:all">Uniform resize (everything)</option>
        </optgroup>
        <optgroup label="Individual segments">
          {Object.entries(SEGMENT_SCALES).map(([segmentId, config]) => (
            <option key={segmentId} value={`segment:${segmentId}`}>
              {config.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Segment groups">
          {Object.entries(SEGMENT_GROUPS).map(([groupId, config]) => (
            <option key={groupId} value={`group:${groupId}`}>
              {config.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Body dimensions">
          {Object.entries(BODY_DIMENSIONS).map(([dimensionId, config]) => (
            <option key={dimensionId} value={`dimension:${dimensionId}`}>
              {config.label}
            </option>
          ))}
        </optgroup>
      </select>

      <label className="form-label small mt-3 mb-1" htmlFor="scale-factor-input">
        Scale factor (1 is the model&apos;s own size)
      </label>
      <div className="input-group input-group-sm">
        <input
          id="scale-factor-input"
          className="form-control"
          type="number"
          min={SCALE_STEP}
          step={SCALE_STEP}
          value={scaleFactor}
          onChange={(event) => rememberScale(scaleTarget, Number(event.target.value))}
        />
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={!Number.isFinite(scaleFactor) || scaleFactor <= 0}
          onClick={() => sendScale(scaleFactor)}
        >
          Apply
        </button>
      </div>

      <div className="d-flex gap-2 mt-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => adjustScale(-1)}
        >
          Shorten {SCALE_STEP}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => adjustScale(1)}
        >
          Lengthen {SCALE_STEP}
        </button>
      </div>

      <div className="d-flex gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={resetScale}
        >
          Reset selection
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => {
            setScaleFactors((current) => Object.fromEntries(
              Object.entries(current).filter(([key]) =>
                key.startsWith("dimension:") || key.startsWith("uniform:")
              )
            ));
            sendCommand({ type: "reset-all-segment-scales" });
          }}
        >
          Reset all lengths
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => {
            setScaleFactors((current) => Object.fromEntries(
              Object.entries(current).filter(([key]) =>
                key.startsWith("segment:") ||
                key.startsWith("group:") ||
                key.startsWith("uniform:")
              )
            ));
            sendCommand({ type: "reset-all-body-dimensions" });
          }}
        >
          Reset body dimensions
        </button>
      </div>
    </main>
  );
}
