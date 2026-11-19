const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    dialog,
    protocol,
    net,
    session
} = require("electron");
//
const path =
    require("path");

const fs =
    require("fs").promises;

const { pathToFileURL } = require("url");

const BrowserManager =
    require("./src/browser/BrowserManager");

const UpdateManager =
    require("./src/updater/UpdateManager");

const AIManager =
    require("./src/ai/AIManager");

const { applyStartupFlags } =
    require("./src/performance/startupFlags");

// Opções de desempenho que o Chromium só lê na inicialização
// (aceleração por hardware, teto de memória JS). Precisa vir
// antes do app ficar pronto.
applyStartupFlags(app);

let win;

let browserManager;

let updateManager;

let aiManager;

// ==========================================
// CRIAR JANELA
// ==========================================

function createWindow() {

    win = new BrowserWindow({

        width: 1280,
        height: 800,

        minWidth: 900,
        minHeight: 600,

        frame: false,

        icon: path.join(
            __dirname,
            "assets",
            "saturniumbrowser-ico.ico"
        ),

        webPreferences: {

            preload: path.join(
                __dirname,
                "preload.js"
            ),

            contextIsolation: true,

            nodeIntegration: false

        }

    });


    // ======================================
    // REMOVER MENU PADRÃO DO ELECTRON
    // ======================================

    win.setMenu(null);


    // ======================================
    // CARREGAR INTERFACE
    // ======================================

    win.loadFile(
        "index.html"
    );


    // ======================================
    // INICIALIZAR BROWSER MANAGER
    // ======================================

    win.webContents.once(
        "did-finish-load",
        () => {

            browserManager =
                new BrowserManager(win);

            // Modo IA da busca usa o mesmo AIManager (provedor/chave) do SaturniumAI
            if (aiManager) {
                browserManager.ai = aiManager;
            }


            browserManager.initialize();
            notifyBookmarksChanged();

        }
    );

    if (!updateManager) {

        updateManager = new UpdateManager(win);

        setTimeout(() => {
            updateManager.checkForUpdates();
            updateManager.startPeriodicChecks();
        }, 5000);

    } else {

        updateManager.window = win;

    }

    // ======================================
    // REDIMENSIONAMENTO
    // ======================================

    win.on(
        "resize",
        () => {

            if (browserManager) {

                browserManager.updateBounds();

            }

        }
    );


    // ======================================
    // ATALHOS
    // ======================================

    win.webContents.on(
        "before-input-event",
        handleKeyboardInput
    );

}


// ==========================================
// TECLADO
// ==========================================

function handleKeyboardInput(
    event,
    input
) {

    if (
        input.type !== "keyDown"
    ) {

        return;

    }


    if (!browserManager) {

        return;

    }


    // ======================================
    // CTRL + L
    // FOCAR BARRA DE ENDEREÇO
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "l"
    ) {

        event.preventDefault();


        win.webContents.send(
            "focus-address-bar"
        );


        return;

    }


    // ======================================
    // CTRL + T
    // NOVA ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "t"
    ) {

        event.preventDefault();


        browserManager.createTab();


        return;

    }


    // ======================================
    // CTRL + W
    // FECHAR ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "w"
    ) {

        event.preventDefault();


        const active =
            browserManager.getActiveTab();


        if (active) {

            browserManager.closeTab(
                active.id
            );

        }


        return;

    }


    // ======================================
    // CTRL + SHIFT + T
    // REABRIR ABA FECHADA
    // ======================================

    if (
        input.control &&
        input.shift &&
        input.key.toLowerCase() === "t"
    ) {

        event.preventDefault();


        browserManager.reopenClosedTab();


        return;

    }


    // ======================================
    // CTRL + SHIFT + TAB
    // ABA ANTERIOR
    // ======================================

    if (
        input.control &&
        input.shift &&
        input.key === "Tab"
    ) {

        event.preventDefault();


        browserManager.switchTab(
            -1
        );


        return;

    }


    // ======================================
    // CTRL + TAB
    // PRÓXIMA ABA
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key === "Tab"
    ) {

        event.preventDefault();


        browserManager.switchTab(
            1
        );


        return;

    }


    // ======================================
    // CTRL + H
    // HISTÓRICO
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "h"
    ) {

        event.preventDefault();


        browserManager.openHistory();


        return;

    }


    // ======================================
    // CTRL + J
    // DOWNLOADS
    // ======================================

    if (
        input.control &&
        !input.shift &&
        input.key.toLowerCase() === "j"
    ) {

        event.preventDefault();


        browserManager.openDownloads();


        return;

    }

    if (
        input.control &&
        input.shift &&
        input.key.toLowerCase() === "b"
    ) {
        event.preventDefault();
        browserManager.openBookmarks();
        return;
    }

}


