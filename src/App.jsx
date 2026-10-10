// The root component owns individuals, sidebar state, and rig commands.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  historyReducer,
  makeInitialHistory,
  diffSnapshots,
  findLastKnownLabel,
} from "./reducer";

import {
  toggleHidden,
  toggleGroupHidden,
  showAll,
  pruneHidden,
} from "./visibility";

import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
import LayersPanel from "./components/LayersPanel";
import FocusBar from "./components/FocusBar";
import InspectionPanel from "./components/InspectionPanel";
import StartupScreen from "./components/StartupScreen";
import GraveDimensionsModal from "./components/GraveDimensionsModal";
import { placementFromSize } from "./imageOverlay.js";
import { validateImageOverlay } from "./overlayAsset.js";
import GraveOutlineImportModal from "./components/GraveOutlineImportModal";
import GravesPanel from "./components/GravesPanel";
import ImageOverlayBar from "./components/ImageOverlayBar";
import ImageOverlaySettingsModal from "./components/ImageOverlaySettingsModal";
import {
  importGraveContour,
  validateGraveRelations,
} from "./graveCollection.js";
import { csvToProject, importCsv, rowsToIndividuals } from "./csvImport";
import { createCsv, exportCsv } from "./csvExport";
import { DEFAULT_VERTICAL } from "./sceneSpace";
import { applyTheme, readTheme } from "./theme";
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

// Behind the startup screen only these menu items make sense. Anything else
// would act on a project the user cannot see (#83).
const STARTUP_MENU_ACTIONS = new Set([
  "menu-home",
  "menu-new",
  "menu-open",
  "menu-toggle-dark-theme",
]);

const STARTING_STATE = [
  {
    id: "ind-1",
    label: "",
    colour: "#E69F00",
    groupId: null,
    hidePelvis: false,
    hideRibcage: false,
    hideScapulae: false,
    coords: makeBlankCoords(),
  },
];

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]),
  );
}

