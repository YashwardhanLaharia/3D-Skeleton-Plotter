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
  newProject() {
    return ipcRenderer.invoke('new-project');
  },
  openProject() {
    return ipcRenderer.invoke('open-project');
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
    const channels = ['menu-new', 'menu-open', 'menu-save', 'menu-save-as', 'menu-undo', 'menu-redo', 'menu-change-grave-dimensions'];
    const removers = channels.map((channel) => {
      const listener = () => callback(channel);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    });
    return () => removers.forEach((remove) => remove());
  },
});
