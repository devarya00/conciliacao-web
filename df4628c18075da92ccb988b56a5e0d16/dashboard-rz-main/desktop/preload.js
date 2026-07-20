const { contextBridge, ipcRenderer } = require('electron');

// canal único e explícito — nada de invoke/send genérico exposto ao renderer
const config = ipcRenderer.sendSync('desktop-app:config');

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  version: config.version,
  apiBaseUrl: config.apiBaseUrl,
});
