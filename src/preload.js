import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  autosaveProject(snapshot) {
    return ipcRenderer.invoke('autosave-project', snapshot);
  },
  restoreAutosave() {
    return ipcRenderer.invoke('restore-autosave');
  },
  saveProject(request) {
    return ipcRenderer.invoke('save-project', request);
  },
  saveScreenshot(data) {
    return ipcRenderer.invoke('save-screenshot', data);
  },
  saveGLB(data) {
    return ipcRenderer.invoke('save-glb', data);
  },
  newProject() {
    return ipcRenderer.invoke('new-project');
  },
  openProject() {
    return ipcRenderer.invoke('open-project');
  },
  openProjectPath(filePath) {
    return ipcRenderer.invoke('open-project-path', filePath);
  },
  getRecentProjects() {
    return ipcRenderer.invoke('get-recent-projects');
  },
  rememberRecentProject(project) {
    return ipcRenderer.invoke('remember-recent-project', project);
  },
  importOverlayImage() {
    return ipcRenderer.invoke('import-overlay-image');
  },
  importCsv() {
    return ipcRenderer.invoke('import-csv');
  },
  importGraveOutline() {
    return ipcRenderer.invoke('import-grave-outline');
  },
  exportCsv(text) {
    return ipcRenderer.invoke('export-csv', text);
  },
  confirmDiscard(context) {
    return ipcRenderer.invoke('confirm-discard', context);
  },
  onRequestClose(callback) {
    const listener = () => callback();
    ipcRenderer.on('request-close', listener);
    return () => ipcRenderer.removeListener('request-close', listener);
  },
  confirmClose() {
    return ipcRenderer.invoke('confirm-close');
  },
  onMenuAction(callback) {
    const channels = ['menu-home', 'menu-new', 'menu-open', 'menu-save', 'menu-save-as', 'menu-export-screenshot', 'menu-export-glb', 'menu-import', 'menu-import-grave-outline', 'menu-export-csv', 'menu-undo', 'menu-redo', 'menu-change-grave-dimensions', 'menu-toggle-dark-theme'];
    const removers = channels.map((channel) => {
      const listener = () => callback(channel);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    });
    return () => removers.forEach((remove) => remove());
  },
  setStartupMenu(startup) {
    return ipcRenderer.invoke('set-startup-menu', startup);
  },
  setMenuTheme(darkTheme) {
    return ipcRenderer.invoke('set-menu-theme', darkTheme);
  },
});
