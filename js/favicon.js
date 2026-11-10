const CACHE_KEY = 'tabaq-favicon-cache';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

let cache = {};
let saveTimer = null;

export async function loadFaviconCache() {
    try {
        cache = (await browser.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
    } catch {
        cache = {};
    }
}

function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        browser.storage.local.set({ [CACHE_KEY]: cache }).catch(() => {});
    }, 1000);
}

function remember(host, url) {
    const prev = cache[host];
    if (prev && prev.url === url && Date.now() - prev.ts < MAX_AGE) return;
    cache[host] = { url, ts: Date.now() };
    persist();
}

function letter(box, title) {
    box.textContent = (title || '?').trim().slice(0, 1).toUpperCase();
}

export function fillFavicon(box, url, title) {
    let u;
    try { u = new URL(url); } catch { letter(box, title); return; }
    if (!/^https?:$/.test(u.protocol)) { letter(box, title); return; }
    const host = u.hostname;
    const candidates = [`${u.origin}/favicon.ico`, `https://icons.duckduckgo.com/ip3/${host}.ico`];
    const entry = cache[host];
    const fresh = entry && Date.now() - entry.ts < MAX_AGE;
    if (fresh && entry.url === null) { letter(box, title); return; }
    const order = fresh && entry.url ? [entry.url, ...candidates.filter(c => c !== entry.url)] : candidates;
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    let i = 0;
    img.onload = () => {
        if (img.naturalWidth <= 1) { img.onerror(); return; }
        remember(host, order[i]);
    };
    img.onerror = () => {
        i++;
        if (i < order.length) { img.src = order[i]; return; }
        remember(host, null);
        img.remove();
        letter(box, title);
    };
    img.src = order[0];
    box.replaceChildren(img);
}
