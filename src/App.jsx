// The root component owns individuals, sidebar state, and rig commands.

import { useEffect, useReducer, useRef, useState } from "react";
import {
  validateProject,
  normaliseIndividual,
  SCHEMA_VERSION,
} from "./projectFile";

import {
  historyReducer,
  makeInitialHistory,
  diffSnapshots,
  findLastKnownLabel,
} from "./reducer";

import {
  isVisible,
  toggleHidden,
  isolateOnly,
  showAll,
  pruneHidden,
  isIsolated,
} from "./visibility";

import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
import LayersPanel from "./components/LayersPanel";
import FocusBar from "./components/FocusBar";
import InspectionPanel from "./components/InspectionPanel";
import NewProjectModal from "./components/NewProjectModal";
import "./app.css";

const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
];

const STARTING_STATE = [
  {
    id: "ind-1",
    label: "",
    colour: "#E69F00",
    coords: makeBlankCoords(),
  },
];

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]),
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(true);
  const [graveDimensions, setGraveDimensions] = useState([1, 1, 1]);
  // The data model is now an array of individuals, not one coordinate object.
  // Each carries its own label, colour, and full coordinate set.
  const [history, dispatch] = useReducer(historyReducer, undefined, () =>
    makeInitialHistory(STARTING_STATE),
  );

  const individuals = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  // Which field to flash after an undo. Cleared after some time
  const [highlight, setHighlight] = useState(null);

  // View state only, see visibility.js.
  const [hidden, setHidden] = useState([]);

  // Which individual is being examined close-up. View state, like `hidden` —
  // not undoable, not saved. Separate from `hidden` on purpose so the two
  // mechanisms can be compared before deciding whether they merge.
  const [focusedId, setFocusedId] = useState(null);

  // Transient message for changes such as adding individuals, which are inconvenient to highlight in place
  const [notice, setNotice] = useState(null);

  const [openId, setOpenId] = useState("ind-1");
  const [filePath, setFilePath] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [rigCommand, setRigCommand] = useState(null);
  const nextId = useRef(2);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRigCommand(setRigCommand);
    return () => unsubscribe?.();
  }, []);

  function handleChange(individualId, jointId, axis, rawValue) {
    dispatch({
      type: "set-coord",
      individualId,
      jointId,
      axis,
      value: rawValue,
    });
    setIsDirty(true);
  }

  // Called on blur. Ends the current edit run so the next field starts a new
  // history entry.
  function handleCommit() {
    dispatch({ type: "commit" });
  }

  function handleColourChange(individualId, colour) {
    dispatch({ type: "set-colour", individualId, colour });
    setIsDirty(true);
  }

  function handleLabelChange(individualId, label) {
    dispatch({ type: "set-label", individualId, label });
    setIsDirty(true);
  }

  function handleToggle(individualId) {
    setOpenId((current) => (current === individualId ? null : individualId));
  }

  function handleAdd() {
    const id = `ind-${nextId.current}`;
    const colour = PALETTE[(nextId.current - 1) % PALETTE.length];
    nextId.current += 1;

    dispatch({
      type: "add",
      individual: { id, label: "", colour, coords: makeBlankCoords() },
    });
    setOpenId(id);

    setIsDirty(true);
  }

  function handleRemove(individualId) {
    dispatch({ type: "remove", individualId });
    setOpenId((current) => (current === individualId ? null : current));
    setIsDirty(true);
    setHidden((current) =>
      pruneHidden(
        current,
        individuals
          .filter((individual) => individual.id !== individualId)
          .map((individual) => individual.id),
      ),
    );

    setFocusedId((current) => (current === individualId ? null : current));
  }

  function handleToggleVisibility(individualId) {
    setHidden((current) => toggleHidden(current, individualId));
  }

  function handleIsolate(individualId) {
    const allIds = individuals.map((individual) => individual.id);
    setHidden((current) =>
      isIsolated(current, individualId, allIds)
        ? showAll()
        : isolateOnly(individualId, allIds),
    );
  }

  function handleShowAll() {
    setHidden(showAll());
  }

  function handleFocus(individualId) {
    const next = focusedId === individualId ? null : individualId;
    setFocusedId(next);
    // Focusing must not leave the individual hidden underneath — otherwise
    // exiting reveals a stale hide and the skeleton vanishes.
    if (next) {
      setHidden((hiddenIds) => hiddenIds.filter((id) => id !== next));
    }
  }

  function handleExitFocus() {
    setFocusedId(null);
  }

  // Reveal the effect: expand the affected individual and flash the field, so
  // an undo inside a collapsed section isn't silent.
  function revealChange(before, after) {
    const change = diffSnapshots(before, after);
    if (!change) return;

    // Structural changes announce themselves; field changes are shown in place.
    if (change.field === "added" || change.field === "removed") {
      const known = change.needsLabelLookup
        ? findLastKnownLabel(history, change.individualId)
        : change.label;
      const name = known?.trim() || "unnamed individual";
      setNotice(
        change.field === "added" ? `Restored ${name}` : `Removed ${name}`,
      );
      if (change.field === "added") setOpenId(change.individualId);
      return;
    }

    setOpenId(change.individualId);
    setHighlight(change);
  }

  function handleUndo() {
    if (!canUndo) return;
    const before = history.present;
    const after = history.past[history.past.length - 1];
    dispatch({ type: "undo" });
    revealChange(before, after);
    setIsDirty(true);
  }

  function handleRedo() {
    if (!canRedo) return;
    const before = history.present;
    const after = history.future[0];
    dispatch({ type: "redo" });
    revealChange(before, after);
    setIsDirty(true);
  }

  function handleChangeGraveDimensions() {
    setIsNewProjectModalOpen(true);
  }

  async function handleNew() {
    if (isDirty) {
      const choice = await window.electronAPI.confirmDiscard("new");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }

    const result = await window.electronAPI.newProject();

    if (!result.ok) {
      if (!result.canceled) console.error(result.error);
      return;
    }

    dispatch({ type: "new", individuals: STARTING_STATE });

    setIsNewProjectModalOpen(true);
    setFilePath(null);
    setOpenId(STARTING_STATE[0].id);
    setIsDirty(true);
  }

  async function handleOpen() {
    if (isDirty) {
      const choice = await window.electronAPI.confirmDiscard("open");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }
    const result = await window.electronAPI.openProject();

    if (!result.ok) {
      if (!result.canceled) console.error(result.error);
      return;
    }

    const check = validateProject(result.data);
    if (!check.ok) {
      console.error(check.issues.join("\n"));
      return;
    }

    const loaded = result.data.individuals.map(normaliseIndividual);
    dispatch({ type: "load", individuals: loaded });

    const numbers = loaded
      .map((individual) => Number(individual.id.replace("ind-", "")))
      .filter((value) => Number.isFinite(value));
    nextId.current = numbers.length ? Math.max(...numbers) + 1 : 1;

    setOpenId(loaded[0]?.id ?? null);

    setFilePath(result.path);

    setIsDirty(false);

    setHidden([]);

    setFocusedId(null);
  }

  function buildProjectData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      individuals: individuals.map((individual) => ({
        id: individual.id,
        label: individual.label,
        colour: individual.colour,
        coords: individual.coords,
      })),
    };
  }

  async function handleSave(forcePrompt) {
    const result = await window.electronAPI.saveProject({
      payload: buildProjectData(),
      filePath: forcePrompt ? null : filePath,
    });

    if (!result.ok) {
      if (!result.canceled) console.error(result.error);
      return false;
    }

    setFilePath(result.path);
    setIsDirty(false);
    return true;
  }

  async function handleRequestClose() {
    if (isDirty) {
      const choice = await window.electronAPI.confirmDiscard("close");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }
    window.electronAPI.confirmClose();
  }

  // Menu clicks arrive from the main process. The ref keeps the listener pointing
  // at the latest handlers: registering once with [] would capture the state as
  // it was on first render, so saving would write an empty project forever.
  const actionsRef = useRef(null);
  actionsRef.current = {
    handleNew,
    handleOpen,
    handleSave,
    handleRequestClose,
    handleUndo,
    handleRedo,
    handleChangeGraveDimensions,
  };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onMenuAction((action) => {
      if (action === "menu-new") actionsRef.current.handleNew();
      if (action === "menu-open") actionsRef.current.handleOpen();
      if (action === "menu-save") actionsRef.current.handleSave(false);
      if (action === "menu-save-as") actionsRef.current.handleSave(true);
      if (action === "menu-undo") actionsRef.current.handleUndo();
      if (action === "menu-redo") actionsRef.current.handleRedo();
      if (action === "menu-change-grave-dimensions")
        actionsRef.current.handleChangeGraveDimensions();
    });
    return () => unsubscribe?.();
  }, []);

  // The close handler must read live state, so it goes through the same ref as
  // the menu actions. Registering with [] and calling handleRequestClose directly
  // would capture isDirty from the first render and the prompt would never appear.
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRequestClose(() => {
      actionsRef.current.handleRequestClose();
    });
    return () => unsubscribe?.();
  }, []);

  // Clear the flash after it plays. The dependency is the highlight object
  // itself, so re-undoing the same field restarts the animation.
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 1200);
    return () => clearTimeout(timer);
  }, [highlight]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Registered once; reads handlers through the ref so it never captures stale
  // state. preventDefault stops the browser's own input undo from fighting ours
  // The inputs are React-controlled, so native undo would desync them.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setFocusedId(null);
        return;
      }

      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) actionsRef.current.handleRedo();
        else actionsRef.current.handleUndo();
      }

      // Windows convention for redo.
      if (key === "y") {
        event.preventDefault();
        actionsRef.current.handleRedo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : "Untitled";
    document.title = `${isDirty ? "• " : ""}${name} — Skeleton Plotter`;
  }, [filePath, isDirty]);

  const focusedIndividual =
    individuals.find((individual) => individual.id === focusedId) ?? null;

  return (
    <div className="app-shell d-flex flex-column vh-100 overflow-hidden">
      <NewProjectModal
        show={isNewProjectModalOpen}
        onHide={() => setIsNewProjectModalOpen(false)}
        graveDimensions={graveDimensions}
        setGraveDimensions={setGraveDimensions}
      />
      <div className="app-workspace d-flex flex-grow-1 overflow-hidden">
        <Sidebar
          individuals={individuals}
          openId={openId}
          onChange={handleChange}
          onCommit={handleCommit}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          highlight={highlight}
          notice={notice}
          hidden={hidden}
          onToggleVisibility={handleToggleVisibility}
          onIsolate={handleIsolate}
          onShowAll={handleShowAll}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onLabelChange={handleLabelChange}
          onColourChange={handleColourChange}
          isOpen={isSidebarOpen}
        />

        <button
          type="button"
          className={`btn btn-light sidebar-edge-toggle border ${isSidebarOpen ? "" : "sidebar-edge-toggle-collapsed"}`}
          aria-label={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          aria-controls="individuals-sidebar"
          aria-expanded={isSidebarOpen}
          title={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
        >
          <span aria-hidden="true">{isSidebarOpen ? "‹" : "›"}</span>
        </button>

        <div className="viewport-wrap flex-grow-1 position-relative d-flex">
          <MainView
            individuals={individuals}
            command={rigCommand}
            hidden={hidden}
            focusedId={focusedId}
            graveDimensions={graveDimensions}
            targetId={openId ?? individuals[0]?.id}
          />
          <FocusBar individual={focusedIndividual} onExit={handleExitFocus} />

          {focusedId ? (
            <InspectionPanel individual={focusedIndividual} />
          ) : (
            <LayersPanel
              individuals={individuals}
              hidden={hidden}
              onToggleVisibility={handleToggleVisibility}
              onIsolate={handleIsolate}
              onShowAll={handleShowAll}
              focusedId={focusedId}
              onFocus={handleFocus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