// ==========================================
// NAVEGAÇÃO
// ==========================================


// ==========================================
// NAVEGAR
// ==========================================

ipcMain.on(
    "browser-navigate",
    (event, url) => {

        if (!browserManager) {

            return;

        }


        browserManager.navigate(
            url
        );

    }
);


// ==========================================
// ATUALIZAÇÕES
// ==========================================

ipcMain.on("update-check", () => {

    if (!updateManager) return;

    updateManager.checkForUpdates(true);

});


// ==========================================
// EXTENSÕES — IPC SEGURO
// Só as páginas internas de extensões (com o
// preload seguro) podem chamar estes handlers.
// ==========================================

function isTrustedExtensionsEvent(event) {
    return !!(
        browserManager &&
        browserManager.extensions &&
        event &&
        browserManager.isExtensionsWebContents(event.sender)
    );
}

ipcMain.handle("extensions-list", (event) => {

    if (!isTrustedExtensionsEvent(event)) throw new Error("UNAUTHORIZED");

    return browserManager.extensions.list();

});

ipcMain.handle("extensions-set-enabled", (event, id, enabled) => {

    if (!isTrustedExtensionsEvent(event)) throw new Error("UNAUTHORIZED");

    if (typeof id !== "string") throw new Error("ID inválido.");

    return browserManager.extensions.setEnabled(id, !!enabled);

});

ipcMain.handle("extensions-open-settings", (event, id) => {

    if (!isTrustedExtensionsEvent(event)) throw new Error("UNAUTHORIZED");

    if (typeof id !== "string") throw new Error("ID inválido.");

    return browserManager.openExtensionSettings(id);

});

ipcMain.handle("extensions-call", async (event, id, method, args) => {

    if (!isTrustedExtensionsEvent(event)) throw new Error("UNAUTHORIZED");

    if (typeof id !== "string") throw new Error("ID inválido.");

    return browserManager.extensions.call(id, method, args);

});


// ==========================================
// DESEMPENHO — IPC SEGURO
// Só a página interna saturnium://performance
// pode ler ou alterar estas configurações.
// ==========================================

function isTrustedPerformanceEvent(event) {
    return !!(
        browserManager &&
        browserManager.performance &&
        event &&
        browserManager.isPerformanceWebContents(event.sender)
    );
}

ipcMain.handle("performance-get", (event) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    return browserManager.performance.getStatus();

});

ipcMain.handle("performance-update", (event, patch) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Configuração inválida.");

    return browserManager.performance.update(patch);

});

ipcMain.handle("performance-profile", (event, name) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    if (typeof name !== "string") throw new Error("Perfil inválido.");

    return browserManager.performance.applyProfile(name);

});

ipcMain.handle("performance-suspend", (event, id) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    if (!Number.isInteger(id)) throw new Error("Aba inválida.");

    return browserManager.performance.suspendTab(id);

});

ipcMain.handle("performance-suspend-background", (event) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    return browserManager.performance.suspendBackground();

});

ipcMain.handle("performance-relaunch", (event) => {

    if (!isTrustedPerformanceEvent(event)) throw new Error("UNAUTHORIZED");

    app.relaunch();

    app.quit();

});


