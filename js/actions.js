import { store, save, currentDesk, freeCell, fits, newKey, desktops } from './store.js';
import { mark, pathOf, folders, folderLabel, saveFolder, createMark, findByUrl, removeMark, renameMark, relinkMark, descendants } from './marks.js';
import { toast, confirmBox, formBox, closeOverlays } from './ui.js';
import { WIDGETS } from './widgets.js';
import { render } from './bus.js';

export function flash(k) {
    requestAnimationFrame(() => {
        const n = document.querySelector(`.page.current [data-k="${k}"] > *`);
        n?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 400 });
    });
}

export function place(ref, at) {
    const items = currentDesk();
    const have = items.find(o => o.ref === ref);
    const m = mark(ref);
    if (!m) return;
    if (have) { toast(`「${m.title}」はこのデスクトップにもう置いてあります`); flash(have.k); return; }
    const it = { k: newKey('i'), ref };
    const spot = at && fits(items, it, at.c, at.r) ? at : freeCell(items, it);
    if (!spot) { toast('空いている升目がありません'); return; }
    Object.assign(it, spot);
    items.push(it);
    save(); render(); flash(it.k);
    toast(`「${m.title}」を置きました`);
}

export function placeWidget(kind, data, at) {
    const def = WIDGETS[kind];
    const items = currentDesk();
    const it = { k: newKey('w'), widget: kind, w: def.w, h: def.h };
    if (data) it.data = data;
    const spot = at && fits(items, it, at.c, at.r) ? at : freeCell(items, it);
    if (!spot) { toast(`${def.label}のウィジェットの入る空きがありません`); return; }
    Object.assign(it, spot);
    items.push(it);
    save(); render(); flash(it.k);
}

export function unplace(k) {
    const items = currentDesk();
    const i = items.findIndex(o => o.k === k);
    if (i < 0) return;
    const [it] = items.splice(i, 1);
    save(); render();
    if (it.widget) toast(`${WIDGETS[it.widget]?.label || ''}のウィジェットを外しました`);
    else toast(`「${mark(it.ref)?.title || ''}」をデスクトップから外しました（ブックマークは残っています）`);
}

export async function deleteMark(id) {
    const m = mark(id);
    if (!m) return;
    const placed = store.layout.desktops.some(d => d.items.some(o => o.ref === id));
    const ok = await confirmBox({
        title: `「${m.title}」をブックマークから削除します`,
        message: (m.folder ? 'フォルダの中のブックマークもまとめて削除します。' : '') + `Firefox のブックマーク（${pathOf(id) || 'いちばん上'}）から消えます。` + (placed ? 'デスクトップに置いてあるアイコンも消えます。' : ''),
        ok: '削除する',
        danger: true
    });
    if (!ok) return;
    const gone = descendants(id);
    await removeMark(id);
    for (const d of store.layout.desktops) d.items = d.items.filter(o => !o.ref || !gone.has(o.ref));
    closeOverlays();
    save(); render();
    toast(`「${m.title}」をブックマークから削除しました`);
}

export async function rename(id) {
    const m = mark(id);
    const got = await formBox({ title: '名前を変える', ok: '変える', fields: [{ name: 'title', label: '名前', value: m.title }] });
    if (!got || !got.title) return;
    await renameMark(id, got.title);
    render();
}

export async function relink(id) {
    const m = mark(id);
    const got = await formBox({ title: 'URL を変える', ok: '変える', fields: [{ name: 'url', label: 'URL', value: m.url }] });
    if (!got || !/^https?:\/\//.test(got.url)) return;
    await relinkMark(id, got.url);
    render();
}

function folderOptions() {
    return folders().map(f => ({ value: f.id, label: folderLabel(f.id) })).sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

export async function newBookmark(url, at) {
    const saveTo = await saveFolder(store.settings.saveTo);
    if (store.settings.saveTo !== saveTo) { store.settings.saveTo = saveTo; save(); }
    const got = await formBox({
        title: '新しいブックマーク',
        ok: '作って置く',
        fields: [
            { name: 'title', label: '名前', value: '', placeholder: '空ならサイトの名前' },
            { name: 'url', label: 'URL', value: url || '', placeholder: 'https://…' },
            { name: 'folder', label: '保存先', value: saveTo, options: folderOptions(), note: '既定の保存先は設定で変えられます' }
        ]
    });
    if (!got) return;
    if (!/^https?:\/\//.test(got.url)) { toast('URL は https:// から入れてください'); return; }
    const title = got.title || hostOf(got.url);
    const id = await createMark(got.folder, title, got.url);
    place(id, at);
}

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export async function quickAdd(url, at, title) {
    const have = findByUrl(url);
    if (have) { place(have.id, at); return; }
    const saveTo = await saveFolder(store.settings.saveTo);
    if (store.settings.saveTo !== saveTo) { store.settings.saveTo = saveTo; save(); }
    const id = await createMark(saveTo, title || hostOf(url), url);
    place(id, at);
    toast(`「${folderLabel(saveTo)}」に保存して置きました`);
}

export async function editLink(it) {
    const got = await formBox({
        title: it.data?.url ? 'リンクを変える' : '新しいリンクのウィジェット',
        ok: it.data?.url ? '変える' : '置く',
        fields: [
            { name: 'title', label: '名前', value: it.data?.title || '', placeholder: '空ならサイトの名前' },
            { name: 'url', label: 'URL', value: it.data?.url || '', placeholder: 'https://…', note: 'リンクのウィジェットは TABaq の中だけのもので、Firefox のブックマークには入りません' }
        ]
    });
    if (!got) return null;
    if (!/^https?:\/\//.test(got.url)) { toast('URL は https:// から入れてください'); return null; }
    return { title: got.title || hostOf(got.url), url: got.url };
}

export async function addLinkWidget(at) {
    const data = await editLink({});
    if (data) placeWidget('link', data, at);
}

export function openUrl(url, how) {
    if (how === 'tab') browser.tabs.create({ url, active: true });
    else if (how === 'back') browser.tabs.create({ url, active: false });
    else if (how === 'window') browser.windows.create({ url });
    else browser.tabs.update({ url });
}

export function prune() {
    let changed = false;
    for (const d of store.layout.desktops) {
        const before = d.items.length;
        d.items = d.items.filter(o => !o.ref || mark(o.ref));
        if (d.items.length !== before) changed = true;
    }
    if (changed) save();
}

export function goPage(i) {
    const n = desktops().length;
    store.page = Math.max(0, Math.min(i, n - 1));
    render();
}
