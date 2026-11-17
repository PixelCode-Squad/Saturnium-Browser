const fs = require("fs");
const path = require("path");

const HOST_RE = /^[a-z0-9.-]{1,253}$/;
const OPTIONS = ["ads", "trackers", "cosmetic", "enabled"];
const MAX_CUSTOM = 500;
const MAX_ALLOW = 500;
const SAVE_EVERY_MS = 30000;

function normHost(h) {
    const v = String(h || "").trim().toLowerCase().replace(/^www\./, "");
    if (!HOST_RE.test(v) || !v.includes(".")) throw new Error("Domínio inválido.");
    return v;
}

function readList(file) {
    try {
        return fs.readFileSync(path.join(__dirname, "filters", file), "utf8")
            .split(/\r?\n/)
            .map(l => l.trim().toLowerCase())
            .filter(l => l && !l.startsWith("#") && HOST_RE.test(l) && l.includes("."));
    } catch (error) {
        console.error(`[AdBlock] Falha ao ler ${file}:`, error.message);
        return [];
    }
}

module.exports = {
    activate(api) {
        const store = api.storageAPI;
        const saved = store.get();
        const adsList = readList("ads.txt");
        const trackersList = readList("trackers.txt");

        const clean = list => (Array.isArray(list) ? list : []).map(h => { try { return normHost(h); } catch { return null; } })
            .filter(Boolean);

        const state = {
            enabled: saved.enabled !== false,
            ads: saved.ads !== false,
            trackers: saved.trackers !== false,
            cosmetic: saved.cosmetic !== false,
            custom: [...new Set(clean(saved.custom))].slice(0, MAX_CUSTOM),
            allow: [...new Set(clean(saved.allow))].slice(0, MAX_ALLOW)
        };
        const base = Number.isFinite(saved.total) && saved.total >= 0 ? Math.floor(saved.total) : 0;
        let lastSaved = -1;

        const total = () => base + api.blocker.stats().blocked;

        // Desligado = lista vazia (assim os contadores da sessão não se perdem).
        const apply = () => {
            if (!state.enabled) {
                api.blocker.set({ domains: [], allowHosts: [], cosmetic: false });
                return;
            }
            const domains = [
                ...(state.ads ? adsList : []),
                ...(state.trackers ? trackersList : []),
                ...state.custom
            ];
            api.blocker.set({ domains, allowHosts: state.allow, cosmetic: state.cosmetic });
        };
        const save = () => {
            const t = total();
            store.set({ ...state, total: t });
            lastSaved = t;
        };
        const view = () => {
            const stats = api.blocker.stats();
            return {
                ...state,
                custom: [...state.custom],
                allow: [...state.allow],
                currentHost: api.tabs.activeHost(),
                counts: { ads: adsList.length, trackers: trackersList.length },
                blockedSession: stats.blocked,
                blockedTotal: base + stats.blocked,
                top: stats.top
            };
        };

        apply();
        const timer = setInterval(() => { if (total() !== lastSaved) save(); }, SAVE_EVERY_MS);
        if (timer.unref) timer.unref();

        return {
            methods: {
                getState: () => view(),
                setOption: ({ key, value } = {}) => {
                    if (!OPTIONS.includes(key)) throw new Error("Opção inválida.");
                    state[key] = !!value; apply(); save(); return view();
                },
                addCustom: host => {
                    const h = normHost(host);
                    if (!state.custom.includes(h)) {
                        if (state.custom.length >= MAX_CUSTOM) throw new Error("Limite de domínios atingido.");
                        state.custom.push(h);
                    }
                    apply(); save(); return view();
                },
                removeCustom: host => {
                    const h = normHost(host);
                    state.custom = state.custom.filter(x => x !== h);
                    apply(); save(); return view();
                },
                allowSite: host => {
                    const h = normHost(host);
                    if (!state.allow.includes(h)) {
                        if (state.allow.length >= MAX_ALLOW) throw new Error("Limite de sites liberados atingido.");
                        state.allow.push(h);
                    }
                    apply(); save(); return view();
                },
                blockSite: host => {
                    const h = normHost(host);
                    state.allow = state.allow.filter(x => x !== h);
                    apply(); save(); return view();
                },
                reset: () => {
                    Object.assign(state, { enabled: true, ads: true, trackers: true, cosmetic: true, custom: [], allow: [] });
                    apply(); save(); return view();
                }
            },
            deactivate() {
                clearInterval(timer);
                try { save(); } catch { /* ignora falha ao gravar */ }
                // O host remove o bloqueio e o CSS ao desativar.
            }
        };
    }
};
