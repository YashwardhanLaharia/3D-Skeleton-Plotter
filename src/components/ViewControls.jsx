// Preset views for the viewport, next to the navigation gizmo.
//
// These exist because a plan and a fixed elevation are how a grave gets drawn
// and measured, and free orbit cannot get you to either of them reliably. The
// buttons say which view is active rather than only moving the camera, so it is
// always obvious whether what is on screen is a measurement or a look at
// something.

import { CAMERA_PRESETS } from "../cameraViews.js";

const ORDER = ["plan", "left", "right"];

export default function ViewControls({ view, onChange }) {
  return (
    <div
      className="view-controls bg-body border rounded shadow-sm"
      role="group"
      aria-label="Preset views"
    >
      {ORDER.map((id) => {
        const preset = CAMERA_PRESETS[id];
        const active = view === id;

        return (
          <button
            key={id}
            type="button"
            className={`view-preset-btn ${active ? "view-preset-btn-active" : ""}`}
            onClick={() => onChange(active ? null : id)}
            aria-pressed={active}
            title={`${preset.label} view (${preset.key})`}
          >
            {preset.label}
          </button>
        );
      })}

      <button
        type="button"
        className={`view-preset-btn ${view ? "" : "view-preset-btn-active"}`}
        onClick={() => onChange(null)}
        aria-pressed={!view}
        title="Free orbit (4)"
      >
        Orbit
      </button>
    </div>
  );
}