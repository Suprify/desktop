const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(event, ...args)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    getSnmpData: (ip, oid, community) => ipcRenderer.invoke('get-snmp-data', ip, oid, community),
    onAppInfoReceived: (callback) => ipcRenderer.on('app-info', callback),
    openExternal: (url) => shell.openExternal(url),
    getMachineName: () => ipcRenderer.invoke('get-machine-name'),
    generateAccessToken: () => ipcRenderer.invoke('generate-access-token')
});
