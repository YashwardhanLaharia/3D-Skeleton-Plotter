import { useEffect, useRef, useState } from "react";
import { BODY_REGIONS, JOINT_ROTATIONS } from "../rigConfig.js";

const ROTATION_AXES = ["x", "y", "z"];
const ROTATION_STEP = 5;
const REPEAT_INTERVAL = 100;

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

function AxisHoldButtons({ label, onRotate }) {
  return (
    <div className="d-flex align-items-center gap-1 mb-1">
      <span className="small text-body-secondary flex-grow-1">{label}</span>
      <HoldButton onRepeat={() => onRotate(-1)}>−</HoldButton>
      <HoldButton onRepeat={() => onRotate(1)}>+</HoldButton>
    </div>
  );
}

export default function LimbRigControls() {
  const [selectedRegion, setSelectedRegion] = useState("head");
  const [selectedJoint, setSelectedJoint] = useState("neck");
  const [selectedAxis, setSelectedAxis] = useState("x");
  const commandId = useRef(0);

  function sendCommand(command) {
    commandId.current += 1;
    window.electronAPI?.sendRigCommand({ ...command, id: commandId.current });
  }

  function selectRegion(region) {
    setSelectedRegion(region);
    setSelectedJoint(BODY_REGIONS[region].jointIds[0]);
  }

  function rotateJoint(direction) {
    sendCommand({
      type: "rotate-joint",
      jointId: selectedJoint,
      axis: selectedAxis,
      amount: direction * ROTATION_STEP,
    });
  }

  function rotateRegion(axis, direction) {
    sendCommand({
      type: "rotate-region",
      region: selectedRegion,
      axis,
      amount: direction * ROTATION_STEP,
    });
  }

  const joint = JOINT_ROTATIONS[selectedJoint];
  const axisLimits = joint.limits[selectedAxis];
  const controlNote = selectedJoint.startsWith("fingertips")
    ? "middle-finger control"
    : selectedJoint.startsWith("toes")
      ? "third-toe control"
      : null;

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

      <div className="small text-body-secondary mt-3">
        {joint.label}: {axisLimits[0]}° to {axisLimits[1]}°
        {controlNote && ` (${controlNote})`}
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
          Joint −{ROTATION_STEP}°
        </HoldButton>
        <HoldButton onRepeat={() => rotateJoint(1)}>
          Joint +{ROTATION_STEP}°
        </HoldButton>
      </div>

      <div className="small text-body-secondary mt-4 mb-1">
        Rotate selected region by {ROTATION_STEP}°
      </div>
      {ROTATION_AXES.map((axis) => (
        <AxisHoldButtons
          key={axis}
          label={`Rotate ${axis.toUpperCase()}`}
          onRotate={(direction) => rotateRegion(axis, direction)}
        />
      ))}

      <div className="d-flex gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => sendCommand({ type: "reset-joint", jointId: selectedJoint })}
        >
          Reset joint
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => sendCommand({ type: "reset-region", region: selectedRegion })}
        >
          Reset limb
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => sendCommand({ type: "reset-all" })}
        >
          Reset all
        </button>
      </div>
    </main>
  );
}
