import { useState } from "react";

export default function GravesPanel({
  graves,
  individuals,
  assignments,
  hidden,
  onToggle,
  onUpdate,
  onAssign,
  onImport,
  onReference,
  onFit,
  onRemove,
}) {
  const [pendingRemoval, setPendingRemoval] = useState(null);
  return (
    <section className="border-bottom p-2" aria-label="Surveyed graves">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h6 mb-0">Grave outlines</h2>
        <button className="btn btn-sm btn-outline-primary" onClick={onImport}>
          Import outline
        </button>
      </div>
      <p className="small text-body-secondary mb-2">
        Drag to rotate the view. Scroll to zoom.
      </p>
      {!graves.length && (
        <p className="small text-body-secondary">
          Import a surveyed top or base contour to add a grave.
        </p>
      )}
      {graves.map((grave) => (
        <details key={grave.id} className="mb-2 border rounded p-2" open>
          <summary className="small fw-semibold">
            {grave.name} · {grave.top.length} top / {grave.bottom.length} base
            points
          </summary>
          <div className="d-flex gap-2 align-items-center mt-2">
            <input
              type="color"
              className="form-control form-control-color form-control-sm"
              aria-label={`${grave.name} outline colour`}
              value={grave.colour}
              onChange={(e) => onUpdate(grave.id, { colour: e.target.value })}
            />
            <input
              className="form-control form-control-sm"
              aria-label={`${grave.name} name`}
              value={grave.name}
              onChange={(e) => onUpdate(grave.id, { name: e.target.value })}
            />
            <label className="small d-flex align-items-center gap-1">
              <input
                type="checkbox"
                checked={!hidden.includes(grave.id)}
                onChange={() => onToggle(grave.id)}
              />{" "}
              Show
            </label>
          </div>
          <label className="small mt-2 d-block">
            Cuts into
            <select
              className="form-select form-select-sm"
              value={grave.cutsInto || ""}
              onChange={(e) =>
                onUpdate(grave.id, { cutsInto: e.target.value || null })
              }
            >
              <option value="">None recorded</option>
              {graves
                .filter((other) => other.id !== grave.id)
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="small mt-2 d-block">
            Survey notes
            <input
              className="form-control form-control-sm"
              value={grave.notes}
              onChange={(e) => onUpdate(grave.id, { notes: e.target.value })}
            />
          </label>
          {["top", "bottom"]
            .filter((level) => grave[level].length)
            .map((level) => (
              <div className="small mt-2" key={level}>
                <strong>{level === "top" ? "Top" : "Base"}</strong>:{" "}
                {grave.references?.[level]?.mode === "rl"
                  ? `RL, floor ${grave.references[level].floorRL} m`
                  : "Height above floor"}
                {!grave.references?.[level] && (
                  <span className="d-block text-warning-emphasis">
                    Legacy Z values are treated as heights. Confirm the survey
                    reference.
                  </span>
                )}
                <button
                  className="btn btn-link btn-sm px-1"
                  onClick={() => onReference(grave, level)}
                >
                  Set reference
                </button>
              </div>
            ))}
          <div className="d-flex gap-2 mt-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onFit(grave.id)}
            >
              Frame grave
            </button>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => setPendingRemoval(grave.id)}
            >
              Remove outline
            </button>
          </div>
          {pendingRemoval === grave.id && (
            <div className="small mt-2" role="alert">
              Remove this grave's contours and its grave assignments?
              <div className="d-flex gap-2 mt-1">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setPendingRemoval(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    onRemove(grave.id);
                    setPendingRemoval(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </details>
      ))}
      {graves.length > 0 && individuals.length > 0 && (
        <details className="mt-2">
          <summary className="small">Individuals in graves</summary>
          {individuals.map((individual, index) => (
            <label className="small d-block mt-2" key={individual.id}>
              {individual.label || `Skeleton ${index + 1}`}
              <select
                className="form-select form-select-sm"
                value={assignments[individual.id] || ""}
                onChange={(e) =>
                  onAssign(individual.id, e.target.value || null)
                }
              >
                <option value="">Unassigned</option>
                {graves.map((grave) => (
                  <option key={grave.id} value={grave.id}>
                    {grave.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </details>
      )}
    </section>
  );
}