export default function App() {
  const [imageOverlay, setImageOverlay] = useState(null);
  const [overlayFrame, setOverlayFrame] = useState(null);
  const [showOverlaySettings, setShowOverlaySettings] = useState(false);
  const [graveSurvey, setGraveSurvey] = useState(null);
  const [theme, setTheme] = useState(readTheme);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showStartup, setShowStartup] = useState(true);
  const [isGraveDimensionsModalOpen, setIsGraveDimensionsModalOpen] =
    useState(false);
  const [graveDimensions, setGraveDimensions] = useState([1, 1, 1]);
  const [graves, setGraves] = useState([]);
  const [graveAssignments, setGraveAssignments] = useState({});
  const [hiddenGraves, setHiddenGraves] = useState([]);
  const [savedView, setSavedView] = useState(null);
  const [frameRequest, setFrameRequest] = useState(null);
  const graveOutline = graves[0] ?? { top: [], bottom: [] };
  const [recentProjects, setRecentProjects] = useState([]);
  // How the recorded z is read: height above the grave floor, or RL down from
  // the site datum with the grave floor's RL (see sceneSpace.js). Saved with
  // the project, like the grave dimensions.
  const [vertical, setVertical] = useState(DEFAULT_VERTICAL);
  // The data model is now an array of individuals, not one coordinate object.
  // Each carries its own label, colour, and full coordinate set.
  const [history, dispatch] = useReducer(historyReducer, undefined, () =>
    makeInitialHistory(STARTING_STATE),
  );

  const [jointDetails, setJointDetails] = useState({});

  function handleJointDetailChange(
    individualId,
    jointId,
    position,
    axis,
    value,
  ) {
    setJointDetails((current) => {
      const individualDetails = current[individualId] ?? {};
      const details = individualDetails[jointId] ?? {
        superior: { x: "", y: "", z: "" },
        inferior: { x: "", y: "", z: "" },
      };
      return {
        ...current,
        [individualId]: {
          ...individualDetails,
          [jointId]: {
            ...details,
            [position]: { ...details[position], [axis]: value },
          },
        },
      };
    });
  }

  const individuals = history.present.individuals;
  const groups = history.present.groups;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  // Which field to flash after an undo. Cleared after some time
  const [highlight, setHighlight] = useState(null);

  // View state only, see visibility.js.
  const [hidden, setHidden] = useState([]);

  // Which individual is being examined close-up. View state, like `hidden` —
  // not undoable, not saved. Focus/context never rewrites manual visibility.
  const [focusedId, setFocusedId] = useState(null);
  const [showEnvironment, setShowEnvironment] = useState(true);
  const [contextOpacity, setContextOpacity] = useState(0.25);

  // Transient message for changes such as adding individuals, which are inconvenient to highlight in place
  const [notice, setNotice] = useState(null);

  // Current solver problems per individual id, as { messages, unusualLengths }.
  // Replaced on every solve, so no messages means no problems now.
  const [solverIssues, setSolverIssues] = useState({});

  // Stable identity: every skeleton's solve effect depends on this, and a new
  // function on each render would re-run every solve on every render.
  const handleSolverIssues = useCallback((individualId, issues) => {
    setSolverIssues((current) => ({ ...current, [individualId]: issues }));
  }, []);

  const [openId, setOpenId] = useState("ind-1");

  // Which individual rig commands and viewport clicks act on. View state, like
  // `hidden`: not undoable, not saved. openId is only which section is expanded.
  const [selectedId, setSelectedId] = useState("ind-1");

  const [filePath, setFilePath] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const viewportRef = useRef(null);
  const nextId = useRef(2);
  const nextGroupId = useRef(1);

  async function refreshRecentProjects() {
    if (!window.electronAPI?.getRecentProjects) return;
    try {
      const recent = await window.electronAPI.getRecentProjects();
      setRecentProjects(Array.isArray(recent) ? recent : []);
    } catch (error) {
      console.error(error);
    }
  }

  async function rememberRecent(projectPath, skeletonCount) {
    if (!window.electronAPI?.rememberRecentProject || !projectPath) return;
    try {
      const result = await window.electronAPI.rememberRecentProject({
        path: projectPath,
        name: projectPath.split(/[\\/]/).pop(),
        skeletonCount,
      });
      if (result?.ok && Array.isArray(result.recent)) {
        setRecentProjects(result.recent);
      } else {
        await refreshRecentProjects();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function applyLoadedProject(loaded, projectPath) {
    skipAutosave.current = true;
    setJointDetails({});
    dispatch({
      type: "load",
      individuals: loaded.individuals,
      groups: loaded.groups,
    });

    // Before the grave itself, or the coordinates in it mean something else.
    setGraveDimensions(loaded.graveDimensions);
    setVertical(loaded.vertical);
    setGraves(loaded.graves ?? []);
    setGraveAssignments(
      Object.fromEntries(
        loaded.individuals
          .filter((individual) => individual.graveId)
          .map((individual) => [individual.id, individual.graveId]),
      ),
    );
    setHiddenGraves([]);
    setSavedView(loaded.view);
    setFrameRequest(null);
    setGraveSurvey(null);
    setImageOverlay(loaded.imageOverlay ?? null);
    setOverlayFrame(loaded.imageOverlay?.visible ? {} : null);

    const numbers = loaded.individuals
      .map((individual) => Number(individual.id.replace("ind-", "")))
      .filter((value) => Number.isFinite(value));
    nextId.current = numbers.length ? Math.max(...numbers) + 1 : 1;

    const groupNumbers = loaded.groups
      .map((group) => Number(group.id.replace("grp-", "")))
      .filter((value) => Number.isFinite(value));
    nextGroupId.current = groupNumbers.length
      ? Math.max(...groupNumbers) + 1
      : 1;

    const firstId = loaded.individuals[0]?.id ?? null;
    setOpenId(firstId);
    setSelectedId(firstId);
    setFilePath(projectPath);
    setIsDirty(false);
    setHidden([]);
    setFocusedId(null);
    setShowStartup(false);
    setIsGraveDimensionsModalOpen(false);
    setNotice("Project opened successfully.");
    rememberRecent(projectPath, loaded.individuals.length);
  }

  const [recoveryReady, setRecoveryReady] = useState(false);
  const [autosaveSnapshot, setAutosaveSnapshot] = useState(null);
  const [autosaveError, setAutosaveError] = useState(null);
  const recoveryStarted = useRef(false);
  const skipAutosave = useRef(true);
  const lastAutosaveData = useRef(null);
  const pendingAutosave = useRef(Promise.resolve({ ok: true }));

  useEffect(() => {
    if (recoveryStarted.current) return;
    recoveryStarted.current = true;
    async function recover() {
      try {
        const result = await window.electronAPI?.restoreAutosave?.();
        if (result && !result.ok) throw new Error(result.error);
        setAutosaveSnapshot(result?.snapshot ?? null);
      } catch (error) {
        setAutosaveError(`Could not read autosave: ${error.message}`);
      } finally {
        setRecoveryReady(true);
      }
    }
    recover();
  }, []);

  function handleRestoreAutosave() {
    if (!recoveryReady || !autosaveSnapshot) return;
    try {
      const document = autosaveSnapshot.document;
      const loaded = document
        ? { ...document, ok: Array.isArray(document.individuals) && Array.isArray(document.groups) && Array.isArray(document.graveDimensions) }
        : csvToProject(autosaveSnapshot.payload);
      if (!loaded.ok) throw new Error(loaded.error || "Invalid autosaved project");
      applyLoadedProject(loaded, autosaveSnapshot.filePath ?? null);
      setJointDetails(autosaveSnapshot.jointDetails ?? {});
      setIsDirty(true);
      setNotice("Autosaved project restored. Use Save to update your project file.");
    } catch (error) {
      setAutosaveError(`Could not restore autosave: ${error.message}`);
    }
  }

  useEffect(() => {
    if (!recoveryReady) return;
    const snapshot = {
      payload: createCsv(individuals, graveDimensions, groups),
      document: { individuals, groups, graveDimensions },
      jointDetails,
    };
    const data = JSON.stringify({ ...snapshot, filePath });
    if (skipAutosave.current) {
      skipAutosave.current = false;
      lastAutosaveData.current = data;
      return;
    }
    if (data === lastAutosaveData.current) return;
    lastAutosaveData.current = data;
    if (!window.electronAPI?.autosaveProject) return;
    pendingAutosave.current = window.electronAPI.autosaveProject({ ...snapshot, filePath })
      .catch(error => ({ ok: false, error: error.message }));
    pendingAutosave.current.then(result => {
      if (!result.ok) setNotice(`Autosave failed: ${result.error}`);
    });
  }, [recoveryReady, individuals, groups, graveDimensions, jointDetails, filePath]);

  async function finishAutosave() {
    const result = await pendingAutosave.current;
    if (!result.ok) {
      setNotice("Autosave failed. Save your project manually before continuing, then try again.");
      return false;
    }
    return true;
  }

  useEffect(() => {
    refreshRecentProjects();
  }, []);

  useEffect(() => {
    applyTheme(theme);
    void window.electronAPI?.setMenuTheme?.(theme === "dark");
  }, [theme]);

  function handleChange(individualId, jointId, axis, rawValue, part = "point") {
    dispatch({
      type: "set-coord",
      individualId,
      jointId,
      axis,
      value: rawValue,
      part,
    });
    setIsDirty(true);
  }

  function handleToggleSplit(individualId, jointId) {
    dispatch({ type: "toggle-joint-split", individualId, jointId });
    setIsDirty(true);
  }

  // Called on blur. Ends the current edit run so the next field starts a new
  // history entry.
  function handleCommit() {
    dispatch({ type: "commit" });
  }

  function handleOffset(individualId, offset) {
    dispatch({ type: "offset-coords", individualId, offset });
    setIsDirty(true);
  }

  function handlePartHidden(individualId, part, hidden) {
    dispatch({ type: "set-part-hidden", individualId, part, hidden });
    setIsDirty(true);
  }

  function handleColourChange(individualId, colour) {
    dispatch({ type: "set-colour", individualId, colour });
    setIsDirty(true);
  }

  function handleLabelChange(individualId, label) {
    dispatch({ type: "set-label", individualId, label });
    setIsDirty(true);
  }

  // Expanding a section selects it. Collapsing leaves the selection alone.
  function openAndSelect(individualId) {
    setOpenId(individualId);
    if (individualId) setSelectedId(individualId);
  }

  function handleToggle(individualId) {
    if (openId === individualId) setOpenId(null);
    else openAndSelect(individualId);
  }

  function handleAdd() {
    const id = `ind-${nextId.current}`;
    const colour = PALETTE[(nextId.current - 1) % PALETTE.length];
    nextId.current += 1;

    dispatch({
      type: "add",
      individual: {
        id,
        label: "",
        colour,
        groupId: null,
        hidePelvis: false,
        hideRibcage: false,
        hideScapulae: false,
        coords: makeBlankCoords(),
      },
    });
    openAndSelect(id);

    setIsDirty(true);
  }

  function handleAddGroup() {
    const id = `grp-${nextGroupId.current}`;
    nextGroupId.current += 1;
    dispatch({
      type: "add-group",
      group: { id, name: "" },
    });
    setIsDirty(true);
  }

  function handleRenameGroup(groupId, name) {
    dispatch({ type: "rename-group", groupId, name });
    setIsDirty(true);
  }

  function handleRemoveGroup(groupId) {
    dispatch({ type: "remove-group", groupId });
    setIsDirty(true);
  }

  function handleSetGroup(individualId, groupId) {
    dispatch({ type: "set-group", individualId, groupId });
    setIsDirty(true);
  }

  function handleRemove(individualId) {
    dispatch({ type: "remove", individualId });
    setOpenId((current) => (current === individualId ? null : current));
    setSelectedId((current) => (current === individualId ? null : current));
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
    if (individualId === focusedId) setFocusedId(null);
  }

  function handleToggleGroupVisibility(memberIds) {
    setHidden((current) => toggleGroupHidden(current, memberIds));
    if (memberIds.includes(focusedId)) setFocusedId(null);
  }

  function handleFocusAlone(individualId) {
    setFocusedId(individualId);
    setShowEnvironment(false);
    setHidden((current) => current.filter((id) => id !== individualId));
  }

  function handleShowAll() {
    setHidden(showAll());
  }

  function handleFocus(individualId) {
    const next = focusedId === individualId ? null : individualId;
    setFocusedId(next);
    if (next) setShowEnvironment(true);
    // Focusing must not leave the individual hidden underneath — otherwise
    // exiting reveals a stale hide and the skeleton vanishes.
    if (next) {
      setHidden((hiddenIds) => hiddenIds.filter((id) => id !== next));
    }
  }

  function handleExitFocus() {
    setFocusedId(null);
  }

  // Esc backs out one level at a time: focus first, then the selection.
  function handleEscape() {
    if (focusedId) setFocusedId(null);
    else setSelectedId(null);
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
      if (change.field === "added") openAndSelect(change.individualId);
      return;
    }

    if (change.field === "groups") {
      setNotice("Updated groups");
      return;
    }

    if (change.field === "group") {
      openAndSelect(change.individualId);
      setNotice("Updated group membership");
      return;
    }

    openAndSelect(change.individualId);
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
    setIsGraveDimensionsModalOpen(true);
  }

  function handleCreateFromStartup() {
    setShowStartup(false);
    setIsDirty(true);
  }

  async function handleHome() {
    if (isDirty) {
      const choice = await window.electronAPI.confirmDiscard("new");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }

    setGraveDimensions([1, 1, 1]);
    setVertical(DEFAULT_VERTICAL);
    resetSurvey();
    setFilePath(null);
    setIsDirty(false);
    setHidden([]);
    setFocusedId(null);
    setOpenId(null);
    setSelectedId(null);
    setJointDetails({});
    setImageOverlay(null);
    setOverlayFrame(null);
    dispatch({ type: "new", individuals: STARTING_STATE, groups: [] });
    nextGroupId.current = 1;
    nextId.current = 2;
    setShowStartup(true);
  }

  async function handleLoadOverlay() {
    const result = await window.electronAPI.importOverlayImage();
    if (!result.ok) {
      if (!result.canceled) setNotice(result.error);
      return;
    }
    try {
      const { asset } = result;
      const aspect = asset.pixelWidth / asset.pixelHeight;
      const width = Math.min(
        Number(graveDimensions[0]),
        Number(graveDimensions[1]) * aspect,
      );
      const placement =
        imageOverlay ??
        placementFromSize({
          x: 0,
          y: 0,
          width,
          length: width / aspect,
          rotation: 0,
          heightAboveFloor: 0,
        });
      setImageOverlay(validateImageOverlay({ ...placement, ...asset }));
      setOverlayFrame({});
      setFocusedId(null);
      setIsDirty(true);
      setNotice(
        imageOverlay
          ? "Photograph replaced; check its alignment."
          : "Photograph loaded. Enter its grid alignment.",
      );
    } catch (error) {
      setNotice(error.message);
    }
  }

  function handleApplyOverlay(next) {
    setImageOverlay(next);
    setIsDirty(true);
  }

  async function handleImportGraveOutline() {
    const survey = await window.electronAPI.importGraveOutline();
    if (!survey.ok) {
      if (!survey.canceled) setNotice(survey.error);
      return;
    }
    setGraveSurvey(survey);
  }

  function resetSurvey() {
    setGraves([]);
    setGraveAssignments({});
    setHiddenGraves([]);
    setSavedView(null);
    setFrameRequest(null);
    setGraveSurvey(null);
  }

  function handleApplyGraveOutline(options) {
    const imported = importGraveContour(graves, {
      ...options,
      points: graveSurvey.points,
    });
    setGraves(imported.graves);
    setHiddenGraves((current) => current.filter((id) => id !== imported.id));
    setSavedView(null);
    setFrameRequest({ id: imported.id });
    setFocusedId(null);
    setGraveSurvey(null);
    setIsDirty(true);
    setNotice(
      `Imported ${graveSurvey.points.length} ${options.level === "bottom" ? "base" : "top"} contour vertices`,
    );
  }

  function handleUpdateGrave(id, patch) {
    const updated = graves.map((grave) =>
      grave.id === id ? { ...grave, ...patch } : grave,
    );
    try {
      validateGraveRelations(updated);
    } catch (error) {
      setNotice(error.message);
      return;
    }
    setGraves(updated);
    setIsDirty(true);
  }

  function handleRemoveGrave(id) {
    setGraves(
      graves
        .filter((grave) => grave.id !== id)
        .map((grave) =>
          grave.cutsInto === id ? { ...grave, cutsInto: null } : grave,
        ),
    );
    setGraveAssignments((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, graveId]) => graveId !== id),
      ),
    );
    setHiddenGraves((current) => current.filter((graveId) => graveId !== id));
    setIsDirty(true);
  }

  function projectIndividuals() {
    return individuals.map((individual) => ({
      ...individual,
      graveId: graveAssignments[individual.id] || null,
    }));
  }

  async function handleImport() {
    const result = await importCsv();

    if (!result.ok) {
      if (!result.canceled) setNotice(result.error);
      return;
    }

    const converted = rowsToIndividuals(
      result.columns,
      result.rows,
      individuals.map(({ id }) => id),
      PALETTE,
      groups.map(({ id }) => id),
    );

    if (!converted.ok) {
      setNotice(converted.error);
      return;
    }

    dispatch({
      type: "add-many",
      individuals: converted.individuals,
      groups: converted.groups,
    });
    openAndSelect(converted.individuals[0]?.id ?? openId);
    const usedNumbers = [...individuals, ...converted.individuals]
      .map(({ id }) => Number(id.match(/^ind-(\d+)$/)?.[1]))
      .filter(Number.isFinite);
    nextId.current = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;

    const groupNumbers = [...groups, ...converted.groups]
      .map(({ id }) => Number(id.match(/^grp-(\d+)$/)?.[1]))
      .filter(Number.isFinite);
    nextGroupId.current = groupNumbers.length
      ? Math.max(...groupNumbers) + 1
      : nextGroupId.current;

    setIsDirty(true);

    // Imported coordinates are drawn with this project's setting, not the
    // file's. If they differ, the new individuals are at the wrong depth.
    const sameVertical =
      converted.vertical.convention === vertical.convention &&
      (vertical.convention !== "rl" ||
        converted.vertical.floorRL === vertical.floorRL);
    setNotice(
      sameVertical
        ? `Imported ${converted.individuals.length} individuals`
        : `Imported ${converted.individuals.length} individuals, but the file records depth differently from this project. Check they sit at the right depth.`,
    );
  }

  async function handleExportCsv() {
    const result = await exportCsv(
      projectIndividuals(),
      graveDimensions,
      groups,
      hidden,
      graveOutline,
      { graves, imageOverlay },
      vertical,
    );

    if (!result.ok) {
      if (!result.canceled) setNotice(result.error);
      return;
    }

    setNotice(`Exported all visible skeletons`);
  }

  async function handleNew() {
    if (!recoveryReady || !await finishAutosave()) return;
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
      if (!result.canceled) {
        console.error(result.error);
        setNotice("Could not create a new project. Please try again.");
      }
      return;
    }

    skipAutosave.current = true;
    setJointDetails({});
    setImageOverlay(null);
    setOverlayFrame(null);
    dispatch({ type: "new", individuals: STARTING_STATE, groups: [] });
    nextGroupId.current = 1;
    setVertical(DEFAULT_VERTICAL);
    nextId.current = 2;
    setVertical(DEFAULT_VERTICAL);

    resetSurvey();

    setShowStartup(false);
    setIsGraveDimensionsModalOpen(true);
    setFilePath(null);
    openAndSelect(STARTING_STATE[0].id);
    setHidden([]);
    setFocusedId(null);
    setIsDirty(true);
  }

  async function handleOpen() {
    if (!recoveryReady || !await finishAutosave()) return;
    if (isDirty && !showStartup) {
      const choice = await window.electronAPI.confirmDiscard("open");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }
    const result = await window.electronAPI.openProject();

    if (!result.ok) {
      if (!result.canceled) {
        console.error(result.error);
        setNotice("Could not open the project file.");
      }
      return;
    }

    const loaded = csvToProject(result.text);
    if (!loaded.ok) {
      console.error(loaded.error);
      setNotice(
        loaded.error ||
        "This project file is invalid or uses an unsupported format.",
      );
      return;
    }

    setJointDetails({});
    dispatch({
      type: "load",
      individuals: loaded.individuals,
      groups: loaded.groups,
    });

    // Before the grave itself, or the coordinates in it mean something else.
    setGraveDimensions(loaded.graveDimensions);
    setVertical(loaded.vertical);

    const numbers = loaded.individuals
      .map((individual) => Number(individual.id.replace("ind-", "")))
      .filter((value) => Number.isFinite(value));
    nextId.current = numbers.length ? Math.max(...numbers) + 1 : 1;

    const groupNumbers = loaded.groups
      .map((group) => Number(group.id.replace("grp-", "")))
      .filter((value) => Number.isFinite(value));
    nextGroupId.current = groupNumbers.length
      ? Math.max(...groupNumbers) + 1
      : 1;
    applyLoadedProject(loaded, result.path);
  }

  async function handleOpenRecent(projectPath) {
    if (!recoveryReady || !await finishAutosave()) return;
    if (isDirty && !showStartup) {
      const choice = await window.electronAPI.confirmDiscard("open");
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await handleSave(false);
        if (!saved) return;
      }
    }

    const result = await window.electronAPI.openProjectPath(projectPath);

    if (!result.ok) {
      console.error(result.error);
      setNotice(result.error || "Could not open the project file.");
      await refreshRecentProjects();
      return;
    }

    const loaded = csvToProject(result.text);
    if (!loaded.ok) {
      console.error(loaded.error);
      setNotice(
        loaded.error ||
        "This project file is invalid or uses an unsupported format.",
      );
      return;
    }

    applyLoadedProject(loaded, result.path);
  }

  async function handleSave(forcePrompt) {
    if (graves.some((grave) => !grave.name.trim())) {
      setNotice("Enter a name for each grave before saving.");
      return false;
    }
    const result = await window.electronAPI.saveProject({
      payload: createCsv(
        projectIndividuals(),
        graveDimensions,
        groups,
        graveOutline,
        {
          graves,
          view: viewportRef.current?.getView() ?? savedView,
          imageOverlay,
        },
        vertical,
      ),
      filePath: forcePrompt ? null : filePath,
    });

    if (!result.ok) {
      if (!result.canceled) {
        console.error(result.error);
        setNotice("Could not save the project. Please try again.");
      }
      return false;
    }

    pendingAutosave.current = Promise.resolve({ ok: true });
    setFilePath(result.path);
    setIsDirty(false);
    setNotice("Project saved successfully.");
    await rememberRecent(result.path, individuals.length);
    return true;
  }

  async function handleRequestClose() {
    if (!recoveryReady || !await finishAutosave()) return;
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

  async function handleExportScreenshot() {
    try {
      const result = await viewportRef.current?.captureScreenshot();
      if (result && !result.ok && !result.canceled) {
        setNotice(result.error);
      }
    } catch (error) {
      setNotice(`Could not export screenshot: ${error.message}`);
    }
  }

  async function handleExportGLB() {
    try {
      const result = await viewportRef.current?.exportGLB();
      if (result && !result.ok && !result.canceled) {
        setNotice(result.error);
      }
    } catch (error) {
      setNotice(`Could not export GLB: ${error.message}`);
    }
  }

  // Menu clicks arrive from the main process. The ref keeps the listener pointing
  // at the latest handlers: registering once with [] would capture the state as
  // it was on first render, so saving would write an empty project forever.
  const actionsRef = useRef(null);
  actionsRef.current = {
    handleHome,
    handleNew,
    handleOpen,
    handleOpenRecent,
    handleSave,
    handleRequestClose,
    handleExportScreenshot,
    handleExportGLB,
    handleUndo,
    handleRedo,
    handleChangeGraveDimensions,
    handleImport,
    handleImportGraveOutline,
    handleExportCsv,
    handleEscape,
    handleToggleDarkTheme: () =>
      setTheme((current) => (current === "dark" ? "light" : "dark")),
    showStartup,
  };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onMenuAction((action) => {
      if (actionsRef.current.showStartup && !STARTUP_MENU_ACTIONS.has(action))
        return;
      if (action === "menu-home") actionsRef.current.handleHome();
      if (action === "menu-new") actionsRef.current.handleNew();
      if (action === "menu-open") actionsRef.current.handleOpen();
      if (action === "menu-save") actionsRef.current.handleSave(false);
      if (action === "menu-save-as") actionsRef.current.handleSave(true);
      if (action === "menu-export-screenshot")
        actionsRef.current.handleExportScreenshot();
      if (action === "menu-export-glb") actionsRef.current.handleExportGLB();
      if (action === "menu-import") actionsRef.current.handleImport();
      if (action === "menu-import-grave-outline")
        actionsRef.current.handleImportGraveOutline();
      if (action === "menu-export-csv") actionsRef.current.handleExportCsv();
      if (action === "menu-undo") actionsRef.current.handleUndo();
      if (action === "menu-redo") actionsRef.current.handleRedo();
      if (action === "menu-change-grave-dimensions")
        actionsRef.current.handleChangeGraveDimensions();
      if (action === "menu-toggle-dark-theme")
        actionsRef.current.handleToggleDarkTheme();
    });
    return () => unsubscribe?.();
  }, []);

  // Grey out project-only menu items (and their shortcuts) on the startup screen.
  useEffect(() => {
    void window.electronAPI?.setStartupMenu?.(showStartup);
  }, [showStartup]);

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
      if (actionsRef.current.showStartup) return;
      if (event.key === "Escape") {
        actionsRef.current.handleEscape();
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
      <StartupScreen
        show={showStartup}
        recentProjects={recentProjects}
        autosaveSnapshot={autosaveSnapshot}
        autosaveError={autosaveError}
        autosaveLoading={!recoveryReady}
        onRestoreAutosave={handleRestoreAutosave}
        graveDimensions={graveDimensions}
        setGraveDimensions={(dimensions) => {
          setGraveDimensions(dimensions);
          setSavedView(null);
          setFrameRequest({ id: null });
          setIsDirty(true);
        }}
        vertical={vertical}
        setVertical={setVertical}
        onCreateConfirm={handleCreateFromStartup}
        onOpen={handleOpen}
        onOpenRecent={handleOpenRecent}
      />
      <GraveDimensionsModal
        show={isGraveDimensionsModalOpen}
        onHide={() => setIsGraveDimensionsModalOpen(false)}
        graveDimensions={graveDimensions}
        setGraveDimensions={(dimensions) => {
          setGraveDimensions(dimensions);
          setSavedView(null);
          setFrameRequest({ id: null });
          setIsDirty(true);
        }}
        vertical={vertical}
        setVertical={(next) => {
          setVertical(next);
          setIsDirty(true);
        }}
      />
      {graveSurvey && (
        <GraveOutlineImportModal
          survey={graveSurvey}
          graves={graves}
          vertical={vertical}
          onHide={() => setGraveSurvey(null)}
          onImport={handleApplyGraveOutline}
        />
      )}
      <ImageOverlaySettingsModal
        show={showOverlaySettings}
        overlay={imageOverlay}
        onHide={() => setShowOverlaySettings(false)}
        onApply={handleApplyOverlay}
        onLoad={handleLoadOverlay}
        onFrame={() => {
          if (!imageOverlay?.visible) {
            setImageOverlay({ ...imageOverlay, visible: true });
            setIsDirty(true);
          }
          setFocusedId(null);
          setOverlayFrame({});
        }}
        onRemove={() => {
          setImageOverlay(null);
          setOverlayFrame(null);
          setShowOverlaySettings(false);
          setIsDirty(true);
        }}
      />
      <div className="app-workspace d-flex flex-grow-1 overflow-hidden">
        <Sidebar
          individuals={individuals}
          groups={groups}
          openId={openId}
          selectedId={selectedId}
          onChange={handleChange}
          onToggleSplit={handleToggleSplit}
          onOffset={handleOffset}
          onPartHidden={handlePartHidden}
          jointDetails={jointDetails}
          onJointDetailChange={handleJointDetailChange}
          onCommit={handleCommit}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          highlight={highlight}
          notice={notice}
          solverIssues={solverIssues}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onAddGroup={handleAddGroup}
          onRenameGroup={handleRenameGroup}
          onRemoveGroup={handleRemoveGroup}
          onSetGroup={handleSetGroup}
          onLabelChange={handleLabelChange}
          onColourChange={handleColourChange}
          isOpen={isSidebarOpen}
        />

        <button
          type="button"
          className={`btn ${theme === "dark" ? "btn-dark" : "btn-light"} sidebar-edge-toggle border ${isSidebarOpen ? "" : "sidebar-edge-toggle-collapsed"}`}
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
            ref={viewportRef}
            individuals={individuals}
            hidden={hidden}
            focusedId={focusedId}
            showEnvironment={showEnvironment}
            contextOpacity={contextOpacity}
            onFocusAlone={handleFocusAlone}
            graveDimensions={graveDimensions}
            graveOutline={graveOutline}
            graves={graves}
            hiddenGraves={hiddenGraves}
            savedView={savedView}
            frameRequest={frameRequest}
            onViewChange={() => setIsDirty(true)}
            targetId={selectedId}
            selectedId={selectedId}
            vertical={vertical}
            onSolverIssues={handleSolverIssues}
            imageOverlay={imageOverlay}
            overlayFrame={overlayFrame}
            onOverlayError={setNotice}
            onSelect={openAndSelect}
            onClearSelection={() => setSelectedId(null)}
            theme={theme}
          />
          <FocusBar
            individual={focusedIndividual}
            onExit={handleExitFocus}
            showEnvironment={showEnvironment}
            onShowEnvironment={setShowEnvironment}
            contextOpacity={contextOpacity}
            onContextOpacity={setContextOpacity}
          />
          {!focusedId && imageOverlay && (
            <ImageOverlayBar
              overlay={imageOverlay}
              onOpenSettings={() => setShowOverlaySettings(true)}
              onFrame={() => {
                if (!imageOverlay.visible) {
                  setImageOverlay({ ...imageOverlay, visible: true });
                  setIsDirty(true);
                }
                setFocusedId(null);
                setOverlayFrame({});
              }}
              onToggleVisible={() => {
                setImageOverlay({
                  ...imageOverlay,
                  visible: !imageOverlay.visible,
                });
                setIsDirty(true);
              }}
            />
          )}

          <div
            className={`viewport-panels ${focusedId ? "viewport-panels-focused" : ""}`}
          >
            {!focusedId && (
              <GravesPanel
                graves={graves}
                individuals={individuals}
                assignments={graveAssignments}
                hidden={hiddenGraves}
                onToggle={(id) =>
                  setHiddenGraves((current) =>
                    current.includes(id)
                      ? current.filter((value) => value !== id)
                      : [...current, id],
                  )
                }
                onUpdate={handleUpdateGrave}
                onRemove={handleRemoveGrave}
                onAssign={(id, graveId) => {
                  setGraveAssignments((current) => ({
                    ...current,
                    [id]: graveId,
                  }));
                  setIsDirty(true);
                }}
                onImport={handleImportGraveOutline}
                onReference={(grave, level) =>
                  setGraveSurvey({
                    targetId: grave.id,
                    points: grave[level],
                    level,
                    source: grave.references?.[level]?.source || grave.name,
                    description: "Existing survey contour",
                    reference: grave.references?.[level],
                  })
                }
                onFit={(id) => {
                  setFocusedId(null);
                  setHiddenGraves((current) =>
                    current.filter((value) => value !== id),
                  );
                  setFrameRequest({ id });
                  setIsDirty(true);
                }}
                overlay={imageOverlay}
                onLoadOverlay={handleLoadOverlay}
              />
            )}

            {focusedId && (
              <InspectionPanel
                individual={focusedIndividual}
                unusualLengths={solverIssues[focusedId]?.unusualLengths}
              />
            )}
            <LayersPanel
              individuals={individuals}
              groups={groups}
              hidden={hidden}
              onToggleVisibility={handleToggleVisibility}
              onToggleGroupVisibility={handleToggleGroupVisibility}
              onFocusAlone={handleFocusAlone}
              onShowAll={handleShowAll}
              focusedId={focusedId}
              onFocus={handleFocus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
