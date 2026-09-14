import { useRef, useState } from "react";
import { SPAWNABLE_BONES, SPAWNABLE_BONE_IDS } from "./boneCatalog.js";

// Manual testing window for the spawnBone rig API.
// Fire-and-forget like LimbRigControls: commands go through the preload
// bridge to the targeted skeleton in the main view; results are observed in
// the viewport. Instance IDs are client-generated so this window can track
// update/despawn/visibility per spawn without a return channel.

const DECIMAL_PATTERN = /^-?\d*\.?\d*$/;

function newInstanceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bone-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function parsePoint({ x, y, z }) {
  const point = { x: Number(x), y: Number(y), z: Number(z) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
    return null;
  }
  return point;
}

// Fingers and toes drown out the dropdown; they stay testable behind the toggle.
function isSignificantBone(boneId) {
  return !/^(finger|toe)_[1-5]_[lr]$/.test(boneId);
}

function CoordInputs({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="form-label small mb-1">{label}</div>
      <div className="d-flex gap-1">
        {["x", "y", "z"].map((axis) => (
          <input
            key={axis}
            className="form-control form-control-sm"
            type="text"
            inputMode="decimal"
            placeholder={axis.toUpperCase()}
            aria-label={`${label} ${axis.toUpperCase()}`}
            value={value[axis]}
            onChange={(e) => {
              if (DECIMAL_PATTERN.test(e.target.value)) {
                onChange(axis, e.target.value);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function BoneSpawnControls() {
  const [boneId, setBoneId] = useState("thigh_l");
  const [superior, setSuperior] = useState({ x: "0", y: "0", z: "0" });
  const [inferior, setInferior] = useState({ x: "0", y: "-0.45", z: "0" });
  const [hideMaster, setHideMaster] = useState(true);
  const [showAllBones, setShowAllBones] = useState(false);
  const [instances, setInstances] = useState([]);
  const [error, setError] = useState(null);
  const commandId = useRef(0);

  function sendCommand(command) {
    commandId.current += 1;
    window.electronAPI?.sendRigCommand({ ...command, id: commandId.current });
  }

  function setPoint(setter) {
    return (axis, value) => setter((current) => ({ ...current, [axis]: value }));
  }

  function applyPreset(kind) {
    if (kind === "vertical") {
      setSuperior({ x: "0", y: "0", z: "0" });
      setInferior({ x: "0", y: "-0.45", z: "0" });
    } else if (kind === "offset") {
      setSuperior({ x: "0.5", y: "0.2", z: "0" });
      setInferior({ x: "0.5", y: "-0.25", z: "0.1" });
    } else if (kind === "short") {
      setSuperior({ x: "0", y: "0", z: "0" });
      setInferior({ x: "0", y: "-0.1", z: "0" });
    }
    setError(null);
  }

  function handleSpawn() {
    const sup = parsePoint(superior);
    const inf = parsePoint(inferior);
    if (!sup || !inf) {
      setError("Superior and inferior need finite X, Y, Z.");
      return;
    }
    if (sup.x === inf.x && sup.y === inf.y && sup.z === inf.z) {
      setError("Superior and inferior must not coincide.");
      return;
    }
    const instanceId = newInstanceId();
    sendCommand({
      type: "spawn-bone",
      boneId,
      superior: sup,
      inferior: inf,
      options: { hideMaster, instanceId },
    });
    setInstances((current) => [
      ...current,
      { instanceId, boneId, superior: sup, inferior: inf, visible: true },
    ]);
    setError(null);
  }

  function handleUpdate(instanceId) {
    const sup = parsePoint(superior);
    const inf = parsePoint(inferior);
    if (!sup || !inf) {
      setError("Superior and inferior need finite X, Y, Z.");
      return;
    }
    sendCommand({ type: "update-spawned-bone", instanceId, superior: sup, inferior: inf });
    setInstances((current) =>
      current.map((entry) =>
        entry.instanceId === instanceId ? { ...entry, superior: sup, inferior: inf } : entry
      )
    );
    setError(null);
  }

  function handleVisibility(instanceId, visible) {
    sendCommand({ type: "set-spawned-bone-visibility", instanceId, visible });
    setInstances((current) =>
      current.map((entry) =>
        entry.instanceId === instanceId ? { ...entry, visible } : entry
      )
    );
  }

  function handleDespawn(instanceId) {
    sendCommand({ type: "despawn-bone", instanceId });
    setInstances((current) => current.filter((entry) => entry.instanceId !== instanceId));
  }

  function handleClear() {
    sendCommand({ type: "clear-spawned-bones" });
    setInstances([]);
  }

  return (
    <main className="p-3">
      <h1 className="h5 mb-1">Bone Controls</h1>
      <p className="small text-body-secondary mb-3">
        Manual testing for the spawnBone rig API. Commands apply to the targeted
        skeleton (open individual in the sidebar).
      </p>

      <label className="form-label small mb-1" htmlFor="bone-select">
        Bone
      </label>
      <select
        id="bone-select"
        className="form-select form-select-sm"
        value={boneId}
        onChange={(event) => setBoneId(event.target.value)}
      >
        {SPAWNABLE_BONE_IDS.filter((id) => showAllBones || isSignificantBone(id)).map((id) => (
          <option key={id} value={id}>
            {SPAWNABLE_BONES[id].label}
          </option>
        ))}
      </select>

      <div className="form-check mt-1 mb-2">
        <input
          id="show-all-bones-check"
          className="form-check-input"
          type="checkbox"
          checked={showAllBones}
          onChange={(event) => {
            const show = event.target.checked;
            setShowAllBones(show);
            if (!show && !isSignificantBone(boneId)) {
              setBoneId("thigh_l");
            }
          }}
        />
        <label className="form-check-label small" htmlFor="show-all-bones-check">
          Show finger/toe bones
        </label>
      </div>

      <div className="mt-2">
        <CoordInputs label="Superior (proximal)" value={superior} onChange={setPoint(setSuperior)} />
        <CoordInputs label="Inferior (distal)" value={inferior} onChange={setPoint(setInferior)} />
      </div>

      <div className="form-check mb-2">
        <input
          id="hide-master-check"
          className="form-check-input"
          type="checkbox"
          checked={hideMaster}
          onChange={(event) => setHideMaster(event.target.checked)}
        />
        <label className="form-check-label small" htmlFor="hide-master-check">
          Hide master meshes on spawn
        </label>
      </div>

      <div className="d-flex gap-1 flex-wrap mb-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => applyPreset("vertical")}>
          Preset: vertical
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => applyPreset("offset")}>
          Preset: offset
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => applyPreset("short")}>
          Preset: short
        </button>
      </div>

      {error && (
        <div className="alert alert-danger py-1 px-2 small" role="alert">
          {error}
        </div>
      )}

      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={handleSpawn}>
          Spawn bone
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleClear}>
          Clear all
        </button>
      </div>

      <hr className="my-3" />
      <h2 className="h6 mb-2">Spawned instances ({instances.length})</h2>
      {instances.length === 0 && (
        <p className="small text-body-secondary mb-0">Nothing spawned yet from this window.</p>
      )}
      {instances.map((entry) => (
        <div key={entry.instanceId} className="border rounded p-2 mb-2">
          <div className="small fw-semibold">{SPAWNABLE_BONES[entry.boneId]?.label ?? entry.boneId}</div>
          <div className="small text-body-secondary font-monospace">
            {entry.instanceId.slice(0, 8)}
          </div>
          <div className="d-flex gap-1 flex-wrap mt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleUpdate(entry.instanceId)}
              title="Re-send current superior/inferior inputs to this instance"
            >
              Update
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleVisibility(entry.instanceId, !entry.visible)}
            >
              {entry.visible ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDespawn(entry.instanceId)}
            >
              Despawn
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
