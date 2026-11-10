const OTHER = 'unfiled_____';

const nodes = new Map();
const listeners = new Set();

export function onMarksChange(fn) { listeners.add(fn); }

function walk(node, parentId) {
    nodes.set(node.id, { id: node.id, title: node.title, url: node.url, parentId, folder: !node.url && node.type !== 'separator', separator: node.type === 'separator', index: node.index });
    for (const child of node.children || []) walk(child, node.id);
}

export async function loadMarks() {
    nodes.clear();
    const [root] = await browser.bookmarks.getTree();
    walk(root, null);
}

let timer = null;
function refresh() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        await loadMarks();
        for (const fn of listeners) fn();
    }, 80);
}
for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) browser.bookmarks[ev].addListener(refresh);

export function mark(id) { return nodes.get(id); }

export function childrenOf(id) {
    return [...nodes.values()].filter(n => n.parentId === id && !n.separator).sort((a, b) => a.index - b.index);
}

export function pathOf(id) {
    const out = [];
    let n = nodes.get(id);
    n = n && nodes.get(n.parentId);
    while (n && n.parentId) { out.unshift(n.title); n = nodes.get(n.parentId); }
    return out.join(' › ');
}

export function allMarks() {
    return [...nodes.values()].filter(n => n.parentId && !n.separator);
}

export function folders() {
    return [...nodes.values()].filter(n => n.folder && n.parentId);
}

export function folderLabel(id) {
    const p = pathOf(id);
    const n = nodes.get(id);
    return p ? p + ' › ' + n.title : n.title;
}

export async function saveFolder(saveTo) {
    if (saveTo && nodes.has(saveTo)) return saveTo;
    const existing = childrenOf(OTHER).find(n => n.folder && n.title === 'TABaq');
    if (existing) return existing.id;
    const made = await browser.bookmarks.create({ parentId: OTHER, title: 'TABaq' });
    await loadMarks();
    return made.id;
}

export async function createMark(parentId, title, url) {
    const made = await browser.bookmarks.create({ parentId, title, url });
    await loadMarks();
    return made.id;
}

export function findByUrl(url) {
    return [...nodes.values()].find(n => n.url === url) || null;
}

export async function removeMark(id) {
    const n = nodes.get(id);
    if (!n) return;
    if (n.folder) await browser.bookmarks.removeTree(id);
    else await browser.bookmarks.remove(id);
    await loadMarks();
}

export async function renameMark(id, title) {
    await browser.bookmarks.update(id, { title });
    await loadMarks();
}

export async function relinkMark(id, url) {
    await browser.bookmarks.update(id, { url });
    await loadMarks();
}

export function descendants(id) {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const n of nodes.values()) if (out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; }
    }
    return out;
}
