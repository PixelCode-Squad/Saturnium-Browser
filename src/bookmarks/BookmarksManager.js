const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

function decodeHtml(value) {
    return value
        .replace(/&#(\d+);/g, (match, code) => {
            const point = Number(code);
            return point <= 0x10ffff ? String.fromCodePoint(point) : match;
        })
        .replace(/&#x([0-9a-f]+);/gi, (match, code) => {
            const point = parseInt(code, 16);
            return point <= 0x10ffff ? String.fromCodePoint(point) : match;
        })
        .replace(/&nbsp;/gi, "\u00a0")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function safeBookmarkUrl(value) {
    if (typeof value !== "string" || value.length > 8192) {
        return null;
    }

    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch (error) {
        return null;
    }
}

class BookmarksManager {

    constructor(userDataDirectory) {
        this.dataDirectory = userDataDirectory;
        this.bookmarksFile = path.join(userDataDirectory, "bookmarks.json");
        this.items = [];
        this.folders = [];
        this.load();
    }

    load() {
        try {
            fs.mkdirSync(this.dataDirectory, { recursive: true });

            if (!fs.existsSync(this.bookmarksFile)) {
                this.save();
                return;
            }

            const data = JSON.parse(fs.readFileSync(this.bookmarksFile, "utf8"));
            if (data && Array.isArray(data.items) && Array.isArray(data.folders)) {
                this.items = data.items.filter(item =>
                    item && typeof item.id === "string" && safeBookmarkUrl(item.url)
                );
                this.folders = data.folders.filter(folder =>
                    folder && typeof folder.id === "string" && typeof folder.name === "string"
                );
            }
        } catch (error) {
            console.error("[BookmarksManager] Erro ao carregar favoritos:", error);
            this.items = [];
            this.folders = [];
        }
    }

    save() {
        try {
            fs.mkdirSync(this.dataDirectory, { recursive: true });
            fs.writeFileSync(
                this.bookmarksFile,
                JSON.stringify({ version: 1, items: this.items, folders: this.folders }, null, 2),
                "utf8"
            );
        } catch (error) {
            console.error("[BookmarksManager] Erro ao salvar favoritos:", error);
            throw error;
        }
    }

    getAll() {
        return JSON.parse(JSON.stringify({ items: this.items, folders: this.folders }));
    }

    isBookmarked(url) {
        const safeUrl = safeBookmarkUrl(url);
        return !!safeUrl && this.items.some(item => item.url === safeUrl);
    }

    updateFavicon(url, favicon) {
        const safeUrl = safeBookmarkUrl(url);
        if (!safeUrl || typeof favicon !== "string" || !favicon || favicon.length > 8192) {
            return false;
        }

        const bookmark = this.items.find(item => item.url === safeUrl);
        if (!bookmark || bookmark.favicon === favicon) {
            return false;
        }

        bookmark.favicon = favicon;
        this.save();
        return true;
    }

    toggle(url, title, favicon = null) {
        const safeUrl = safeBookmarkUrl(url);
        if (!safeUrl) {
            throw new Error("Somente páginas HTTP ou HTTPS podem ser adicionadas aos favoritos.");
        }

        const existingIndex = this.items.findIndex(item => item.url === safeUrl);
        if (existingIndex !== -1) {
            this.items.splice(existingIndex, 1);
            this.save();
            return false;
        }

        this.items.unshift({
            id: randomUUID(),
            title: typeof title === "string" && title.trim() ? title.trim().slice(0, 500) : safeUrl,
            url: safeUrl,
            favicon: typeof favicon === "string" ? favicon.slice(0, 8192) : null,
            folderId: null,
            addedAt: Date.now()
        });
        this.save();
        return true;
    }

    createFolder(name, parentId = null) {
        const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
        if (!cleanName) {
            throw new Error("Digite um nome para a pasta.");
        }
        if (parentId !== null && !this.folders.some(folder => folder.id === parentId)) {
            throw new Error("A pasta selecionada não existe.");
        }

        const folder = { id: randomUUID(), name: cleanName, parentId };
        this.folders.push(folder);
        this.save();
        return folder;
    }

