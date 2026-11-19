const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bookmarksAPI", {
    getAll: () => ipcRenderer.invoke("bookmarks-get"),
    createFolder: (name, parentId) => ipcRenderer.invoke("bookmarks-folder-create", name, parentId),
    renameFolder: (id, name) => ipcRenderer.invoke("bookmarks-folder-rename", id, name),
    deleteFolder: (id) => ipcRenderer.invoke("bookmarks-folder-delete", id),
    moveBookmark: (id, folderId) => ipcRenderer.invoke("bookmarks-move", id, folderId),
    removeBookmark: (id) => ipcRenderer.invoke("bookmarks-remove", id),
    open: (url) => ipcRenderer.invoke("bookmarks-open", url),
    importHtml: () => ipcRenderer.invoke("bookmarks-import"),
    exportHtml: () => ipcRenderer.invoke("bookmarks-export"),
    onUpdated: (callback) => ipcRenderer.on("bookmarks-page-updated", () => callback())
});
