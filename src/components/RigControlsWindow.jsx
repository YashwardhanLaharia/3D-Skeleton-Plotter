import { useRef, useState } from "react";
import { BODY_REGIONS } from "../rig/SkeletonRigController";

const ROTATE_BUTTONS = [
  { axis: "x", direction: -1, label: "Rotate −X" },
  { axis: "x", direction: 1, label: "Rotate +X" },
  { axis: "y", direction: -1, label: "Rotate −Y" },
  { axis: "y", direction: 1, label: "Rotate +Y" },
  { axis: "z", direction: -1, label: "Rotate −Z" },
  { axis: "z", direction: 1, label: "Rotate +Z" },
];

export default function RigControlsWindow() {
  const [selectedRegion, setSelectedRegion] = useState("torso");
  const commandId = useRef(0);

  function sendCommand(command) {
    commandId.current += 1;
    window.electronAPI?.sendRigCommand({ ...command, id: commandId.current });
  }

  function rotateSelectedRegion(axis, direction) {
    sendCommand({
      type: "rotate-region",
      region: selectedRegion,
      axis,
      amount: direction * 5,
    });
  }

  return (
    <main className="p-3">
      <h1 className="h5 mb-3">Rig Controls</h1>

      <h2 className="h6">Select body region</h2>
      <div className="d-flex flex-wrap gap-1">
        {Object.entries(BODY_REGIONS).map(([region, config]) => (
          <button
            key={region}
            type="button"
            className={`btn btn-sm ${
              selectedRegion === region
                ? "btn-primary"
                : "btn-outline-secondary"
            }`}
            aria-pressed={selectedRegion === region}
            onClick={() => setSelectedRegion(region)}
          >
            {config.label}
          </button>
        ))}
      </div>

      <h2 className="h6 mt-4">
        Rotate {BODY_REGIONS[selectedRegion].label.toLowerCase()} by 5°
      </h2>
      <div className="d-grid gap-2">
        {ROTATE_BUTTONS.map((button) => (
          <button
            key={`${button.axis}-${button.direction}`}
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => rotateSelectedRegion(button.axis, button.direction)}
          >
            {button.label}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2 mt-4">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => sendCommand({ type: "reset-region", region: selectedRegion })}
        >
          Reset selected
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
