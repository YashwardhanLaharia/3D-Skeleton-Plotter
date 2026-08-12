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
      defaultPath: "reconstruction.skel",
      filters: [{ name: "Skeleton Plotter project", extensions: ["skel"] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }
    targetPath = result.filePath;
  }

  try {
    await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf-8");
    return { ok: true, path: targetPath };
  } catch (error) {
    return { ok: false, error: `Could not save: ${error.message}` };
  }
});

ipcMain.handle("open-project", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open project",
    properties: ["openFile"],
    filters: [{ name: "Skeleton Plotter project", extensions: ["skel"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];

  try {
    const text = await fs.readFile(filePath, "utf-8");
    return { ok: true, path: filePath, data: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `Could not read this file: ${error.message}` };
  }
});

ipcMain.handle("confirm-discard", async (_event, context) => {
  const isClosing = context === "close";

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved changes",
    message: "This reconstruction has unsaved changes.",
    detail: isClosing
      ? "Closing now will discard them."
      : "Opening another project will discard them.",
  });

  if (result.response === 0) return "save";
  if (result.response === 1) return "discard";
  return "cancel";
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
        label: "Open…",
        accelerator: "CmdOrCtrl+O",
        click: () => sendToRenderer("menu-open"),
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
      { role: "quit" },
    ],
  },
  {
    label: "Rig",
    submenu: [{ label: "Open Rig Controls", click: createRigControlsWindow }],
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