    renameFolder(id, name) {
        const folder = this.folders.find(entry => entry.id === id);
        const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
        if (!folder || !cleanName) {
            throw new Error("Pasta ou nome inválido.");
        }
        folder.name = cleanName;
        this.save();
    }

    deleteFolder(id) {
        const folder = this.folders.find(entry => entry.id === id);
        if (!folder) {
            throw new Error("A pasta selecionada não existe.");
        }

        this.items.forEach(item => {
            if (item.folderId === id) item.folderId = folder.parentId || null;
        });
        this.folders.forEach(entry => {
            if (entry.parentId === id) entry.parentId = folder.parentId || null;
        });
        this.folders = this.folders.filter(entry => entry.id !== id);
        this.save();
    }

    moveBookmark(id, folderId = null) {
        const item = this.items.find(entry => entry.id === id);
        if (!item || (folderId !== null && !this.folders.some(folder => folder.id === folderId))) {
            throw new Error("Favorito ou pasta inválido.");
        }
        item.folderId = folderId;
        this.save();
    }

    removeBookmark(id) {
        const count = this.items.length;
        this.items = this.items.filter(item => item.id !== id);
        if (this.items.length === count) {
            throw new Error("O favorito selecionado não existe.");
        }
        this.save();
    }

    importHtml(html) {
        if (typeof html !== "string" || html.length > MAX_IMPORT_SIZE) {
            throw new Error("O arquivo de favoritos é inválido ou excede 10 MB.");
        }

        const stack = [null];
        let pendingFolder = null;
        const tokenPattern = /<H3\b[^>]*>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>|<\/DL\s*>|<DL\b[^>]*>/gi;
        let match;
        let imported = 0;

        while ((match = tokenPattern.exec(html))) {
            if (match[1] !== undefined) {
                const name = decodeHtml(match[1].replace(/<[^>]*>/g, "")).trim().slice(0, 100);
                if (name) {
                    const folder = {
                        id: randomUUID(),
                        name,
                        parentId: stack[stack.length - 1]
                    };
                    this.folders.push(folder);
                    pendingFolder = folder.id;
                }
            } else if (match[2] !== undefined) {
                const hrefMatch = match[2].match(/\bHREF\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
                const rawUrl = hrefMatch && (hrefMatch[1] || hrefMatch[2] || hrefMatch[3]);
                const url = safeBookmarkUrl(rawUrl && decodeHtml(rawUrl));
                if (url) {
                    this.items.push({
                        id: randomUUID(),
                        title: decodeHtml(match[3].replace(/<[^>]*>/g, "")).trim().slice(0, 500) || url,
                        url,
                        favicon: null,
                        folderId: stack[stack.length - 1],
                        addedAt: Date.now()
                    });
                    imported++;
                }
            } else if (match[0].startsWith("</")) {
                if (stack.length > 1) stack.pop();
            } else {
                stack.push(pendingFolder || stack[stack.length - 1]);
                pendingFolder = null;
            }
        }

        this.save();
        return imported;
    }

    exportHtml() {
        const renderFolder = (parentId) => {
            const folders = this.folders.filter(folder => folder.parentId === parentId);
            const items = this.items.filter(item => (item.folderId || null) === parentId);
            const folderMarkup = folders.map(folder =>
                `<DT><H3>${escapeHtml(folder.name)}</H3>\n<DL><p>\n${renderFolder(folder.id)}</DL><p>`
            );
            const itemMarkup = items.map(item =>
                `<DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.title)}</A>`
            );
            return [...folderMarkup, ...itemMarkup].join("\n");
        };

        return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Favoritos</TITLE>
<H1>Favoritos</H1>
<DL><p>
${renderFolder(null)}
</DL><p>
`;
    }
}

module.exports = BookmarksManager;