// ==========================================
// SATURNIUM AI — IPC SEGURO
// ==========================================

function isTrustedAIEvent(event) {
    return !!(
        browserManager &&
        event &&
        browserManager.isAIWebContents(event.sender)
    );
}

function isTrustedBookmarksPageEvent(event) {
    return !!(
        browserManager &&
        event &&
        browserManager.isBookmarksWebContents(event.sender)
    );
}

function notifyBookmarksChanged() {
    if (!browserManager) return;
    if (win && !win.isDestroyed()) {
        win.webContents.send("bookmarks-updated");
    }
    for (const tab of browserManager.tabManager.tabs) {
        if (tab.bookmarksPreload && tab.view && !tab.view.webContents.isDestroyed()) {
            tab.view.webContents.send("bookmarks-page-updated");
        }
    }
}

ipcMain.handle("bookmarks-get", (event) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    return browserManager.bookmarks.getAll();
});

ipcMain.handle("bookmarks-folder-create", (event, name, parentId) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    const folder = browserManager.bookmarks.createFolder(name, parentId || null);
    notifyBookmarksChanged();
    return folder;
});

ipcMain.handle("bookmarks-folder-rename", (event, id, name) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    browserManager.bookmarks.renameFolder(id, name);
    notifyBookmarksChanged();
    return true;
});

ipcMain.handle("bookmarks-folder-delete", (event, id) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    browserManager.bookmarks.deleteFolder(id);
    notifyBookmarksChanged();
    return true;
});

ipcMain.handle("bookmarks-move", (event, id, folderId) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    browserManager.bookmarks.moveBookmark(id, folderId || null);
    notifyBookmarksChanged();
    return true;
});

ipcMain.handle("bookmarks-remove", (event, id) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    browserManager.bookmarks.removeBookmark(id);
    notifyBookmarksChanged();
    return true;
});

ipcMain.handle("bookmarks-open", (event, url) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        throw new Error("Endereço de favorito inválido.");
    }
    browserManager.navigate(url);
    return true;
});

ipcMain.handle("bookmarks-import", async (event) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    const result = await dialog.showOpenDialog(win, {
        title: "Importar favoritos",
        properties: ["openFile"],
        filters: [{ name: "Favoritos HTML", extensions: ["html", "htm"] }]
    });
    if (result.canceled || !result.filePaths.length) return null;
    const file = result.filePaths[0];
    const stats = await fs.stat(file);
    if (stats.size > 10 * 1024 * 1024) {
        throw new Error("O arquivo de favoritos excede 10 MB.");
    }
    const count = browserManager.bookmarks.importHtml(await fs.readFile(file, "utf8"));
    notifyBookmarksChanged();
    return count;
});

