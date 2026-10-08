import { useEffect, useState } from "react";
import {
  placementFromSize,
  validateOverlayPlacement,
} from "../imageOverlay.js";

function draftFor(overlay) {
  return {
    x: String(overlay.origin.x),
    y: String(overlay.origin.y),
    width: String(
      Math.hypot(
        overlay.xCorner.x - overlay.origin.x,
        overlay.xCorner.y - overlay.origin.y,
      ),
    ),
    length: String(
      Math.hypot(
        overlay.yCorner.x - overlay.origin.x,
        overlay.yCorner.y - overlay.origin.y,
      ),
    ),
    rotation: String(
      (Math.atan2(
        overlay.xCorner.y - overlay.origin.y,
        overlay.xCorner.x - overlay.origin.x,
      ) *
        180) /
        Math.PI,
    ),
    heightAboveFloor: String(overlay.heightAboveFloor),
    originX: String(overlay.origin.x),
    originY: String(overlay.origin.y),
    rightX: String(overlay.xCorner.x),
    rightY: String(overlay.xCorner.y),
    topX: String(overlay.yCorner.x),
    topY: String(overlay.yCorner.y),
  };
}

export default function ImageOverlaySettingsModal({
  show,
  overlay,
  onHide,
  onApply,
  onLoad,
  onFrame,
  onRemove,
}) {
  const [mode, setMode] = useState("size");
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!show || !overlay) return;
    setDraft(draftFor(overlay));
    setError(null);
    setRemoving(false);
  }, [show, overlay]);

  if (!show || !overlay) return null;

  function field(key, label) {
    return (
      <label className="form-label small mb-1 d-block">
        {label}
        <input
          className="form-control form-control-sm"
          type="number"
          step="any"
          required
          value={draft[key] ?? ""}
          onChange={(e) =>
            setDraft((current) => ({ ...current, [key]: e.target.value }))
          }
        />
      </label>
    );
  }

  function apply(event) {
    event.preventDefault();
    try {
      const n = (key) => {
        if (!draft[key]?.trim() || !Number.isFinite(Number(draft[key])))
          throw new Error("Complete all alignment fields with finite numbers.");
        return Number(draft[key]);
      };
      const shared = {
        heightAboveFloor: n("heightAboveFloor"),
        opacity: overlay.opacity,
        visible: overlay.visible,
      };
      const placement =
        mode === "size"
          ? placementFromSize({
              x: n("x"),
              y: n("y"),
              width: n("width"),
              length: n("length"),
              rotation: n("rotation"),
              ...shared,
            })
          : validateOverlayPlacement({
              origin: { x: n("originX"), y: n("originY") },
              xCorner: { x: n("rightX"), y: n("rightY") },
              yCorner: { x: n("topX"), y: n("topY") },
              ...shared,
            });
      onApply({ ...overlay, ...placement });
      setError(null);
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <>
      <div
        className="modal modal-open"
        style={{ display: "block" }}
        data-bs-backdrop="static"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-settings-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="overlay-settings-title">
                Site photograph settings
              </h1>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <p className="small text-break mb-3">
                {overlay.source} · {overlay.pixelWidth} × {overlay.pixelHeight}{" "}
                px
              </p>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={onLoad}
                >
                  Replace image
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onFrame}
                >
                  Frame image
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => setRemoving(true)}
                >
                  Remove image
                </button>
              </div>

              {removing && (
                <div className="alert alert-warning small py-2" role="alert">
                  Remove the photograph from this project?
                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setRemoving(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        onRemove();
                        onHide();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <label className="small d-flex gap-2 align-items-center">
                <input
                  type="checkbox"
                  checked={overlay.visible}
                  onChange={(e) =>
                    onApply({ ...overlay, visible: e.target.checked })
                  }
                />{" "}
                Show photograph
              </label>
              <label className="small d-block mt-2 mb-3">
                Opacity: {Math.round(overlay.opacity * 100)}%
                <input
                  className="form-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={overlay.opacity}
                  onChange={(e) =>
                    onApply({ ...overlay, opacity: Number(e.target.value) })
                  }
                />
              </label>

              <form onSubmit={apply}>
                <label className="form-label small mb-1 d-block">
                  Alignment
                  <select
                    className="form-select form-select-sm"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      setError(null);
                    }}
                  >
                    <option value="size">Size and rotation</option>
                    <option value="corners">Surveyed corners</option>
                  </select>
                </label>
                <p className="small text-body-secondary mt-2 mb-2">
                  Coordinates are metres in the same local X/Y grid as the
                  skeletons. Use surveyed corners for accurate alignment.
                </p>
                {mode === "size" ? (
                  <>
                    <div className="row g-2">
                      <div className="col-6">
                        {field("x", "Bottom-left X (m)")}
                      </div>
                      <div className="col-6">
                        {field("y", "Bottom-left Y (m)")}
                      </div>
                    </div>
                    <div className="row g-2 mt-1">
                      <div className="col-6">
                        {field("width", "Image width (m)")}
                      </div>
                      <div className="col-6">
                        {field("length", "Image length (m)")}
                      </div>
                    </div>
                    <div className="mt-2">
                      {field("rotation", "Rotation (degrees)")}
                    </div>
                    <p className="small text-body-secondary mt-1">
                      Positive rotation turns the image width from +X towards
                      +Y. Applying this mode makes a rectangle.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="small mt-2 mb-2">
                      Enter the image’s bottom-left, bottom-right and top-left
                      corners. The fourth corner is calculated as a
                      parallelogram; this does not correct camera perspective.
                    </p>
                    {[
                      ["originX", "originY", "Bottom-left"],
                      ["rightX", "rightY", "Bottom-right"],
                      ["topX", "topY", "Top-left"],
                    ].map(([x, y, label]) => (
                      <div className="row g-2 mt-1" key={x}>
                        <div className="col-6">
                          {field(x, `${label} X (m)`)}
                        </div>
                        <div className="col-6">
                          {field(y, `${label} Y (m)`)}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <div className="mt-2">
                  {field("heightAboveFloor", "Height above grave floor (m)")}
                </div>
                <p className="small text-body-secondary mt-1 mb-3">
                  0 places the image on the grave floor. This is a height, not a
                  raw RL value.
                </p>
                {error && (
                  <p className="small text-danger" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-sm btn-primary" type="submit">
                  Apply alignment
                </button>
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onHide}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show new-project-modal-backdrop" />
    </>
  );
}
