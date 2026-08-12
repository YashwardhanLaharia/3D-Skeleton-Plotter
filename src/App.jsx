// The root component owns individuals, sidebar state, and rig commands.

import { useEffect, useRef, useState } from "react";
import {
  validateProject,
  normaliseIndividual,
  SCHEMA_VERSION,
} from "./projectFile";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
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

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]),
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // The data model is now an array of individuals, not one coordinate object.
  // Each carries its own label, colour, and full coordinate set.
  const [individuals, setIndividuals] = useState(() => [
    {
      id: "ind-1",
      label: "",
      colour: "#E69F00",
      coords: makeBlankCoords(),
    },
  ]);
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
    setIndividuals((previous) =>
      previous.map((individual) =>
        individual.id !== individualId
          ? individual
          : {
              ...individual,
              coords: {
                ...individual.coords,
                [jointId]: {
                  ...individual.coords[jointId],
                  [axis]: rawValue,
                },
              },
            },
      ),
    );

    setIsDirty(true);
  }

  function handleLabelChange(individualId, label) {
    setIndividuals((previous) =>
      previous.map((individual) =>
        individual.id === individualId ? { ...individual, label } : individual,
      ),
    );
    setIsDirty(true);
  }

  function handleToggle(individualId) {
    setOpenId((current) => (current === individualId ? null : individualId));
  }

  function handleAdd() {
    const id = `ind-${nextId.current}`;
    const colour = PALETTE[(nextId.current - 1) % PALETTE.length];
    nextId.current += 1;

    setIndividuals((previous) => [
      ...previous,
      { id, label: "", colour, coords: makeBlankCoords() },
    ]);
    setOpenId(id);

    setIsDirty(true);
  }

  function handleRemove(individualId) {
    setIndividuals((previous) =>
      previous.filter((individual) => individual.id !== individualId),
    );
    setOpenId((current) => (current === individualId ? null : current));

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
    setIndividuals(loaded);

    const numbers = loaded
      .map((individual) => Number(individual.id.replace("ind-", "")))
      .filter((value) => Number.isFinite(value));
    nextId.current = numbers.length ? Math.max(...numbers) + 1 : 1;

    setOpenId(loaded[0]?.id ?? null);

    setFilePath(result.path);

    setIsDirty(false);
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

  // Menu clicks arrive from the main process. The ref keeps the listener pointing
  // at the latest handlers: registering once with [] would capture the state as
  // it was on first render, so saving would write an empty project forever.
  const actionsRef = useRef(null);
  actionsRef.current = { handleOpen, handleSave };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onMenuAction((action) => {
      if (action === "menu-open") actionsRef.current.handleOpen();
      if (action === "menu-save") actionsRef.current.handleSave(false);
      if (action === "menu-save-as") actionsRef.current.handleSave(true);
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : "Untitled";
    document.title = `${isDirty ? "• " : ""}${name} — Skeleton Plotter`;
  }, [filePath, isDirty]);

  return (
    <div className="app-shell d-flex flex-column vh-100 overflow-hidden">
      <header className="app-menu-bar bg-body-tertiary border-bottom px-1 py-1">
        <nav
          className="d-flex align-items-center"
          aria-label="Application menu"
        >
          {["Edit", "Settings", "Help", "Language", "View"].map((item) => (
            <button key={item} type="button" className="app-menu-button">
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="app-workspace d-flex flex-grow-1 overflow-hidden">
        <Sidebar
          individuals={individuals}
          openId={openId}
          onChange={handleChange}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onLabelChange={handleLabelChange}
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

        <MainView command={rigCommand} />
      </div>
    </div>
  );
}
