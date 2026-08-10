import { app, Menu, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';

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
      { query }
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
    title: 'Rig Controls',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  rigControlsWindow.on('closed', () => {
    rigControlsWindow = null;
  });

  loadWindow(rigControlsWindow, { window: 'rig-controls' });
};

ipcMain.on('rig-command', (_event, command) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('rig-command', command);
  }
});

console.log('registering save-project handler');

ipcMain.handle('save-project', async (_event, payload) => {
  const filePath = path.join(app.getPath('documents'), 'test-project.skel');
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { ok: true, path: filePath };
});

// Define custom menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { label: 'Open', click: () => console.log('Open') },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Rig',
    submenu: [
      { label: 'Open Rig Controls', click: createRigControlsWindow },
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
