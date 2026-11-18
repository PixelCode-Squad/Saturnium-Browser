// =====================================================
// PerformanceManager
//
// Mede o uso de RAM e CPU do navegador e aplica os limites
// escolhidos pelo usuário:
//
//  - Suspende (libera da memória) abas em segundo plano
//    paradas há muito tempo.
//  - Limite de RAM: ao passar do teto, suspende as abas
//    menos usadas recentemente até voltar abaixo dele.
//  - Limite de CPU: ao passar do teto, rebaixa a prioridade
//    das abas em segundo plano e, se o excesso persistir,
//    suspende a aba de fundo que mais consome.
//  - Prioridade: abas em segundo plano rodam com prioridade
//    menor no sistema operacional.
//
// Honestidade técnica: o sistema operacional não permite
// "travar" um processo em X% de CPU ou X MB. Os limites aqui
// são METAS — o navegador reage quando elas são ultrapassadas
// agindo sobre as abas em segundo plano. A aba que você está
// usando nunca é suspensa nem rebaixada.
// =====================================================

const os = require("os");
const Settings = require("./PerformanceSettings");

const DEFAULT_INTERVAL_MS = 5000;
const CPU_WINDOW = 3;             // amostras usadas na média de CPU
const CPU_OVER_TICKS_TO_ACT = 3;  // ticks seguidos acima do limite antes de suspender
const MIN_TAB_CPU_PERCENT = 2;    // só suspende por CPU abas que usam pelo menos isso (% do computador)
const RAM_TARGET_FACTOR = 0.92;   // ao agir, mira ficar 8% abaixo do limite
const RAM_COOLDOWN_MS = 8000;     // a memória demora para ser devolvida; evita suspender em cascata
const MAX_RAM_SUSPENDS_PER_TICK = 3;
const MAX_IDLE_SUSPENDS_PER_TICK = 5;
const LOG_SIZE = 20;

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

class PerformanceManager {

    constructor({ app, tabManager, settingsFile, startupApplied, osModule, now, intervalMs } = {}) {
        this.app = app;
        this.tabManager = tabManager;
        this.os = osModule || os;
        this.now = now || Date.now;
        this.intervalMs = intervalMs || DEFAULT_INTERVAL_MS;
        this.settingsFile = settingsFile;
        this.settings = settingsFile ? Settings.load(settingsFile) : { ...Settings.DEFAULTS };
        this.startupApplied = startupApplied || require("./startupFlags").getApplied();

        this.timer = null;
        this.priorityTimer = null;
        this.priorities = new Map();   // pid -> prioridade aplicada
        this.cpuSamples = [];
        this.cpuOverTicks = 0;
        this.cpuGuardActive = false;
        this.ramCooldownUntil = 0;
        this.sample = null;            // último resultado de medição
        this.note = "";
        this.log = [];
        this.savedMB = 0;              // RAM estimada liberada desde que o navegador abriu
        this.suspendedTotal = 0;
    }

    // =====================================
    // CICLO DE VIDA
    // =====================================

