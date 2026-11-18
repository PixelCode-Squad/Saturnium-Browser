// =====================================================
// PerformanceSettings
//
// Configurações do sistema de desempenho: valores padrão,
// limites aceitos, validação e perfis prontos. Não depende
// do Electron, então também é usado na inicialização
// (antes do app ficar pronto) para flags de processo.
// =====================================================

const fs = require("fs");
const path = require("path");

const DEFAULTS = Object.freeze({
    enabled: true,
    ramLimitMB: 0,               // 0 = sem limite
    cpuLimitPercent: 0,          // 0 = sem limite (% de toda a CPU do computador)
    autoSuspendMinutes: 30,      // 0 = nunca suspender por inatividade
    lowerBackgroundPriority: true,
    protectPinned: true,
    hardwareAcceleration: true,  // exige reiniciar
    jsHeapLimitMB: 0             // exige reiniciar; 0 = automático
});

// [mínimo, máximo] de cada limite numérico (0 sempre significa "desligado").
const LIMITS = Object.freeze({
    ramLimitMB: [512, 262144],
    cpuLimitPercent: [10, 100],
    autoSuspendMinutes: [1, 1440],
    jsHeapLimitMB: [256, 16384]
});

const BOOL_KEYS = ["enabled", "lowerBackgroundPriority", "protectPinned", "hardwareAcceleration"];
const STARTUP_KEYS = ["hardwareAcceleration", "jsHeapLimitMB"];
const PROFILE_KEYS = ["ramLimitMB", "cpuLimitPercent", "autoSuspendMinutes", "lowerBackgroundPriority", "protectPinned"];
const PROFILES = ["performance", "balanced", "economy"];

function clampLimit(key, value, fallback) {
    if (value === 0 || value === false || value === null) return 0;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n <= 0) return 0;
    const [min, max] = LIMITS[key];
    return Math.min(max, Math.max(min, Math.round(n)));
}

// Aplica sobre "base" só os campos válidos de "input"; o resto é ignorado.
function sanitize(input, base = DEFAULTS) {
    const out = { ...DEFAULTS, ...base };
    if (!input || typeof input !== "object") return out;
    for (const key of BOOL_KEYS) {
        if (typeof input[key] === "boolean") out[key] = input[key];
    }
    for (const key of Object.keys(LIMITS)) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            out[key] = clampLimit(key, input[key], out[key]);
        }
    }
    return out;
}

function profileSettings(name, totalMemMB = 8192) {
    switch (name) {
        case "performance":
            return { ramLimitMB: 0, cpuLimitPercent: 0, autoSuspendMinutes: 0, lowerBackgroundPriority: false, protectPinned: true };
        case "balanced":
            return { ramLimitMB: 0, cpuLimitPercent: 0, autoSuspendMinutes: 30, lowerBackgroundPriority: true, protectPinned: true };
        case "economy": {
            const ram = Math.round((totalMemMB * 0.35) / 256) * 256;
            return {
                ramLimitMB: Math.min(LIMITS.ramLimitMB[1], Math.max(1024, ram)),
                cpuLimitPercent: 50, autoSuspendMinutes: 10, lowerBackgroundPriority: true, protectPinned: true
            };
        }
        default:
            return null;
    }
}

function detectProfile(settings, totalMemMB) {
    for (const name of PROFILES) {
        const p = profileSettings(name, totalMemMB);
        if (PROFILE_KEYS.every(k => settings[k] === p[k])) return name;
    }
    return "custom";
}

function load(file) {
    try { return sanitize(JSON.parse(fs.readFileSync(file, "utf8")), DEFAULTS); }
    catch { return { ...DEFAULTS }; }
}

function save(file, settings) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), "utf8");
    fs.renameSync(tmp, file);
}

function settingsFile(userDataDir) {
    return path.join(userDataDir, "performance.json");
}

module.exports = { DEFAULTS, LIMITS, PROFILES, STARTUP_KEYS, sanitize, profileSettings, detectProfile, load, save, settingsFile };