ipcMain.handle("bookmarks-export", async (event) => {
    if (!isTrustedBookmarksPageEvent(event)) throw new Error("UNAUTHORIZED");
    const result = await dialog.showSaveDialog(win, {
        title: "Exportar favoritos",
        defaultPath: path.join(app.getPath("documents"), "favoritos.html"),
        filters: [{ name: "Favoritos HTML", extensions: ["html"] }]
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, browserManager.bookmarks.exportHtml(), "utf8");
    return true;
});

ipcMain.handle("bookmarks-shell-get", (event) => {
    if (!win || event.sender !== win.webContents || !browserManager) throw new Error("UNAUTHORIZED");
    return browserManager.bookmarks.getAll();
});

ipcMain.handle("bookmarks-shell-is-saved", (event, url) => {
    if (!win || event.sender !== win.webContents || !browserManager) throw new Error("UNAUTHORIZED");
    return browserManager.bookmarks.isBookmarked(url);
});

ipcMain.handle("bookmarks-shell-toggle", (event, url, title, favicon) => {
    if (!win || event.sender !== win.webContents || !browserManager) throw new Error("UNAUTHORIZED");
    const bookmarked = browserManager.bookmarks.toggle(url, title, favicon);
    notifyBookmarksChanged();
    return bookmarked;
});

ipcMain.handle("saturnium-ai-config-get", (event) => {
    if (!isTrustedAIEvent(event)) throw new Error("UNAUTHORIZED");
    return aiManager.publicConfig();
});

ipcMain.handle("saturnium-ai-config-save", (event, config) => {
    if (!isTrustedAIEvent(event)) throw new Error("UNAUTHORIZED");
    return aiManager.saveConfig(config);
});

ipcMain.handle("saturnium-ai-chat", async (event, messages, options) => {
    if (!isTrustedAIEvent(event)) throw new Error("UNAUTHORIZED");
    return aiManager.chat(messages, options || {});
});

ipcMain.handle("saturnium-ai-test", async (event, provider) => {
    if (!isTrustedAIEvent(event)) throw new Error("UNAUTHORIZED");
    return aiManager.testConnection(provider);
});

ipcMain.handle("saturnium-ai-stop", (event) => {
    if (!isTrustedAIEvent(event)) throw new Error("UNAUTHORIZED");
    aiManager.stopAll();
    return true;
});


ipcMain.on("update-install", () => {

    if (!updateManager) return;

    updateManager.installUpdate();

});

// ==========================================
// VOLTAR
// ==========================================

ipcMain.on(
    "browser-back",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.back();

    }
);


// ==========================================
// AVANÇAR
// ==========================================

ipcMain.on(
    "browser-forward",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.forward();

    }
);


// ==========================================
// RECARREGAR
// ==========================================

ipcMain.on(
    "browser-reload",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.reload();

    }
);


// ==========================================
// PARAR CARREGAMENTO
// ==========================================

ipcMain.on(
    "browser-stop",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.stop();

    }
);


// ==========================================
// ABAS
// ==========================================


// ==========================================
// NOVA ABA
// ==========================================

ipcMain.on(
    "tab-new",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.createTab();

    }
);


// ==========================================
// FECHAR ABA
// ==========================================

ipcMain.on(
    "tab-close",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.closeTab(
            id
        );

    }
);


// ==========================================
// ATIVAR ABA
// ==========================================

ipcMain.on(
    "tab-activate",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.activateTab(
            id
        );

    }
);


// ==========================================
// ABRIR HISTÓRICO (via menu)
// ==========================================

ipcMain.on(
    "ai-open",
    () => {
        if (browserManager) browserManager.openAI();
    }
);

ipcMain.on(
    "history-open",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.openHistory();

    }
);

ipcMain.on("bookmarks-open-page", (event, folderId) => {
    if (win && event.sender === win.webContents && browserManager) {
        browserManager.openBookmarks(typeof folderId === "string" ? folderId : null);
    }
});


// ==========================================
// FIXAR / DESAFIXAR ABA
// ==========================================

ipcMain.on(
    "tab-toggle-pin",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.togglePinTab(
            id
        );

    }
);


// ==========================================
// REABRIR ÚLTIMA ABA FECHADA
// ==========================================

ipcMain.on(
    "tab-reopen-closed",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.reopenClosedTab();

    }
);


// ==========================================
// DOWNLOADS
// ==========================================

ipcMain.on(
    "downloads-open",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.openDownloads();

    }
);


ipcMain.on(
    "downloads-bar-close",
    () => {

        if (!browserManager) {

            return;

        }


        browserManager.closeDownloadsBar();

    }
);


ipcMain.on(
    "downloads-cancel",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.cancelDownload(
            id
        );

    }
);


ipcMain.on(
    "downloads-open-file",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.openDownloadFile(
            id
        );

    }
);


ipcMain.on(
    "downloads-show-in-folder",
    (event, id) => {

        if (!browserManager) {

            return;

        }


        browserManager.showDownloadInFolder(
            id
        );

    }
);


// ==========================================
// MENU PRINCIPAL (TRÊS PONTINHOS)
// ==========================================

