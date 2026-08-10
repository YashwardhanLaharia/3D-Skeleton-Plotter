import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendRigCommand(command) {
    ipcRenderer.send('rig-command', command);
  },
  onRigCommand(callback) {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('rig-command', listener);
    return () => ipcRenderer.removeListener('rig-command', listener);
  },
  saveProject(request) {
    return ipcRenderer.invoke('save-project', request);
  },
  openProject() {
    return ipcRenderer.invoke('open-project');
  },
});
