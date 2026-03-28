const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jukeboxAPI', {
  checkHardLock: () => ipcRenderer.invoke('check-hard-lock'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  listWifi: () => ipcRenderer.invoke('get-wifi-networks'),
  connectWifi: (ssid, password) => ipcRenderer.invoke('connect-wifi', { ssid, password }),
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