ipcMain.on(
    "main-menu-open",
    () => {

        if (
            !browserManager ||
            !win
        ) {

            return;

        }


        const template = [

            {
                label: "Histórico",

                accelerator: "Ctrl+H",

                click: () => {

                    browserManager.openHistory();

                }
            },

            {
                label: "Favoritos",

                accelerator: "Ctrl+Shift+B",

                click: () => {

                    browserManager.openBookmarks();

                }
            },

            {
                label: "Reabrir aba fechada",

                accelerator: "Ctrl+Shift+T",

                click: () => {

                    browserManager.reopenClosedTab();

                }
            },

            {
                label: "Downloads",

                accelerator: "Ctrl+J",

                click: () => {

                    browserManager.openDownloads();

                }
            },

            {
                label: "Extensões",

                click: () => {

                    browserManager.openExtensions();

                }
            },

            {
                label: "Desempenho",

                click: () => {

                    browserManager.openPerformance();

                }
            },

            {
                label: "SaturniumAI",

                accelerator: "Ctrl+Shift+A",

                click: () => {

                    browserManager.openAI();

                }
            },

            {
                type: "separator"
            },

            {
                label: "Verificar atualizações",

                click: () => {

                    if (!updateManager) {

                        return;

                    }


                    updateManager.checkForUpdates(true);

                }
            }

        ];


        Menu.buildFromTemplate(
            template
        ).popup({
            window: win
        });

    }
);


// ==========================================
// MENU DE CONTEXTO DA ABA (CLIQUE DIREITO)
// ==========================================

ipcMain.on(
    "tab-context-menu",
    (event, payload) => {

        if (
            !browserManager ||
            !win
        ) {

            return;

        }


        const { id, pinned } =
            payload;


        const template = [

            {
                label:
                    pinned
                        ? "Desafixar aba"
                        : "Fixar aba",

                click: () => {

                    browserManager.togglePinTab(
                        id
                    );

                }
            },

            {
                type: "separator"
            },

            {
                label:
                    "Fechar aba",

                click: () => {

                    browserManager.closeTab(
                        id
                    );

                }
            }

        ];


        Menu.buildFromTemplate(
            template
        ).popup({
            window: win
        });

    }
);


// ==========================================
// CONTROLES DA JANELA
// ==========================================


// ==========================================
// MINIMIZAR
// ==========================================

ipcMain.on(
    "window-minimize",
    () => {

        if (!win) return;

        win.minimize();

    }
);


// ==========================================
// MAXIMIZAR / RESTAURAR
// ==========================================

ipcMain.on(
    "window-maximize",
    () => {

        if (!win) return;


        if (win.isMaximized()) {

            win.unmaximize();

        } else {

            win.maximize();

        }

    }
);


// ==========================================
// FECHAR JANELA
// ==========================================

ipcMain.on(
    "window-close",
    () => {

        if (!win) return;

        win.close();

    }
);
// ==========================================
// SATURNIUM PROTOCOL
// ==========================================