    start() {
        if (this.timer) return;
        this.tick();
        this.timer = setInterval(() => this.tick(), this.intervalMs);
        if (this.timer.unref) this.timer.unref();
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.priorityTimer) clearTimeout(this.priorityTimer);
        this.timer = null;
        this.priorityTimer = null;
        this.restorePriorities();
    }

    // =====================================
    // CONFIGURAÇÕES
    // =====================================

    getSettings() { return { ...this.settings }; }

    update(patch) {
        this.settings = Settings.sanitize(patch, this.settings);
        this.persist();
        this.onSettingsChanged();
        return this.getStatus();
    }

    applyProfile(name) {
        const p = Settings.profileSettings(name, this.totalMemMB());
        if (!p) throw new Error("Perfil inválido.");
        return this.update(p);
    }

    persist() {
        if (!this.settingsFile) return;
        try { Settings.save(this.settingsFile, this.settings); }
        catch (error) { console.error("[Performance] Falha ao salvar configurações:", error.message); }
    }

    onSettingsChanged() {
        this.cpuOverTicks = 0;
        this.cpuGuardActive = false;
        this.note = "";
        if (!this.settings.enabled) this.restorePriorities();
        else this.refreshPriorities();
    }

    restartRequired() {
        return Settings.STARTUP_KEYS.some(k => this.settings[k] !== this.startupApplied[k]);
    }

    totalMemMB() { return Math.round(this.os.totalmem() / 1048576); }

    // =====================================
    // MEDIÇÃO
    //
    // Só este método chama app.getAppMetrics(): o Electron calcula a
    // CPU "desde a última chamada", então chamadas extras (como a da
    // página de configurações) bagunçariam as amostras.
    // =====================================

    measure() {
        const cores = Math.max(1, (this.os.cpus() || []).length);
        let metrics = [];
        try { metrics = this.app.getAppMetrics() || []; } catch { /* sem métricas neste tick */ }

        const byPid = new Map();
        let ramKB = 0;
        let cpuRaw = 0;
        for (const m of metrics) {
            const mem = m.memory || {};
            const kb = Number.isFinite(mem.privateBytes) && mem.privateBytes > 0 ? mem.privateBytes : (mem.workingSetSize || 0);
            const cpu = (m.cpu && Number(m.cpu.percentCPUUsage)) || 0;
            ramKB += kb;
            cpuRaw += cpu;
            byPid.set(m.pid, { kb, cpu, type: m.type });
        }

        // Abas -> processos. Abas que dividem o mesmo processo dividem também o consumo.
        const tabPid = new Map();
        const pidCount = new Map();
        for (const tab of this.tabManager.tabs) {
            const wc = tab.view && tab.view.webContents;
            let pid = 0;
            try { pid = wc && !wc.isDestroyed() ? wc.getOSProcessId() : 0; } catch { pid = 0; }
            if (pid) {
                tabPid.set(tab.id, pid);
                pidCount.set(pid, (pidCount.get(pid) || 0) + 1);
            }
        }
        const perTab = new Map();
        let tabsRamKB = 0;
        for (const [id, pid] of tabPid) {
            const p = byPid.get(pid);
            if (!p) continue;
            const share = pidCount.get(pid) || 1;
            perTab.set(id, { ramMB: p.kb / 1024 / share, cpu: p.cpu / cores / share, pid });
            tabsRamKB += p.kb / share;
        }

        const cpuPercent = Math.min(100, cpuRaw / cores);
        this.cpuSamples.push(cpuPercent);
        if (this.cpuSamples.length > CPU_WINDOW) this.cpuSamples.shift();
        const cpuAvg = this.cpuSamples.reduce((a, b) => a + b, 0) / this.cpuSamples.length;

        // Esquece prioridades de processos que não existem mais.
        for (const pid of this.priorities.keys()) if (!byPid.has(pid)) this.priorities.delete(pid);

        this.sample = {
            at: this.now(),
            ramMB: ramKB / 1024,
            baseMB: Math.max(0, (ramKB - tabsRamKB) / 1024),
            cpuPercent,
            cpuAvg,
            processCount: metrics.length,
            perTab,
            cores
        };
        return this.sample;
    }

    // =====================================
    // PROTEÇÕES
    // =====================================

    // Retorna o motivo pelo qual a aba não pode ser suspensa, ou null se pode.
    protectionReason(tab) {
        if (tab.id === this.tabManager.activeTabId) return "aba ativa";
        if (tab.discarded) return "já suspensa";
        if (tab.internal) return "página interna";
        if (!tab.view) return "sem página";
        if (tab.loading) return "carregando";
        if (this.settings.protectPinned && tab.pinned) return "fixada";
        if (!/^https?:\/\//i.test(tab.url || "")) return "página interna";
        try {
            const wc = tab.view.webContents;
            if (wc.isDestroyed()) return "sem página";
            if (wc.isCurrentlyAudible()) return "tocando áudio";
        } catch { return "sem página"; }
        return null;
    }

    suspend(tab, reason) {
        const info = this.sample && this.sample.perTab.get(tab.id);
        const ramMB = info ? info.ramMB : 0;
        const title = tab.title || hostOf(tab.url) || "aba";
        if (!this.tabManager.discardTab(tab.id)) return false;
        this.savedMB += ramMB;
        this.suspendedTotal++;
        this.record(`Suspendeu “${title.slice(0, 40)}” (${reason})${ramMB ? ` — ~${Math.round(ramMB)} MB` : ""}`);
        return true;
    }

    record(text) {
        this.log.unshift({ at: this.now(), text });
        if (this.log.length > LOG_SIZE) this.log.pop();
    }

    // =====================================
    // CICLO PRINCIPAL
    // =====================================

    tick() {
        let s;
        try { s = this.measure(); } catch (error) { console.error("[Performance] Falha ao medir:", error.message); return; }
        if (!this.settings.enabled) return;
        try {
            this.note = "";
            this.suspendIdle();
            this.guardRam(s);
            this.guardCpu(s);
            this.refreshPriorities();
        } catch (error) {
            console.error("[Performance] Falha ao aplicar limites:", error.message);
        }
    }

    // ---------- suspensão por inatividade ----------

    suspendIdle() {
        const minutes = this.settings.autoSuspendMinutes;
        if (!minutes) return;
        const limitMs = minutes * 60000;
        const now = this.now();
        let count = 0;
        for (const tab of [...this.tabManager.tabs]) {
            if (count >= MAX_IDLE_SUSPENDS_PER_TICK) break;
            if (this.protectionReason(tab)) continue;
            const idle = now - (tab.lastActiveAt || now);
            if (idle < limitMs) continue;
            if (this.suspend(tab, `inativa há ${Math.round(idle / 60000)} min`)) count++;
        }
    }

    // ---------- limite de RAM ----------

    guardRam(s) {
        const limit = this.settings.ramLimitMB;
        if (!limit || s.ramMB <= limit) return;
        if (this.now() < this.ramCooldownUntil) return;

        const candidates = this.tabManager.tabs
            .filter(tab => !this.protectionReason(tab))
            .sort((a, b) => (a.lastActiveAt || 0) - (b.lastActiveAt || 0)); // menos usadas primeiro

        if (!candidates.length) {
            this.note = `A RAM (${Math.round(s.ramMB)} MB) passou do limite, mas só restam a aba ativa e abas protegidas. ` +
                `O navegador sozinho usa cerca de ${Math.round(s.baseMB)} MB.`;
            return;
        }

        let estimated = s.ramMB;
        let count = 0;
        for (const tab of candidates) {
            if (estimated <= limit * RAM_TARGET_FACTOR || count >= MAX_RAM_SUSPENDS_PER_TICK) break;
            const info = s.perTab.get(tab.id);
            if (this.suspend(tab, "limite de RAM")) {
                estimated -= info ? info.ramMB : 0;
                count++;
            }
        }
        if (count) this.ramCooldownUntil = this.now() + RAM_COOLDOWN_MS;
    }

    // ---------- limite de CPU ----------

    guardCpu(s) {
        const limit = this.settings.cpuLimitPercent;
        if (!limit) { this.cpuOverTicks = 0; this.cpuGuardActive = false; return; }

        if (s.cpuAvg > limit) this.cpuOverTicks++;
        else this.cpuOverTicks = Math.max(0, this.cpuOverTicks - 1);

        // 1º passo (imediato): prioridade mínima para tudo que está em segundo plano.
        this.cpuGuardActive = this.cpuOverTicks >= 1;
        if (this.cpuOverTicks < CPU_OVER_TICKS_TO_ACT) return;

        // 2º passo: o excesso persiste — suspende a aba de fundo que mais consome.
        const heavy = this.tabManager.tabs
            .filter(tab => !this.protectionReason(tab))
            .map(tab => ({ tab, cpu: (s.perTab.get(tab.id) || {}).cpu || 0 }))
            .filter(x => x.cpu >= MIN_TAB_CPU_PERCENT)
            .sort((a, b) => b.cpu - a.cpu)[0];

        if (heavy) {
            this.suspend(heavy.tab, `limite de CPU — ${Math.round(heavy.cpu)}% do computador`);
            this.cpuOverTicks = 1;
        } else {
            this.note = `A CPU (${Math.round(s.cpuAvg)}%) está acima do limite, mas nenhuma aba em segundo plano pode ser ` +
                "reduzida. O consumo vem da aba ativa ou de processos do navegador.";
        }
    }

    // =====================================
    // PRIORIDADE DOS PROCESSOS
    // =====================================

    // Chamado pelo TabManager quando o usuário troca de aba: devolve prioridade
    // normal à aba nova na hora, sem esperar o próximo ciclo.
    onTabActivated() {
        this.refreshPriorities();
        if (this.priorityTimer) clearTimeout(this.priorityTimer);
        // Abas recém-acordadas ganham um processo novo; ajusta de novo depois que ele existe.
        this.priorityTimer = setTimeout(() => this.refreshPriorities(), 1500);
        if (this.priorityTimer.unref) this.priorityTimer.unref();
    }

    refreshPriorities() {
        if (!this.settings.enabled) return;
        const C = this.os.constants.priority;
        const lowerBg = this.settings.lowerBackgroundPriority;
        const desired = new Map(); // pid -> prioridade

        // A aba ativa (e quem divide processo com ela) tem sempre prioridade normal.
        for (const tab of this.tabManager.tabs) {
            const pid = this.pidOf(tab);
            if (!pid) continue;
            const active = tab.id === this.tabManager.activeTabId;
            let audible = false;
            try { audible = tab.view.webContents.isCurrentlyAudible(); } catch { /* ignora */ }
            let level;
            if (active || audible || tab.internal) level = C.PRIORITY_NORMAL;
            else if (this.cpuGuardActive) level = C.PRIORITY_LOW;
            else if (lowerBg) level = C.PRIORITY_BELOW_NORMAL;
            else level = C.PRIORITY_NORMAL;

            const prev = desired.get(pid);
            if (prev === undefined || level === C.PRIORITY_NORMAL) desired.set(pid, level);
        }
        for (const [pid, level] of desired) this.setPriority(pid, level);
    }

    pidOf(tab) {
        try {
            const wc = tab.view && tab.view.webContents;
            return wc && !wc.isDestroyed() ? wc.getOSProcessId() : 0;
        } catch { return 0; }
    }

    setPriority(pid, level) {
        if (this.priorities.get(pid) === level) return;
        this.priorities.set(pid, level); // mesmo em caso de erro, não insiste a cada ciclo
        try { this.os.setPriority(pid, level); } catch { /* sem permissão ou processo já encerrado */ }
    }

    restorePriorities() {
        const normal = this.os.constants.priority.PRIORITY_NORMAL;
        for (const [pid, level] of this.priorities) {
            if (level === normal) continue;
            try { this.os.setPriority(pid, normal); } catch { /* processo já encerrado */ }
        }
        this.priorities.clear();
    }

    // =====================================
    // AÇÕES MANUAIS (página de desempenho)
    // =====================================

    suspendTab(id) {
        const tab = this.tabManager.tabs.find(t => t.id === id);
        if (!tab) throw new Error("Aba não encontrada.");
        const reason = this.protectionReason(tab);
        if (reason) throw new Error(`Não é possível suspender esta aba (${reason}).`);
        this.suspend(tab, "manual");
        return this.getStatus();
    }

    suspendBackground() {
        let count = 0;
        for (const tab of [...this.tabManager.tabs]) {
            if (!this.protectionReason(tab) && this.suspend(tab, "manual")) count++;
        }
        if (!count) this.record("Nenhuma aba em segundo plano podia ser suspensa.");
        return this.getStatus();
    }

    // =====================================
    // STATUS PARA A INTERFACE
    // =====================================

    getStatus() {
        const s = this.sample;
        const now = this.now();
        const totalMem = this.totalMemMB();
        const tabs = [];
        for (const tab of this.tabManager.tabs) {
            if (tab.internal && !tab.discarded) continue;
            const info = s && s.perTab.get(tab.id);
            const active = tab.id === this.tabManager.activeTabId;
            const reason = this.protectionReason(tab);
            tabs.push({
                id: tab.id,
                title: String(tab.title || "").slice(0, 80),
                host: hostOf(tab.url),
                state: tab.discarded ? "suspended" : (active ? "active" : "background"),
                pinned: !!tab.pinned,
                ramMB: info ? Math.round(info.ramMB) : 0,
                cpuPercent: info ? Math.round(info.cpu * 10) / 10 : 0,
                idleMinutes: active || !tab.lastActiveAt ? 0 : Math.floor((now - tab.lastActiveAt) / 60000),
                canSuspend: !reason,
                protectedReason: reason
            });
        }
        tabs.sort((a, b) => b.ramMB - a.ramMB);

        const profile = Settings.detectProfile(this.settings, totalMem);
        return {
            settings: { ...this.settings },
            limits: Settings.LIMITS,
            profile,
            restartRequired: this.restartRequired(),
            system: { totalMemMB: totalMem, freeMemMB: Math.round(this.os.freemem() / 1048576), cores: s ? s.cores : (this.os.cpus() || []).length },
            usage: s ? {
                ramMB: Math.round(s.ramMB),
                baseMB: Math.round(s.baseMB),
                cpuPercent: Math.round(s.cpuPercent * 10) / 10,
                cpuAvg: Math.round(s.cpuAvg * 10) / 10,
                processCount: s.processCount,
                updatedAt: s.at
            } : null,
            guard: {
                cpuGuardActive: this.cpuGuardActive,
                note: this.note,
                savedMB: Math.round(this.savedMB),
                suspendedTotal: this.suspendedTotal,
                log: this.log.map(l => ({ at: l.at, text: l.text }))
            },
            tabs
        };
    }
}

module.exports = PerformanceManager;
