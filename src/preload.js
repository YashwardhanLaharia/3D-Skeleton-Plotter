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
  confirmDiscard(context) {
    return ipcRenderer.invoke('confirm-discard', context);
  },
  onMenuAction(callback) {
    const channels = ['menu-open', 'menu-save', 'menu-save-as'];
    const removers = channels.map((channel) => {
      const listener = () => callback(channel);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    });
    return () => removers.forEach((remove) => remove());
  },
});
