// The individuals panel. One collapsible section per body in the grave, each
// containing a coordinate table: one row per survey point with number, label,
// and three inputs for X, Y, Z. Skeletons can be organised into named groups.
import { JOINTS } from "../joints";
import { useState, useEffect, useRef } from "react";

const DECIMAL_PATTERN = /^-?\d*\.?\d*$/;

function SidebarHeaderIcon({ children }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="currentColor"
      aria-hidden="true"
      className="sidebar-header-icon"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function UndoIcon() {
  return (
    <SidebarHeaderIcon>
      <path
        fillRule="evenodd"
        d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"
      />
      <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466" />
    </SidebarHeaderIcon>
  );
}

function RedoIcon() {
  return (
    <SidebarHeaderIcon>
      <path
        fillRule="evenodd"
        d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"
      />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
    </SidebarHeaderIcon>
  );
}

function FolderPlusIcon() {
  return (
    <SidebarHeaderIcon>
      <path d="m.5 3 .04.87a2 2 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9v-1H2.826a1 1 0 0 1-.995-.91l-.637-7A1 1 0 0 1 2.19 4h11.62a1 1 0 0 1 .996 1.09L14.54 8h1.005l.256-2.819A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2m5.672-1a1 1 0 0 1 .707.293L7.586 3H2.19q-.362.002-.683.12L1.5 2.98a1 1 0 0 1 1-.98z" />
      <path d="M13.5 9a.5.5 0 0 1 .5.5V11h1.5a.5.5 0 1 1 0 1H14v1.5a.5.5 0 1 1-1 0V12h-1.5a.5.5 0 0 1 0-1H13V9.5a.5.5 0 0 1 .5-.5" />
    </SidebarHeaderIcon>
  );
}

function PersonPlusIcon() {
  return (
    <SidebarHeaderIcon>
      <path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
      <path
        fillRule="evenodd"
        d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5"
      />
    </SidebarHeaderIcon>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z" />
    </svg>
  );
}

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
            className={`form-control form-control-sm coord-input${highlightAxis === axis ? " coord-input-flash" : ""
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
  isSelected,
  onToggle,
  onChange,
  onToggleSplit,
  onOffset,
  onPartHidden,
  onCommit,
  onRemove,
  canRemove,
  onColourChange,
  onLabelChange,
  groups,
  onSetGroup,
  highlight,
  issues = [],
}) {
  const [offset, setOffset] = useState({ x: "", y: "", z: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const offsetValid = Object.values(offset).every((value) => Number.isFinite(Number(value)));
  // A point counts as recorded only when all three axes are filled. Partial
  // entries are treated as not yet done.
  const filledCount = JOINTS.filter((joint) => {
    const v = individual.coords[joint.id];
    return v.x !== "" && v.y !== "" && v.z !== "";
  }).length;

  const sectionRef = useRef(null);
  const settingsRef = useRef(null);

  // Selecting from the viewport has to bring the section into view.
  useEffect(() => {
    if (isSelected) {
      sectionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  useEffect(() => {
    if (!settingsOpen) return undefined;

    function handlePointerDown(event) {
      const settingsButton = sectionRef.current?.querySelector(
        ".individual-settings-btn",
      );
      if (
        settingsRef.current?.contains(event.target) ||
        settingsButton?.contains(event.target)
      ) {
        return;
      }
      setSettingsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  return (
    // The whole header toggles, so I used a button rather than a div
    <section
      ref={sectionRef}
      className={`individual border rounded mb-2 bg-body${isSelected ? " individual-selected" : ""}`}
    >
      <div className="individual-header-wrap position-relative">
      <button
        type="button"
        className="individual-header btn w-100 d-flex align-items-center gap-2 text-start"
        onClick={() => onToggle(individual.id)}
        aria-expanded={isOpen}
      >
        <input
          type="color"
          className={`form-control form-control-color individual-colour${highlight?.field === "colour" ? " coord-input-flash" : ""
            }`}
          id={`colorPicker-${individual.id}`}
          value={individual.colour}
          title="Choose your color"
          onChange={(e) => onColourChange(individual.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommit}
        />
        <input
          type="text"
          className={`form-control form-control-sm label-input${highlight?.field === "label" ? " coord-input-flash" : ""
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
        {issues.length > 0 && (
          <span
            className="text-warning-emphasis"
            title={`${issues.length} ${issues.length === 1 ? "problem" : "problems"}`}
            aria-label={`${issues.length} ${issues.length === 1 ? "problem" : "problems"}`}
          >
            ⚠
          </span>
        )}

        <span
          role="button"
          tabIndex={0}
          className={`individual-settings-btn ms-auto${settingsOpen ? " active" : ""}`}
          aria-label={`Settings for ${individual.label || "individual"}`}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          aria-controls={`individual-settings-${individual.id}`}
          title="Settings"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen((open) => !open);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setSettingsOpen((open) => !open);
            }
          }}
        >
          <SettingsIcon />
        </span>

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
      {settingsOpen && (
        <div
          ref={settingsRef}
          id={`individual-settings-${individual.id}`}
          className="individual-settings-popup"
          role="dialog"
          aria-label="Individual settings"
        >
          <div className="individual-settings-section">
            <div className="small fw-semibold mb-1">Display</div>
            <label className="individual-settings-check small d-flex align-items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={Boolean(individual.hidePelvis)}
                onChange={(event) =>
                  onPartHidden(individual.id, "pelvis", event.target.checked)
                }
              />
              Hide pelvis
            </label>
            <label className="individual-settings-check small d-flex align-items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={Boolean(individual.hideRibcage)}
                onChange={(event) =>
                  onPartHidden(individual.id, "ribcage", event.target.checked)
                }
              />
              Hide ribcage
            </label>
            <label className="individual-settings-check small d-flex align-items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={Boolean(individual.hideScapulae)}
                onChange={(event) =>
                  onPartHidden(individual.id, "scapulae", event.target.checked)
                }
              />
              Hide shoulder blades
            </label>
          </div>
          <div className="individual-settings-section">
            <div className="small fw-semibold mb-1">Offset all joints</div>
            <div className="d-flex align-items-center gap-1 offset-row">
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
              <button
                type="button"
                className="btn btn-light border btn-sm offset-add"
                title="Apply to every joint. Blank offset axes stay unchanged; blank joint values count as zero only for entered axes."
                aria-label="Apply coordinate offset to every joint"
                disabled={!offsetValid}
                onClick={() => {
                  onOffset(individual.id, offset);
                  setOffset({ x: "", y: "", z: "" });
                  setSettingsOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {isOpen && (
        <div className="px-2 pb-2">
          {issues.length > 0 && (
            <details className="alert alert-warning small py-1 px-2 mb-2" role="status">
              <summary>
                ⚠ {issues.length} {issues.length === 1 ? "problem" : "problems"}
              </summary>
              <ul className="mb-0 mt-1 ps-3">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
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
  isOpen,
  onToggle,
  contentId,
}) {
  const label = onNameChange
    ? nameValue.trim() || "Unnamed group"
    : title;

  return (
    <section className="sidebar-group mb-3">
      <header
        className={`sidebar-group-header d-flex align-items-center gap-2${
          isOpen ? " mb-2" : ""
        }`}
      >
        <button
          type="button"
          className="layers-collapse"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          title={isOpen ? "Collapse" : "Expand"}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`}
        >
          <span
            aria-hidden="true"
            className={`chevron ${isOpen ? "open" : ""}`}
          >
            ▸
          </span>
        </button>
        {onNameChange ? (
          <input
            type="text"
            className="form-control form-control-sm sidebar-group-name flex-grow-1"
            placeholder="Group name"
            aria-label="Group name"
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onCommit}
          />
        ) : (
          <h3 className="sidebar-group-title h6 mb-0 text-body-secondary flex-grow-1">
            {title}
          </h3>
        )}
        {onRemove && (
          <button
            type="button"
            className="btn-close btn-close-sm"
            onClick={onRemove}
            aria-label={`Delete ${nameValue.trim() || "group"}`}
            title="Delete group"
          />
        )}
      </header>
      {isOpen && (
        <div id={contentId}>
          {empty ? (
            <p className="sidebar-group-empty small text-body-tertiary mb-0 px-1">
              No skeletons in this group
            </p>
          ) : (
            children
          )}
        </div>
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
  selectedId,
  onChange,
  onToggleSplit,
  onOffset,
  onPartHidden,
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
  isSelected,
  highlight,
  notice,
  solverIssues = {},
}) {
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [pendingGroupRemoval, setPendingGroupRemoval] = useState(null);
  // Group ids in this set are collapsed. Named groups and "Ungrouped" all start open.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  function confirmRemoval() {
    onRemove(pendingRemoval.id);
    setPendingRemoval(null);
  }

  function confirmGroupRemoval() {
    onRemoveGroup(pendingGroupRemoval.id);
    setPendingGroupRemoval(null);
  }

  function toggleGroup(groupKey) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function renderIndividual(individual) {
    return (
      <IndividualSection
        key={individual.id}
        individual={individual}
        isOpen={individual.id === openId}
        isSelected={individual.id === selectedId}
        onToggle={onToggle}
        onChange={onChange}
        onToggleSplit={onToggleSplit}
        onOffset={onOffset}
        onPartHidden={onPartHidden}
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
        issues={solverIssues[individual.id]?.messages ?? []}
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
            <header className="sidebar-header d-flex align-items-center gap-1 px-2 py-1 border-bottom">
              <div className="d-flex align-items-center gap-1 sidebar-header-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onAdd}
                >
                  <PersonPlusIcon />
                  Add individual
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onAddGroup}
                >
                  <FolderPlusIcon />
                  Add group
                </button>
              </div>
              <div className="d-flex align-items-center gap-1 ms-auto sidebar-header-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary history-btn"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary history-btn"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <RedoIcon />
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
                        isOpen={!collapsedGroups.has(group.id)}
                        onToggle={() => toggleGroup(group.id)}
                        contentId={`sidebar-group-${group.id}`}
                      >
                        {members.map(renderIndividual)}
                      </GroupBlock>
                    );
                  })}

                  <GroupBlock
                    title="Ungrouped"
                    empty={ungrouped.length === 0}
                    isOpen={!collapsedGroups.has("ungrouped")}
                    onToggle={() => toggleGroup("ungrouped")}
                    contentId="sidebar-group-ungrouped"
                  >
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
