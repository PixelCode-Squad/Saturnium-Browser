const { contextBridge, ipcRenderer } = require("electron");

// Exposto somente para saturnium://performance. O processo principal
// valida o remetente em cada chamada.
contextBridge.exposeInMainWorld("saturniumPerformance", {
    getStatus: () => ipcRenderer.invoke("performance-get"),
    update: patch => ipcRenderer.invoke("performance-update", patch),
    applyProfile: name => ipcRenderer.invoke("performance-profile", name),
    suspendTab: id => ipcRenderer.invoke("performance-suspend", id),
    suspendBackground: () => ipcRenderer.invoke("performance-suspend-background"),
    relaunch: () => ipcRenderer.invoke("performance-relaunch")
});
