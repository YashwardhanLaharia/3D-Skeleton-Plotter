// Which individuals are currently drawn in the viewport.
//
// Lives over the 3D view rather than in the sidebar because it answers a
// different question: the sidebar is about who an individual is and what was
// recorded for them, this is about what you're looking at right now. It also
// stays usable when the sidebar is collapsed, which is exactly when you'd want
// to be focusing on the viewport.

import { useState } from "react";
import {
  isVisible,
  isIsolated,
  isGroupFullyHidden,
} from "../visibility";

function LayerRow({
  individual,
  visible,
  isolated,
  focused,
  onToggleVisibility,
  onIsolate,
  onFocus,
}) {
  const name = individual.label.trim() || "Unlabelled";

  // The row is the control. Click hides, double-click isolates — the click
  // handler fires first on a double-click, so isolate reverses it before
  // acting. Cleaner than a timer, and the intermediate state is never painted.
  // Click fires first on a double-click, so undo it before focusing.
  function handleDoubleClick() {
    onToggleVisibility(individual.id);
    onIsolate(individual.id);
  }

  return (
    <li className="layer-item d-flex align-items-center">
      <button
        type="button"
        className={`layer-row d-flex align-items-center gap-2 flex-grow-1 text-start ${
          visible ? "" : "layer-row-off"
        } ${isolated ? "layer-row-isolated" : ""} ${
          focused ? "layer-row-focused" : ""
        }`}
        onClick={() => onToggleVisibility(individual.id)}
        onDoubleClick={handleDoubleClick}
        aria-pressed={visible}
        aria-label={`${name}, ${visible ? "visible" : "hidden"}`}
      >
        <span className="layer-eye" aria-hidden="true">
          {visible ? "●" : "○"}
        </span>

        <span
          className="layer-swatch"
          style={{ background: individual.colour }}
          aria-hidden="true"
        />

        <span className="layer-name text-truncate">{name}</span>

        <span className="layer-trailing ms-auto">
          {focused ? (
            <span className="layer-tag layer-tag-focus" aria-hidden="true">
              focus
            </span>
          ) : isolated ? (
            <span className="layer-tag" aria-hidden="true">
              only
            </span>
          ) : null}
        </span>
      </button>

      <button
        type="button"
        className="layer-focus-btn"
        onClick={() => onFocus(individual.id)}
        title={focused ? "Exit focus" : "Focus"}
        aria-label={`${focused ? "Exit focus on" : "Focus"} ${name}`}
      >
        <span aria-hidden="true">⊙</span>
      </button>
    </li>
  );
}

function LayerGroup({
  title,
  memberIds,
  hidden,
  onToggleGroupVisibility,
  children,
}) {
  const fullyHidden = isGroupFullyHidden(hidden, memberIds);
  const hasMembers = memberIds.length > 0;

  return (
    <li className="layer-group">
      <button
        type="button"
        className={`layer-group-header d-flex align-items-center gap-2 w-100 text-start ${
          fullyHidden ? "layer-group-header-off" : ""
        }`}
        onClick={() => onToggleGroupVisibility(memberIds)}
        disabled={!hasMembers}
        aria-pressed={hasMembers ? !fullyHidden : undefined}
        aria-label={`${title}, ${fullyHidden ? "hidden" : "visible"}`}
      >
        <span className="layer-eye" aria-hidden="true">
          {fullyHidden ? "○" : "●"}
        </span>
        <span className="layer-group-name text-truncate">{title}</span>
        <span className="layers-count ms-auto">
          {memberIds.filter((id) => isVisible(hidden, id)).length}/
          {memberIds.length}
        </span>
      </button>
      <ul className="layer-group-list list-unstyled mb-0">{children}</ul>
    </li>
  );
}

export default function LayersPanel({
  individuals,
  groups = [],
  hidden,
  onToggleVisibility,
  onToggleGroupVisibility,
  onIsolate,
  onShowAll,
  focusedId,
  onFocus,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  if (individuals.length === 0) return null;

  const allIds = individuals.map((individual) => individual.id);
  const hiddenCount = hidden.length;
  const visibleCount = individuals.length - hiddenCount;
  const knownGroupIds = new Set(groups.map((group) => group.id));
  const ungrouped = individuals.filter(
    (individual) => !individual.groupId || !knownGroupIds.has(individual.groupId),
  );

  function renderRow(individual) {
    return (
      <LayerRow
        key={individual.id}
        individual={individual}
        visible={isVisible(hidden, individual.id)}
        isolated={isIsolated(hidden, individual.id, allIds)}
        onToggleVisibility={onToggleVisibility}
        onIsolate={onIsolate}
        focused={individual.id === focusedId}
        onFocus={onFocus}
      />
    );
  }

  return (
    <section
      className={`layers-panel bg-body border rounded shadow-sm ${
        isCollapsed ? "layers-panel-collapsed" : ""
      } ${focusedId ? "layers-panel-focused" : ""}`}
    >
      <header className="layers-header d-flex align-items-center gap-1 px-2 py-1 border-bottom">
        <button
          type="button"
          className="layers-collapse"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          aria-controls="layers-list"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <span
            aria-hidden="true"
            className={`chevron ${isCollapsed ? "" : "open"}`}
          >
            ▸
          </span>
        </button>

        <span className="small fw-semibold">
          Skeletons{" "}
          <span className="layers-count">
            ({visibleCount}/{individuals.length})
          </span>
        </span>

        {!isCollapsed && hiddenCount > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 ms-auto layers-show-all"
            onClick={onShowAll}
          >
            Show all ({hiddenCount})
          </button>
        )}
      </header>

      {!isCollapsed && (
        <>
          <ul
            id="layers-list"
            className="layers-list list-unstyled mb-0 p-1"
            onMouseLeave={() => setHoveredId(null)}
            onMouseOver={() => setHoveredId(true)}
          >
            {groups.length === 0 ? (
              individuals.map(renderRow)
            ) : (
              <>
                {groups.map((group) => {
                  const members = individuals.filter(
                    (individual) => individual.groupId === group.id,
                  );
                  return (
                    <LayerGroup
                      key={group.id}
                      title={group.name.trim() || "Unnamed group"}
                      memberIds={members.map((member) => member.id)}
                      hidden={hidden}
                      onToggleGroupVisibility={onToggleGroupVisibility}
                    >
                      {members.map(renderRow)}
                    </LayerGroup>
                  );
                })}

                {ungrouped.length > 0 && (
                  <LayerGroup
                    title="Ungrouped"
                    memberIds={ungrouped.map((member) => member.id)}
                    hidden={hidden}
                    onToggleGroupVisibility={onToggleGroupVisibility}
                  >
                    {ungrouped.map(renderRow)}
                  </LayerGroup>
                )}
              </>
            )}
          </ul>

          <footer className="layers-hint px-2 py-1 border-top">
            {hoveredId
              ? "Click to hide · Group header hides all · Double-click to isolate"
              : "\u00A0"}
          </footer>
        </>
      )}
    </section>
  );
}
