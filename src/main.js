import { app, Menu, BrowserWindow, ipcMain, dialog, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import started from "electron-squirrel-startup";
import { inspectRaster } from "./overlayAsset.js";
import { MAX_IMAGE_BYTES } from "./imageOverlay.js";
import { parseClientXlsx, parseClientRot } from "./clientGraveFiles.js";

// Handle creating shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

let mainWindow;
let isQuitting = false;

const loadWindow = (window) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

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

ipcMain.handle("import-overlay-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Load site photograph",
    properties: ["openFile"],
    filters: [
      { name: "Site photographs", extensions: ["png", "jpg", "jpeg"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  try {
    const filePath = result.filePaths[0];
    if ((await fs.stat(filePath)).size > MAX_IMAGE_BYTES) throw new Error("Choose an image no larger than 10 MB");
    const bytes = await fs.readFile(filePath);
    const metadata = inspectRaster(bytes);
    const image = nativeImage.createFromBuffer(bytes);
    const size = image.getSize();
    if (image.isEmpty() || size.width !== metadata.pixelWidth || size.height !== metadata.pixelHeight) {
      throw new Error("This photograph could not be decoded. Choose a valid PNG or JPEG.");
    }
    return { ok: true, asset: {
      source: path.basename(filePath),
      dataUrl: `data:${metadata.mime};base64,${bytes.toString("base64")}`,
      pixelWidth: metadata.pixelWidth,
      pixelHeight: metadata.pixelHeight,
    } };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("import-grave-outline", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import surveyed grave outline",
    properties: ["openFile"],
    filters: [{ name: "Client grave survey", extensions: ["xlsx", "rot"] }],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  try {
    const filePath = result.filePaths[0];
    if ((await fs.stat(filePath)).size > 16 * 1024 * 1024) throw new Error("Survey file exceeds 16 MB");
    const buffer = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    if (![".xlsx", ".rot"].includes(extension)) throw new Error("Choose an XLSX or ROT survey file");
    const survey = extension === ".xlsx" ? parseClientXlsx(buffer) : parseClientRot(buffer.toString("utf8"));
    return { ok: true, ...survey, source: path.basename(filePath) };
  } catch (error) {
    return { ok: false, error: `Could not import grave outline: ${error.message}` };
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

ipcMain.handle("set-startup-menu", (_event, startup) => {
  setApplicationMenu(Boolean(startup));
});

const sendToRenderer = (channel) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
};

// On the startup screen only Home / New / Open / Quit apply (#83). Disabled
// items are also unreachable via their accelerators.
const STARTUP_ENABLED_LABELS = new Set(["Home", "New…", "Open…", "Quit"]);

function buildMenuTemplate(startup) {
  const itemEnabled = (label) => !startup || STARTUP_ENABLED_LABELS.has(label);

  return [
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+H",
          enabled: itemEnabled("Home"),
          click: () => sendToRenderer("menu-home"),
        },
        { type: "separator" },
        {
          label: "New…",
          accelerator: "CmdOrCtrl+N",
          enabled: itemEnabled("New…"),
          click: () => sendToRenderer("menu-new"),
        },
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          enabled: itemEnabled("Open…"),
          click: () => sendToRenderer("menu-open"),
        },
        {
          label: "Add Skeletons…",
          accelerator: "CmdOrCtrl+Shift+I",
          enabled: itemEnabled("Add Skeletons…"),
          click: () => sendToRenderer("menu-import"),
        },
        {
          label: "Import Grave Outline…",
          enabled: itemEnabled("Import Grave Outline…"),
          click: () => sendToRenderer("menu-import-grave-outline"),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          enabled: itemEnabled("Save"),
          click: () => sendToRenderer("menu-save"),
        },
        {
          label: "Save As…",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: itemEnabled("Save As…"),
          click: () => sendToRenderer("menu-save-as"),
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          enabled: itemEnabled("Quit"),
          click: () => mainWindow.close(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          enabled: itemEnabled("Undo"),
          click: () => sendToRenderer("menu-undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          enabled: itemEnabled("Redo"),
          click: () => sendToRenderer("menu-redo"),
        },
        { type: "separator" },
        {
          label: "Set Grave Dimensions",
          accelerator: "CmdOrCtrl+G",
          enabled: itemEnabled("Set Grave Dimensions"),
          click: () => sendToRenderer("menu-change-grave-dimensions"),
        },
      ],
    },
    {
      label: "Export",
      submenu: [
        {
          label: "Visible skeletons (CSV)",
          accelerator: "CmdOrCtrl+Shift+C",
          enabled: itemEnabled("Visible skeletons (CSV)"),
          click: () => sendToRenderer("menu-export-csv"),
        },
        {
          label: "Screenshot",
          accelerator: "CmdOrCtrl+Shift+E",
          enabled: itemEnabled("Screenshot"),
          click: () => sendToRenderer("menu-export-screenshot"),
        },
        {
          label: "GLB",
          accelerator: "CmdOrCtrl+Shift+G",
          enabled: itemEnabled("GLB"),
          click: () => sendToRenderer("menu-export-glb"),
        },
      ],
    },
  ];
}

function setApplicationMenu(startup) {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(startup)));
}

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
  // App starts on the startup screen; the renderer confirms via set-startup-menu.
  setApplicationMenu(true);

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