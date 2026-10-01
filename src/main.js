import { app, Menu, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import started from "electron-squirrel-startup";

// Handle creating shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

let mainWindow;
let rigControlsWindow;
let boneControlsWindow;
let isQuitting = false;

const loadWindow = (window, query = {}) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const params = new URLSearchParams(query).toString();
    const url = params
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${params}`
      : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    window.loadURL(url);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query },
    );
  }
};

const createRigControlsWindow = () => {
  if (rigControlsWindow && !rigControlsWindow.isDestroyed()) {
    rigControlsWindow.show();
    rigControlsWindow.focus();
    return;
  }

  rigControlsWindow = new BrowserWindow({
    parent: mainWindow,
    width: 380,
    height: 560,
    title: "Rig Controls",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  rigControlsWindow.on("closed", () => {
    rigControlsWindow = null;
  });

  loadWindow(rigControlsWindow, { window: "rig-controls" });
};

const createBoneControlsWindow = () => {
  if (boneControlsWindow && !boneControlsWindow.isDestroyed()) {
    boneControlsWindow.show();
    boneControlsWindow.focus();
    return;
  }

  boneControlsWindow = new BrowserWindow({
    parent: mainWindow,
    width: 420,
    height: 640,
    title: "Bone Controls",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  boneControlsWindow.on("closed", () => {
    boneControlsWindow = null;
  });

  loadWindow(boneControlsWindow, { window: "bone-controls" });
};

ipcMain.on("rig-command", (_event, command) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("rig-command", command);
  }
});

ipcMain.handle("save-project", async (_event, { payload, filePath }) => {
  let targetPath = filePath;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save project",
      defaultPath: "reconstruction.csv",
      filters: [{ name: "Skeleton Plotter project", extensions: ["csv"] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }
    targetPath = result.filePath;
  }

  try {
    await fs.writeFile(targetPath, payload, "utf-8");
    return { ok: true, path: targetPath };
  } catch (error) {
    return { ok: false, error: `Could not save: ${error.message}` };
  }
});

ipcMain.handle("save-screenshot", async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export screenshot",
    defaultPath: "skeleton-plotter.png",
    filters: [{ name: "PNG image", extensions: ["png"] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  try {
    await fs.writeFile(result.filePath, Buffer.from(data));
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: `Could not export screenshot: ${error.message}` };
  }
});

ipcMain.handle("save-glb", async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export GLB scene",
    defaultPath: "skeleton-plotter.glb",
    filters: [{ name: "Binary glTF scene", extensions: ["glb"] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  try {
    await fs.writeFile(result.filePath, Buffer.from(data));
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: `Could not export GLB: ${error.message}` };
  }
});

ipcMain.handle("new-project", async () => {
  return { ok: true, path: null, data: null };
});

const RECENT_PROJECTS_LIMIT = 8;

function recentProjectsPath() {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecentProjects() {
  try {
    const raw = await fs.readFile(recentProjectsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecentProjects(entries) {
  await fs.mkdir(path.dirname(recentProjectsPath()), { recursive: true });
  await fs.writeFile(
    recentProjectsPath(),
    JSON.stringify(entries, null, 2),
    "utf-8",
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle("get-recent-projects", async () => {
  const entries = await readRecentProjects();
  const existing = [];

  for (const entry of entries) {
    if (!entry?.path || typeof entry.path !== "string") continue;
    if (!(await fileExists(entry.path))) continue;
    existing.push({
      path: entry.path,
      name: entry.name || path.basename(entry.path),
      openedAt: entry.openedAt || 0,
      skeletonCount:
        typeof entry.skeletonCount === "number" ? entry.skeletonCount : null,
    });
  }

  if (existing.length !== entries.length) {
    await writeRecentProjects(existing);
  }

  return existing
    .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
    .slice(0, RECENT_PROJECTS_LIMIT);
});

ipcMain.handle("remember-recent-project", async (_event, project) => {
  if (!project?.path || typeof project.path !== "string") {
    return { ok: false, error: "Missing project path." };
  }

  const entries = await readRecentProjects();
  const next = {
    path: project.path,
    name: project.name || path.basename(project.path),
    openedAt: Date.now(),
    skeletonCount:
      typeof project.skeletonCount === "number" ? project.skeletonCount : null,
  };

  const withoutCurrent = entries.filter((entry) => entry.path !== next.path);
  const updated = [next, ...withoutCurrent].slice(0, RECENT_PROJECTS_LIMIT);
  await writeRecentProjects(updated);
  return { ok: true, recent: updated };
});

ipcMain.handle("open-project", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open project",
    properties: ["openFile"],
    filters: [{ name: "Skeleton Plotter project", extensions: ["csv"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];

  try {
    const text = await fs.readFile(filePath, "utf-8");
    return { ok: true, path: filePath, text };
  } catch (error) {
    return { ok: false, error: `Could not read this file: ${error.message}` };
  }
});

ipcMain.handle("open-project-path", async (_event, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return { ok: false, error: "Missing project path." };
  }

  try {
    const text = await fs.readFile(filePath, "utf-8");
    return { ok: true, path: filePath, text };
  } catch (error) {
    return { ok: false, error: `Could not read this file: ${error.message}` };
  }
});

ipcMain.handle("import-csv", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import skeleton CSV",
    properties: ["openFile"],
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];

  try {
    const text = await fs.readFile(filePath, "utf-8");
    return { ok: true, path: filePath, text };
  } catch (error) {
    return { ok: false, error: `Could not read CSV: ${error.message}` };
  }
});

ipcMain.handle("export-csv", async (_event, text) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export skeleton CSV",
    defaultPath: "skeletons.csv",
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  try {
    await fs.writeFile(result.filePath, text, "utf-8");
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: `Could not export CSV: ${error.message}` };
  }
});

ipcMain.handle("confirm-discard", async (_event, context) => {
  const isClosing = context === "close";
  const isNew = context === "new";

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved changes",
    message: "This reconstruction has unsaved changes.",
    detail: isClosing
      ? "Closing now will discard them."
      : isNew
        ? "Creating a new project will discard them."
        : "Opening another project will discard them.",
  });

  if (result.response === 0) return "save";
  if (result.response === 1) return "discard";
  return "cancel";
});

ipcMain.handle("confirm-close", async () => {
  isQuitting = true;
  mainWindow.close();
  return { ok: true };
});

const sendToRenderer = (channel) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
};
// Define custom menu template
const menuTemplate = [
  {
    label: "File",
    submenu: [
      {
        label: "Home",
        accelerator: "CmdOrCtrl+H",
        click: () => sendToRenderer("menu-home"),
      },
      { type: "separator" },
      {
        label: "New…",
        accelerator: "CmdOrCtrl+N",
        click: () => sendToRenderer("menu-new"),
      },
      {
        label: "Open…",
        accelerator: "CmdOrCtrl+O",
        click: () => sendToRenderer("menu-open"),
      },
      {
        label: "Add Skeletons…",
        accelerator: "CmdOrCtrl+Shift+I",
        click: () => sendToRenderer("menu-import"),
      },
      { type: "separator" },
      {
        label: "Save",
        accelerator: "CmdOrCtrl+S",
        click: () => sendToRenderer("menu-save"),
      },
      {
        label: "Save As…",
        accelerator: "CmdOrCtrl+Shift+S",
        click: () => sendToRenderer("menu-save-as"),
      },
      { type: "separator" },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => mainWindow.close() },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => sendToRenderer("menu-undo") },
      { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", click: () => sendToRenderer("menu-redo") },
      { type: "separator" },
      { label: "Set Grave Dimensions", accelerator: "CmdOrCtrl+G", click: () => sendToRenderer("menu-change-grave-dimensions") },
    ],
  },
  {
    label: "Export",
    submenu: [
      { label: "Visible skeletons (CSV)", accelerator: "CmdOrCtrl+Shift+C", click: () => sendToRenderer("menu-export-csv") },
      { label: "Screenshot", accelerator: "CmdOrCtrl+Shift+E", click: () => sendToRenderer("menu-export-screenshot") },
      { label: "GLB", accelerator: "CmdOrCtrl+Shift+G", click: () => sendToRenderer("menu-export-glb") },
    ],
  },
  {
    label: "Rig",
    submenu: [
      { label: "Open Rig Controls", click: createRigControlsWindow },
      { label: "Open Bone Controls", click: createBoneControlsWindow },
    ],
  },
];

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Load the index.html of the app.
  loadWindow(mainWindow);

  mainWindow.on("close", (event) => {
    if (isQuitting) return;

    event.preventDefault();
    mainWindow.webContents.send("request-close");
  });

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  // Create the menu
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
