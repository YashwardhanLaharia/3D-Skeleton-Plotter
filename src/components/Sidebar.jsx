// The individuals panel. One collapsible section per body in the grave, each
// containing a coordinate table: one row per survey point with number, label,
// and three inputs for X, Y, Z.
import { JOINTS } from "../joints";
import { useState, useEffect, useRef } from "react";

const DECIMAL_PATTERN = /^\d*\.?\d*$/;

// Data-entry grid navigation with keyboard arrows
function moveFocus(input, rowDelta, colDelta) {
  const grid = input.closest(".individual");
  if (!grid) return;

  const inputs = Array.from(grid.querySelectorAll(".coord-input"));
  const index = inputs.indexOf(input);
  if (index === -1) return;

  const next = index + rowDelta * 3 + colDelta;
  if (next < 0 || next >= inputs.length) return;

  inputs[next].focus();
  inputs[next].select();
}

// One row of the table. Purely presentational: displays what it's given, tells the parent when the user types.
function JointRow({
  number,
  label,
  jointId,
  values,
  onChange,
  onCommit,
  highlightAxis,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (highlightAxis) {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightAxis]);

  return (
    <div className="d-flex align-items-center gap-1 mb-1">
      <span className="joint-num text-body-tertiary text-end">{number}</span>

      <label className="joint-label text-body-secondary text-truncate mb-0">
        {label}
      </label>

      {["x", "y", "z"].map((axis) => (
        // Generate 3 identical inputs
        <input
          key={axis}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.]?[0-9]*"
          className={`form-control form-control-sm coord-input${
            highlightAxis === axis ? " coord-input-flash" : ""
          }`}
          placeholder={axis.toUpperCase()}
          aria-label={`${label}, ${axis.toUpperCase()}`}
          value={values[axis]}
          onChange={(e) => {
            const nextValue = e.target.value;
            if (DECIMAL_PATTERN.test(nextValue)) {
              onChange(jointId, axis, nextValue);
            }
          }}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveFocus(e.target, 1, 0);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              moveFocus(e.target, -1, 0);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              moveFocus(e.target, 1, 0);
            }
          }}
          ref={highlightAxis === axis ? inputRef : null}
        />
      ))}
    </div>
  );
}

// One individual: a clickable header that summarises them, and their 25 rows
// underneath when expanded.
function IndividualSection({
  individual,
  isOpen,
  onToggle,
  onChange,
  onCommit,
  onRemove,
  canRemove,
  onColourChange,
  onLabelChange,
  highlight,
}) {
  // A point counts as recorded only when all three axes are filled. Partial
  // entries are treated as not yet done.
  const filledCount = JOINTS.filter((joint) => {
    const v = individual.coords[joint.id];
    return v.x !== "" && v.y !== "" && v.z !== "";
  }).length;

  return (
    // The whole header toggles, so I used a button rather than a div
    <section className="individual border rounded mb-2 bg-body">
      <button
        type="button"
        className="individual-header btn w-100 d-flex align-items-center gap-2 text-start"
        onClick={() => onToggle(individual.id)}
        aria-expanded={isOpen}
      >
        <input
          type="color"
          className={`form-control form-control-color${
            highlight?.field === "colour" ? " coord-input-flash" : ""
          }`}
          id="colorPicker"
          value={individual.colour}
          title="Choose your color"
          style={{ height: "24px", width: "29px", padding: "5px", margin: "0" }}
          onChange={(e) => onColourChange(individual.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommit}
        />
        <input
          type="text"
          className={`form-control form-control-sm label-input${
            highlight?.field === "label" ? " coord-input-flash" : ""
          }`}
          placeholder="Label"
          aria-label="Label"
          value={individual.label}
          onChange={(e) => onLabelChange(individual.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommit}
        />
        <small className="text-body-tertiary">
          {filledCount}/{JOINTS.length}
        </small>
        {canRemove && (
          <span
            role="button"
            tabIndex={0}
            className="btn-close btn-close-sm"
            aria-label={`Remove ${individual.label || "individual"}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(individual.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRemove(individual.id);
              }
            }}
          />
        )}
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          {JOINTS.map((joint) => (
            <JointRow
              key={joint.id}
              number={joint.n}
              label={joint.label}
              jointId={joint.id}
              values={individual.coords[joint.id]}
              onChange={(jointId, axis, value) =>
                onChange(individual.id, jointId, axis, value)
              }
              onCommit={onCommit}
              highlightAxis={
                highlight?.field === "coord" && highlight.jointId === joint.id
                  ? highlight.axis
                  : null
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DeleteConfirmation({ individual, onCancel, onConfirm }) {
  const name = individual.label.trim() || "this skeleton";

  return (
    <>
      <div
        className="modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-skeleton-title"
        aria-describedby="delete-skeleton-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onCancel();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered delete-confirmation-dialog">
          <div className="modal-content delete-confirmation-card">
            <div className="modal-body position-relative p-4 text-center">
              <button
                type="button"
                className="btn-close delete-confirmation-close"
                aria-label="Close"
                onClick={onCancel}
              />
              <div className="delete-confirmation-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor" focusable="false">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.438-.99.982-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
                </svg>
              </div>
              <h2
                className="delete-confirmation-title"
                id="delete-skeleton-title"
              >
                Delete skeleton?
              </h2>
              <p
                className="delete-confirmation-copy"
                id="delete-skeleton-description"
              >
                Delete {name} and all of its coordinates?
              </p>
              <div className="d-flex gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-light border flex-fill delete-confirmation-action"
                  onClick={onCancel}
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger flex-fill delete-confirmation-action"
                  onClick={onConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show delete-confirmation-backdrop" />
    </>
  );
}

// The panel itself: an add button and the list of sections.
export default function Sidebar({
  individuals,
  openId,
  onChange,
  onCommit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggle,
  onAdd,
  onRemove,
  onColourChange,
  onLabelChange,
  isOpen,
  highlight,
  notice,
}) {
  const [pendingRemoval, setPendingRemoval] = useState(null);

  function confirmRemoval() {
    onRemove(pendingRemoval.id);
    setPendingRemoval(null);
  }

  return (
    <>
      <aside
        id="individuals-sidebar"
        className={`sidebar bg-body-tertiary border-end ${isOpen ? "overflow-auto" : "sidebar-collapsed"}`}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <div className="sidebar-content">
            <header className="sidebar-header bg-body-tertiary border-bottom px-2 py-2 d-flex align-items-center justify-content-between">
              <h2 className="h6 mb-0">Individuals</h2>
              <div className="d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary history-btn"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <span aria-hidden="true">↶</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary history-btn"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <span aria-hidden="true">↷</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onAdd}
                >
                  Add individual
                </button>
              </div>
            </header>

            {notice && (
              <div
                className="history-notice px-2 py-1 small text-body-secondary border-bottom"
                role="status"
              >
                {notice}
              </div>
            )}

            <div className="p-2">
              {individuals.map((individual) => (
                <IndividualSection
                  key={individual.id}
                  individual={individual}
                  isOpen={individual.id === openId}
                  onToggle={onToggle}
                  onChange={onChange}
                  onCommit={onCommit}
                  onRemove={() => setPendingRemoval(individual)}
                  canRemove={individuals.length > 1}
                  onColourChange={onColourChange}
                  onLabelChange={onLabelChange}
                  highlight={
                    highlight?.individualId === individual.id ? highlight : null
                  }
                />
              ))}
            </div>
          </div>
        )}
      </aside>

      {pendingRemoval && (
        <DeleteConfirmation
          individual={pendingRemoval}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemoval}
        />
      )}
    </>
  );
}
