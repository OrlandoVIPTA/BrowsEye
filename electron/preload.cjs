const { contextBridge, ipcRenderer } = require('electron');

// Expose a deliberately tiny, immutable bridge. No Node.js or file system API
// reaches the renderer; exhibit files remain selected through its local UI.
contextBridge.exposeInMainWorld('browseyeDesktop', Object.freeze({
  environment: () => ipcRenderer.invoke('browseye:environment'),
  xgridsConfig: () => ipcRenderer.invoke('browseye:xgrids-config'),
  setFullscreen: (enabled) => ipcRenderer.invoke('browseye:fullscreen', Boolean(enabled)),
  quitKiosk: () => ipcRenderer.invoke('browseye:quit-kiosk'),
  pickStreamingScene: () => ipcRenderer.invoke('browseye:pick-streaming-scene'),
}));
