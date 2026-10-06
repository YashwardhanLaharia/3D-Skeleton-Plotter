import { useState } from "react";
import { validateContourReference } from "../graveContourData.js";

export default function GraveOutlineImportModal({
  survey,
  graves = [],
  onHide,
  onImport,
}) {
  const [level, setLevel] = useState(survey.level ?? "");
  const [targetId, setTargetId] = useState(survey.targetId || "new");
  const [name, setName] = useState(
    survey.source?.startsWith("LN19")
      ? "LN19 BP135"
      : survey.source === "Grave outline.xlsx"
        ? "LN24"
        : "Grave outline",
  );
  const [mode, setMode] = useState(survey.reference?.mode || "");
  const [floorRL, setFloorRL] = useState(survey.reference?.floorRL ?? "");
  const [xOffset, setXOffset] = useState(survey.reference?.xOffset ?? "0");
  const [yOffset, setYOffset] = useState(survey.reference?.yOffset ?? "0");
  const [keepOther, setKeepOther] = useState(true);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    try {
      if (!["top", "bottom"].includes(level))
        throw new Error(
          "Choose whether the grave cut is the top or base contour",
        );
      const reference = validateContourReference({
        mode,
        floorRL,
        xOffset,
        yOffset,
        source: survey.source,
      });
      onImport({ targetId, name, level, reference, keepOther });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <>
      <div
        className="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grave-outline-title"
        style={{ display: "block" }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <form className="modal-content" onSubmit={submit}>
            <div className="modal-header">
              <h1 id="grave-outline-title" className="modal-title fs-5">
                Import grave outline
              </h1>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <p>
                <strong>{survey.source}</strong>
                <br />
                {survey.description}. {survey.points.length} perimeter vertices.
              </p>
              {!survey.level && (
                <p className="text-muted">
                  This file does not identify the cut as a top or base contour.
                  Select its meaning from your survey records.
                </p>
              )}
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="outline-grave">
                    Grave
                  </label>
                  <select
                    id="outline-grave"
                    className="form-select"
                    value={targetId}
                    disabled={Boolean(survey.targetId)}
                    onChange={(event) => setTargetId(event.target.value)}
                  >
                    <option value="new">Add a separate grave</option>
                    {graves.map((grave) => (
                      <option key={grave.id} value={grave.id}>
                        {grave.name}
                      </option>
                    ))}
                  </select>
                </div>
                {targetId === "new" && (
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="outline-name">
                      Grave name
                    </label>
                    <input
                      id="outline-name"
                      className="form-control"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="outline-level">
                    Contour
                  </label>
                  <select
                    id="outline-level"
                    className="form-select"
                    value={level}
                    disabled={Boolean(survey.level)}
                    onChange={(event) => setLevel(event.target.value)}
                    required
                  >
                    <option value="">Choose contour</option>
                    <option value="top">Top</option>
                    <option value="bottom">Base</option>
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="outline-mode">
                    Vertical coordinates
                  </label>
                  <select
                    id="outline-mode"
                    className="form-select"
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                    required
                  >
                    <option value="">Choose survey convention</option>
                    <option value="rl">RL: larger values are deeper</option>
                    <option value="height">Height above grave floor</option>
                  </select>
                </div>
                {mode === "rl" && (
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="outline-floor-rl">
                      Grave-floor RL (metres)
                    </label>
                    <input
                      id="outline-floor-rl"
                      className="form-control"
                      type="number"
                      step="any"
                      value={floorRL}
                      onChange={(event) => setFloorRL(event.target.value)}
                      required
                    />
                    <div className="form-text">
                      Use the recorded floor RL. It cannot be inferred from
                      these files.
                    </div>
                  </div>
                )}
              </div>
              <details className="mt-3">
                <summary>Align to the current site grid</summary>
                <p className="form-text">
                  Offsets are added to source coordinates. Leave zero when the
                  skeletons and outline already use the same grid. LN19
                  screenshot body Y values are 4 m lower than the supplied ROT
                  file; confirm the intended frame before using an offset.
                </p>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label htmlFor="outline-x-offset" className="form-label">
                      X offset (metres)
                    </label>
                    <input
                      id="outline-x-offset"
                      className="form-control"
                      type="number"
                      step="any"
                      value={xOffset}
                      onChange={(event) => setXOffset(event.target.value)}
                      required
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="outline-y-offset" className="form-label">
                      Y offset (metres)
                    </label>
                    <input
                      id="outline-y-offset"
                      className="form-control"
                      type="number"
                      step="any"
                      value={yOffset}
                      onChange={(event) => setYOffset(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </details>
              {targetId !== "new" && !survey.targetId && (
                <div className="form-check mt-3">
                  <input
                    id="outline-keep-other"
                    className="form-check-input"
                    type="checkbox"
                    checked={keepOther}
                    onChange={(event) => setKeepOther(event.target.checked)}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="outline-keep-other"
                  >
                    Keep the other contour already loaded for this same grave
                  </label>
                </div>
              )}
              <p className="form-text mt-3">
                A separate grave keeps the other outlines. Adding to an existing
                grave replaces its selected contour. Match the skeletons' site
                grid and vertical reference. Raw survey values are retained when
                saving.
              </p>
              {error && (
                <div role="alert" className="alert alert-danger">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onHide}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Import contour
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show new-project-modal-backdrop" />
    </>
  );
}
