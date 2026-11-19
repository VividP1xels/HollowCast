'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hollowcast', {
  desktop: true,
  listSources: () => ipcRenderer.invoke('hc:list-sources'),
  chooseSource: id => ipcRenderer.invoke('hc:choose-source', id),
});