protocol.registerSchemesAsPrivileged([
    {
        scheme: "saturnium",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

// ==========================================
// ELECTRON READY
// ==========================================

app.whenReady().then(async () => {

    // ==========================================
    // PERMISSÕES SENSÍVEIS — NEGADAS POR PADRÃO
    // (câmera, microfone, localização, notificações,
    // captura de tela, USB/Bluetooth/HID/serial etc.)
    // Só o essencial pra navegação normal é permitido.
    // ==========================================

    const ALLOWED_PERMISSIONS = new Set([
        "fullscreen",
        "pointerLock",
        "clipboard-sanitized-write"
    ]);

    session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback) => {

            callback(
                ALLOWED_PERMISSIONS.has(permission)
            );

        }
    );

    session.defaultSession.setPermissionCheckHandler(
        (webContents, permission) => {

            return ALLOWED_PERMISSIONS.has(permission);

        }
    );

    // ==========================================
    // BLOQUEIO DE REDE
    // Barra qualquer requisição (script, iframe,
    // imagem, anúncio etc) vinda de um domínio já
    // confirmado como malicioso — não só a
    // navegação principal, mas tudo que a página
    // tentar carregar por baixo dos panos.
    // ==========================================

    session.defaultSession.webRequest.onBeforeRequest(
        (details, callback) => {

            if (!browserManager) {

                callback({ cancel: false });

                return;
            }


            let host = "";

            try {

                host = new URL(details.url).hostname.toLowerCase();

            } catch (error) {

                callback({ cancel: false });

                return;
            }


            const isMalicious =
                browserManager.security.isKnownMaliciousHost(
                    host
                );


            // Extensões com permissão network.block (ex.: Saturnium AdBlock) só
            // fornecem listas; o host decide se a requisição de terceiro é cancelada.
            const blockedByExtension = !isMalicious &&
                browserManager.extensions.host.shouldBlock(details);

            callback({ cancel: isMalicious || blockedByExtension });

        }
    );

    // Registrar protocolo interno Saturnium
    protocol.handle("saturnium", async (request) => {

        const url = new URL(request.url);

        let file;

        switch (url.hostname) {

            case "newtab":
                file = "newtab.html";
                break;

            case "history":
                file = "history.html";
                break;

            case "bookmarks":
                file = "bookmarks.html";
                break;

            case "downloads":
                file = "downloads.html";
                break;

            case "search":
                file = "search.html";
                break;

            case "extensions":
                file = "extensions.html";
                break;

            case "performance":
                file = "performance.html";
                break;

            case "ext": {
                // saturnium://ext/<id>/<arquivo> — arquivos de extensões ativas
                const parts = url.pathname.split("/").filter(Boolean);
                const extId = decodeURIComponent(parts.shift() || "");
                const relative = decodeURIComponent(parts.join("/"));

                const record = browserManager &&
                    browserManager.extensions.extensions.get(extId);

                if (!record || !record.enabled || !relative) {
                    return new Response("Extensão não encontrada", { status: 404 });
                }

                const assetPath = browserManager.extensions.resolveAsset(extId, relative);

                if (!assetPath) {
                    return new Response("Recurso inválido", { status: 404 });
                }

                return net.fetch(pathToFileURL(assetPath).toString());
            }

            case "ai": {
                // A página AI usa arquivos externos (CSS/JS).
                // O protocolo interno precisa servi-los também.
                if (url.pathname !== "/" && url.pathname !== "") {
                    const relative = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
                    const candidate = path.resolve(__dirname, relative);
                    const root = path.resolve(__dirname);
                    if (!candidate.startsWith(root + path.sep)) {
                        return new Response("Recurso interno inválido", { status: 403 });
                    }
                    return net.fetch(pathToFileURL(candidate).toString());
                }
                file = "saturnium-ai.html";
                break;
            }

            default:
                return new Response(
                    "Página Saturnium desconhecida",
                    {
                        status: 404
                    }
                );
        }

        const filePath = path.join(
            __dirname,
            file
        );

        return net.fetch(
            pathToFileURL(filePath).toString()
        );
    });

    // SaturniumAI vive no processo principal.
    // As chaves e requisições nunca ficam expostas ao renderer.
    if (!aiManager) {
        aiManager = new AIManager();
    }

    // Criar janela principal
    createWindow();

});

// ==========================================
// MACOS
// ==========================================

app.on(
    "activate",
    () => {

        if (
            BrowserWindow.getAllWindows()
                .length === 0
        ) {

            createWindow();

        }

    }
);

// ==========================================
// FECHAR
// ==========================================

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);

// ==========================================
// ENCERRAMENTO
// Devolve a prioridade normal aos processos
// que o sistema de desempenho rebaixou.
// ==========================================

app.on(
    "before-quit",
    () => {

        if (
            browserManager &&
            browserManager.performance
        ) {

            browserManager.performance.stop();

        }

    }
);
