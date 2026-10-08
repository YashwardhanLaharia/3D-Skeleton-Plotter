// Which individuals are currently drawn in the viewport.
//
// Lives over the 3D view rather than in the sidebar because it answers a
// different question: the sidebar is about who an individual is and what was
// recorded for them, this is about what you're looking at right now. It also
// stays usable when the sidebar is collapsed, which is exactly when you'd want
// to be focusing on the viewport.

import { useEffect, useRef, useState } from "react";
import {
  isVisible,
  isGroupFullyHidden,
} from "../visibility";

function LayerRow({
  individual,
  visible,
  focused,
  onToggleVisibility,
  onFocusAlone,
  onFocus,
}) {
  const name = individual.label.trim() || "Unlabelled";
  const pendingToggle = useRef(null);
  useEffect(() => () => clearTimeout(pendingToggle.current), []);

  function cancelToggle() {
    clearTimeout(pendingToggle.current);
    pendingToggle.current = null;
  }

  // Wait briefly so a quick double-click does not hide the focused body
  // or starts restoring the overview camera before focus-alone is entered.
  function handleClick(event) {
    if (event.detail > 1) return;
    cancelToggle();
    pendingToggle.current = setTimeout(() => onToggleVisibility(individual.id), 250);
  }


  return (
    <li className="layer-item d-flex align-items-center">
      <button
        type="button"
        className={`layer-row d-flex align-items-center gap-2 flex-grow-1 text-start ${
          visible ? "" : "layer-row-off"
        } ${focused ? "layer-row-focused" : ""}`}
        onClick={handleClick}
        onDoubleClick={() => {
          cancelToggle();
          onFocusAlone(individual.id);
        }}
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
          ) : null}
        </span>
      </button>

      <button
        type="button"
        className="layer-focus-btn"
        onClick={() => {
          cancelToggle();
          onFocus(individual.id);
        }}
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
  isOpen,
  onToggle,
  contentId,
  children,
}) {
  const fullyHidden = isGroupFullyHidden(hidden, memberIds);
  const hasMembers = memberIds.length > 0;

  return (
    <li className="layer-group">
      <div
        className={`layer-group-header d-flex align-items-center gap-2 ${
          fullyHidden ? "layer-group-header-off" : ""
        }`}
      >
        <button
          type="button"
          className="layers-collapse"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          title={isOpen ? "Collapse" : "Expand"}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
        >
          <span
            aria-hidden="true"
            className={`chevron ${isOpen ? "open" : ""}`}
          >
            ▸
          </span>
        </button>
        <button
          type="button"
          className="layer-group-toggle d-flex align-items-center gap-2 flex-grow-1 text-start"
          onClick={() => onToggleGroupVisibility(memberIds)}
          disabled={!hasMembers}
          aria-pressed={hasMembers ? !fullyHidden : undefined}
          aria-label={`${title}, ${fullyHidden ? "hidden" : "visible"}`}
        >
          <span className="layer-group-name text-truncate">{title}</span>
          <span className="layers-count ms-auto">
            {memberIds.filter((id) => isVisible(hidden, id)).length}/
            {memberIds.length}
          </span>
        </button>
      </div>
      {isOpen && (
        <ul
          id={contentId}
          className="layer-group-list list-unstyled mb-0"
        >
          {children}
        </ul>
      )}
    </li>
  );
}

export default function LayersPanel({
  individuals,
  groups = [],
  hidden,
  onToggleVisibility,
  onToggleGroupVisibility,
  onFocusAlone,
  onShowAll,
  focusedId,
  onFocus,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  // Group ids in this set are collapsed. Named groups and "Ungrouped" all start open.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  if (individuals.length === 0) return null;

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
        onToggleVisibility={onToggleVisibility}
        onFocusAlone={onFocusAlone}
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
                      isOpen={!collapsedGroups.has(group.id)}
                      onToggle={() => toggleGroup(group.id)}
                      contentId={`layer-group-${group.id}`}
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
                    isOpen={!collapsedGroups.has("ungrouped")}
                    onToggle={() => toggleGroup("ungrouped")}
                    contentId="layer-group-ungrouped"
                  >
                    {ungrouped.map(renderRow)}
                  </LayerGroup>
                )}
              </>
            )}
          </ul>

          <footer className="layers-hint px-2 py-1 border-top">
            {hoveredId
              ? "Click to hide · Group header hides all · Double-click to focus alone"
              : "\u00A0"}
          </footer>
        </>
      )}
    </section>
  );
}
