// The individuals panel. One collapsible section per body in the grave, each
// containing a coordinate table: one row per survey point with number, label,
// and three inputs for X, Y, Z. Skeletons can be organised into named groups.
import { JOINTS } from "../joints";
import { useState, useEffect, useRef } from "react";

const DECIMAL_PATTERN = /^-?\d*\.?\d*$/;

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
  toggle,
  inputLabel = label,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (highlightAxis) {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightAxis]);

  return (
    <div className="joint-coordinate-row d-flex align-items-center gap-1 mb-1">
      {toggle ? (
        <button
          type="button"
          className="joint-expand btn btn-sm p-0 text-body-secondary"
          aria-label={`${toggle.isOpen ? "Collapse" : "Expand"} ${label} details`}
          aria-expanded={toggle.isOpen}
          aria-controls={toggle.id}
          onClick={toggle.onClick}
        >
          <span aria-hidden="true">{toggle.isOpen ? "▾" : "▸"}</span>
        </button>
      ) : <span className="joint-expand" aria-hidden="true" />}

      <span className="joint-num text-body-tertiary text-end">{number}</span>

      <label className="joint-label text-body-secondary text-truncate mb-0">
        {label}
      </label>

      {label === "superior" || label === "inferior" || !toggle?.isOpen ? (
        ["x", "y", "z"].map((axis) => (
          // Generate 3 identical inputs
          <input
            key={axis}
            type="text"
            inputMode="decimal"
            pattern="-?[0-9]*[.]?[0-9]*"
            className={`form-control form-control-sm coord-input${
              highlightAxis === axis ? " coord-input-flash" : ""
            }`}
            placeholder={axis.toUpperCase()}
            aria-label={`${inputLabel}, ${axis.toUpperCase()}`}
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
        ))
      ) : (
        <>
        </>
      )}
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
  onToggleSplit,
  onOffset,
  onCommit,
  onRemove,
  canRemove,
  onColourChange,
  onLabelChange,
  groups,
  onSetGroup,
  highlight,
}) {
  const [offset, setOffset] = useState({ x: "", y: "", z: "" });
  const offsetValid = Object.values(offset).every((value) => Number.isFinite(Number(value)));
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
          id={`colorPicker-${individual.id}`}
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
        <select
          className="form-select form-select-sm individual-group-select"
          aria-label="Group"
          value={individual.groupId ?? ""}
          onChange={(e) =>
            onSetGroup(individual.id, e.target.value || null)
          }
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">None</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name.trim() || "Unnamed group"}
            </option>
          ))}
        </select>
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
          <div className="d-flex align-items-center gap-1 mb-2 offset-row">
            <button
              type="button"
              className="btn btn-light border btn-sm offset-add"
              title="Add to every joint. Blank offset axes stay unchanged; blank joint values count as zero only for entered axes."
              aria-label="Add coordinate offset to every joint"
              disabled={!offsetValid}
              onClick={() => {
                onOffset(individual.id, offset);
                setOffset({ x: "", y: "", z: "" });
              }}
            >
              + Add
            </button>
            {["x", "y", "z"].map((axis) => (
              <input
                key={axis}
                type="text"
                inputMode="decimal"
                className="form-control form-control-sm coord-input"
                placeholder={axis.toUpperCase()}
                aria-label={`Offset, ${axis.toUpperCase()}`}
                value={offset[axis]}
                onChange={(event) => {
                  const value = event.target.value;
                  if (DECIMAL_PATTERN.test(value)) {
                    setOffset((current) => ({ ...current, [axis]: value }));
                  }
                }}
              />
            ))}
          </div>
          {JOINTS.map((joint) => {
            const isSplit = !!individual.coords[joint.id]?.split;
            return (
            <div key={joint.id}>
              <JointRow
                number={joint.n}
                toggle={{
                  isOpen: isSplit,
                  id: `joint-details-${individual.id}-${joint.id}`,
                  onClick: () => onToggleSplit(individual.id, joint.id),
                }}
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
              {isSplit && (
                <div
                  id={`joint-details-${individual.id}-${joint.id}`}
                  className="joint-details"
                  role="group"
                  aria-label={`${joint.label} details`}
                >
                  {["superior", "inferior"].map((position) => (
                    <JointRow
                      key={position}
                      label={position}
                      inputLabel={`${joint.label}, ${position}`}
                      jointId={joint.id}
                      values={position === "superior" ? individual.coords[joint.id] : individual.coords[joint.id]?.inferior ?? { x: "", y: "", z: "" }}
                      onChange={(jointId, axis, value) => {
                        onChange(individual.id, jointId, axis, value, position);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GroupBlock({
  title,
  nameValue,
  onNameChange,
  onCommit,
  onRemove,
  children,
  empty,
}) {
  return (
    <section className="sidebar-group mb-3">
      <header className="sidebar-group-header d-flex align-items-center gap-2 mb-2">
        {onNameChange ? (
          <input
            type="text"
            className="form-control form-control-sm sidebar-group-name"
            placeholder="Group name"
            aria-label="Group name"
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onCommit}
          />
        ) : (
          <h3 className="sidebar-group-title h6 mb-0 text-body-secondary">
            {title}
          </h3>
        )}
        {onRemove && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onRemove}
            aria-label={`Delete ${nameValue.trim() || "group"}`}
            title="Delete group"
          >
            ×
          </button>
        )}
      </header>
      {empty ? (
        <p className="sidebar-group-empty small text-body-tertiary mb-0 px-1">
          No skeletons in this group
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function DeleteConfirmation({
  title,
  description,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}) {
  return (
    <>
      <div
        className="modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
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
                id="delete-confirmation-title"
              >
                {title}
              </h2>
              <p
                className="delete-confirmation-copy"
                id="delete-confirmation-description"
              >
                {description}
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
                  {confirmLabel}
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
  groups,
  openId,
  onChange,
  onToggleSplit,
  onOffset,
  onCommit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggle,
  onAdd,
  onRemove,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
  onSetGroup,
  onColourChange,
  onLabelChange,
  isOpen,
  highlight,
  notice,
}) {
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [pendingGroupRemoval, setPendingGroupRemoval] = useState(null);

  function confirmRemoval() {
    onRemove(pendingRemoval.id);
    setPendingRemoval(null);
  }

  function confirmGroupRemoval() {
    onRemoveGroup(pendingGroupRemoval.id);
    setPendingGroupRemoval(null);
  }

  function renderIndividual(individual) {
    return (
      <IndividualSection
        key={individual.id}
        individual={individual}
        isOpen={individual.id === openId}
        onToggle={onToggle}
        onChange={onChange}
        onToggleSplit={onToggleSplit}
        onOffset={onOffset}
        onCommit={onCommit}
        onRemove={() => setPendingRemoval(individual)}
        canRemove={individuals.length > 1}
        onColourChange={onColourChange}
        onLabelChange={onLabelChange}
        groups={groups}
        onSetGroup={onSetGroup}
        highlight={
          highlight?.individualId === individual.id ? highlight : null
        }
      />
    );
  }

  const ungrouped = individuals.filter((individual) => !individual.groupId);

  return (
    <>
      <aside
        id="individuals-sidebar"
        className={`sidebar bg-body-tertiary border-end ${isOpen ? "overflow-y-auto overflow-x-hidden" : "sidebar-collapsed"}`}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <div className="sidebar-content">
            <header className="sidebar-header bg-body-tertiary border-bottom px-2 py-2 d-flex align-items-center justify-content-between gap-2">
              <h2 className="h6 mb-0">{groups.length === 0 ? "Individuals" : "Groups"}</h2>
              <div className="d-flex align-items-center gap-1 flex-wrap justify-content-end">
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
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onAddGroup}
                >
                  Add group
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
              {groups.length === 0 ? (
                ungrouped.map(renderIndividual)
              ) : (
                <>
                  {groups.map((group) => {
                    const members = individuals.filter(
                      (individual) => individual.groupId === group.id,
                    );
                    return (
                      <GroupBlock
                        key={group.id}
                        nameValue={group.name}
                        onNameChange={(name) => onRenameGroup(group.id, name)}
                        onCommit={onCommit}
                        onRemove={() => setPendingGroupRemoval(group)}
                        empty={members.length === 0}
                      >
                        {members.map(renderIndividual)}
                      </GroupBlock>
                    );
                  })}

                  <GroupBlock title="Ungrouped" empty={ungrouped.length === 0}>
                    {ungrouped.map(renderIndividual)}
                  </GroupBlock>
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      {pendingRemoval && (
        <DeleteConfirmation
          title="Delete skeleton?"
          description={`Delete ${pendingRemoval.label.trim() || "this skeleton"} and all of its coordinates?`}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemoval}
        />
      )}

      {pendingGroupRemoval && (
        <DeleteConfirmation
          title="Delete group?"
          description={`Delete ${pendingGroupRemoval.name.trim() || "this group"}? Skeletons in it become ungrouped.`}
          onCancel={() => setPendingGroupRemoval(null)}
          onConfirm={confirmGroupRemoval}
        />
      )}
    </>
  );
}
