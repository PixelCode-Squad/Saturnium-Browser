// Flags que o Chromium só lê na inicialização. Precisam ser aplicadas ANTES de
// app.whenReady(); por isso mudar essas opções exige reiniciar o navegador.
const Settings = require("./PerformanceSettings");

let lastApplied = { hardwareAcceleration: true, jsHeapLimitMB: 0 };

function applyStartupFlags(app) {
    let applied = { hardwareAcceleration: true, jsHeapLimitMB: 0 };
    try {
        const s = Settings.load(Settings.settingsFile(app.getPath("userData")));
        if (s.hardwareAcceleration === false) app.disableHardwareAcceleration();
        if (s.jsHeapLimitMB > 0) {
            // Teto de memória do JavaScript (V8) por aba. Páginas que passarem dele travam.
            app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${s.jsHeapLimitMB}`);
        }
        applied = { hardwareAcceleration: s.hardwareAcceleration !== false, jsHeapLimitMB: s.jsHeapLimitMB };
    } catch (error) {
        console.error("[Performance] Falha ao aplicar flags de inicialização:", error.message);
    }
    lastApplied = applied;
    return applied;
}

// O que realmente está valendo neste processo (para saber se falta reiniciar).
function getApplied() { return { ...lastApplied }; }

module.exports = { applyStartupFlags, getApplied };
