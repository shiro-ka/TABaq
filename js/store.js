const LAYOUT_KEY = 'tabaq-layout';
const SETTINGS_KEY = 'tabaq-settings';
const WALLPAPER_KEY = 'tabaq-wallpaper';

export const COLS = 10;
export const ROWS = 6;

export const WALLS = [
    { key: 'navy', color: '#1b2230', light: false },
    { key: 'forest', color: '#2d3b33', light: false },
    { key: 'paper', color: '#e9e4da', light: true }
];

export const store = {
    layout: null,
    settings: null,
    wallpaper: null,
    page: 0
};

const listeners = new Set();
export function onStoreChange(fn) { listeners.add(fn); }
function notify() { for (const fn of listeners) fn(); }

let seq = Date.now();
export function newKey(prefix) { return prefix + (seq++).toString(36); }

function firstLayout() {
    return {
        v: 1,
        desktops: [{
            items: [
                { k: newKey('w'), widget: 'link', c: 0, r: 0, w: 2, h: 1, data: { title: 'TABaq (GitHub)', url: 'https://github.com/shiro-ka/TABaq' } },
                { k: newKey('w'), widget: 'link', c: 0, r: 1, w: 2, h: 1, data: { title: 'TABaq issue窓', url: 'https://mado.blue/@ffffffflower.bsky.social/tabaq' } },
                { k: newKey('w'), widget: 'clock', c: 7, r: 0, w: 3, h: 2 }
            ]
        }]
    };
}

function firstSettings() {
    return { multi: false, saveTo: null, wall: 'navy', font: '' };
}

export async function loadStore() {
    const got = await browser.storage.local.get([LAYOUT_KEY, SETTINGS_KEY, WALLPAPER_KEY]);
    store.layout = got[LAYOUT_KEY] || firstLayout();
    store.settings = { ...firstSettings(), ...(got[SETTINGS_KEY] || {}) };
    store.wallpaper = got[WALLPAPER_KEY] || null;
    if (!got[LAYOUT_KEY]) await saveNow();
}

let saveTimer = null;
let writing = false;
async function saveNow() {
    writing = true;
    try {
        await browser.storage.local.set({ [LAYOUT_KEY]: store.layout, [SETTINGS_KEY]: store.settings });
    } finally {
        setTimeout(() => { writing = false; }, 50);
    }
}
export function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
}

export async function setWallpaper(dataUrl) {
    store.wallpaper = dataUrl;
    writing = true;
    try {
        if (dataUrl) await browser.storage.local.set({ [WALLPAPER_KEY]: dataUrl });
        else await browser.storage.local.remove(WALLPAPER_KEY);
    } finally {
        setTimeout(() => { writing = false; }, 50);
    }
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || writing) return;
    let changed = false;
    if (changes[LAYOUT_KEY]?.newValue) { store.layout = changes[LAYOUT_KEY].newValue; changed = true; }
    if (changes[SETTINGS_KEY]?.newValue) { store.settings = { ...firstSettings(), ...changes[SETTINGS_KEY].newValue }; changed = true; }
    if (WALLPAPER_KEY in changes) { store.wallpaper = changes[WALLPAPER_KEY].newValue || null; changed = true; }
    if (changed) notify();
});

export function desktops() {
    return store.settings.multi ? store.layout.desktops : [store.layout.desktops[0]];
}

export function currentDesk() {
    return desktops()[Math.min(store.page, desktops().length - 1)].items;
}

export function size(it) { return { w: it.w || 1, h: it.h || 1 }; }

export function fits(items, it, c, r, ignore) {
    const { w, h } = size(it);
    if (c < 0 || r < 0 || c + w > COLS || r + h > ROWS) return false;
    return !items.some(o => o !== it && o !== ignore && c < o.c + size(o).w && o.c < c + w && r < o.r + size(o).h && o.r < r + h);
}

export function freeCell(items, it) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (fits(items, it, c, r)) return { c, r };
    return null;
}
