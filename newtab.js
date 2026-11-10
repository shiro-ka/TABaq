import { store, loadStore, save, desktops, currentDesk, size, fits, COLS, ROWS, onStoreChange } from './js/store.js';
import { loadMarks, mark, onMarksChange } from './js/marks.js';
import { loadFaviconCache } from './js/favicon.js';
import { el, button, menu, toast } from './js/ui.js';
import { iconNode } from './js/icons.js';
import { widgetNode, WIDGETS } from './js/widgets.js';
import { openFolder } from './js/folder.js';
import { openDrawer, renderDrawer } from './js/drawer.js';
import { openSettings, applyLook } from './js/settings.js';
import { setRender } from './js/bus.js';
import { place, placeWidget, unplace, deleteMark, rename, relink, newBookmark, quickAdd, editLink, addLinkWidget, openUrl, prune, goPage } from './js/actions.js';

const pagesEl = document.querySelector('.pages');
const track = document.querySelector('.track');
const dotsEl = document.querySelector('.dots');

function cellPx() {
    const w = pagesEl.clientWidth;
    const h = pagesEl.clientHeight;
    return Math.max(48, Math.min(120, Math.floor(Math.min(w / COLS, h / ROWS))));
}

function render() {
    prune();
    const cell = cellPx();
    const root = document.documentElement;
    root.style.setProperty('--cell', cell + 'px');
    root.style.setProperty('--cols', COLS);
    root.style.setProperty('--rows', ROWS);
    applyLook();
    const desks = desktops();
    if (store.page >= desks.length) store.page = desks.length - 1;
    track.replaceChildren(...desks.map((desk, pi) => {
        const page = el('div', 'page' + (pi === store.page ? ' current' : ''));
        const grid = el('div', 'grid');
        for (const it of desk.items) {
            if (it.ref && !mark(it.ref)) continue;
            const s = size(it);
            const node = el('div', 'item');
            node.dataset.k = it.k;
            node.style.left = it.c * cell + 'px';
            node.style.top = it.r * cell + 'px';
            node.style.width = s.w * cell + 'px';
            node.style.height = s.h * cell + 'px';
            node.append(it.widget ? widgetNode(it) : iconNode(it.ref));
            grid.append(node);
        }
        page.append(grid);
        return page;
    }));
    track.style.transform = `translateX(${-store.page * 100}%)`;
    dotsEl.replaceChildren();
    if (store.settings.multi) {
        desks.forEach((_, i) => {
            const d = button('dot', null, () => goPage(i));
            d.setAttribute('aria-label', `デスクトップ ${i + 1}`);
            d.setAttribute('aria-current', String(i === store.page));
            dotsEl.append(d);
        });
        const add = button('dot-add', '+', () => {
            store.layout.desktops.push({ items: [] });
            save();
            goPage(store.layout.desktops.length - 1);
            toast('空のデスクトップを足しました');
        });
        add.setAttribute('aria-label', 'デスクトップを足す');
        dotsEl.append(add);
    }
    renderDrawer();
}
setRender(render);

function currentGrid() { return document.querySelector('.page.current .grid'); }
function cellAt(x, y) {
    const r = currentGrid().getBoundingClientRect();
    const cell = cellPx();
    return { c: Math.floor((x - r.left) / cell), r: Math.floor((y - r.top) / cell) };
}
function itemOf(node) { return currentDesk().find(o => o.k === node.dataset.k); }

function itemMenu(x, y, it) {
    if (it.widget) {
        const entries = [{ head: `${WIDGETS[it.widget]?.label || ''}のウィジェット` }];
        if (it.widget === 'link') {
            entries.push({ label: '開く', run: () => openUrl(it.data.url) }, { label: '新しいタブで開く', run: () => openUrl(it.data.url, 'tab') }, '-');
            entries.push({ label: 'リンクを変える…', run: async () => { const d = await editLink(it); if (d) { it.data = d; save(); render(); } } });
        }
        entries.push({ label: 'デスクトップから外す', run: () => unplace(it.k) });
        menu(x, y, entries);
        return;
    }
    const m = mark(it.ref);
    const entries = [{ head: m.folder ? 'フォルダ' : m.url }];
    if (m.folder) entries.push({ label: '開く', run: () => openFolder(it.ref) });
    else entries.push({ label: '開く', run: () => openUrl(m.url) }, { label: '新しいタブで開く', run: () => openUrl(m.url, 'tab') }, { label: '新しいウィンドウで開く', run: () => openUrl(m.url, 'window') });
    entries.push('-', { label: '名前を変える…', run: () => rename(it.ref) });
    if (!m.folder) entries.push({ label: 'URL を変える…', run: () => relink(it.ref) });
    entries.push('-', { label: 'デスクトップから外す', run: () => unplace(it.k) }, { label: 'ブックマークを削除…', danger: true, run: () => deleteMark(it.ref) });
    menu(x, y, entries);
}

function addMenu(x, y, at) {
    menu(x, y, [
        { label: '新しいブックマークを作って置く…', run: () => newBookmark(null, at) },
        { label: 'ブックマークから選んで置く', run: openDrawer },
        '-',
        { label: 'リンクのウィジェットを置く…', run: () => addLinkWidget(at) },
        { label: '時計のウィジェットを置く', run: () => placeWidget('clock', null, at) },
        { label: 'メモのウィジェットを置く', run: () => placeWidget('memo', null, at) },
        '-',
        { label: '設定', run: openSettings }
    ]);
}

let drag = null;
track.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const node = e.target.closest('.item');
    if (!node || e.target.closest('textarea')) return;
    const it = itemOf(node);
    if (!it) return;
    const r = node.getBoundingClientRect();
    const cell = cellPx();
    drag = { node, it, id: e.pointerId, sx: e.clientX, sy: e.clientY, offC: Math.floor((e.clientX - r.left) / cell), offR: Math.floor((e.clientY - r.top) / cell), moved: false, ctrl: e.ctrlKey || e.metaKey };
});

function swapTarget(c, r) {
    const s = size(drag.it);
    if (s.w !== 1 || s.h !== 1) return null;
    return currentDesk().find(o => o !== drag.it && o.c === c && o.r === r && size(o).w === 1 && size(o).h === 1) || null;
}

addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    const cell = cellPx();
    const grid = currentGrid();
    if (!drag.moved) {
        drag.moved = true;
        drag.node.classList.add('dragging');
        grid.classList.add('dropping');
        drag.ghost = drag.node.cloneNode(true);
        drag.ghost.classList.remove('dragging');
        drag.ghost.classList.add('ghost');
        document.body.append(drag.ghost);
        drag.slot = el('div', 'slot');
        grid.append(drag.slot);
    }
    drag.ghost.style.left = e.clientX - drag.offC * cell - cell / 2 + 'px';
    drag.ghost.style.top = e.clientY - drag.offR * cell - cell / 2 + 'px';
    const at = cellAt(e.clientX, e.clientY);
    const c = at.c - drag.offC;
    const r = at.r - drag.offR;
    drag.target = { c, r };
    const s = size(drag.it);
    const ok = fits(currentDesk(), drag.it, c, r) || !!swapTarget(c, r);
    drag.slot.style.left = c * cell + 4 + 'px';
    drag.slot.style.top = r * cell + 4 + 'px';
    drag.slot.style.width = s.w * cell - 8 + 'px';
    drag.slot.style.height = s.h * cell - 8 + 'px';
    drag.slot.classList.toggle('bad', !ok);
});

addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
        const it = d.it;
        if (it.widget === 'link') openUrl(it.data.url, d.ctrl ? 'tab' : null);
        else if (it.ref) {
            const m = mark(it.ref);
            if (m.folder) openFolder(it.ref);
            else openUrl(m.url, d.ctrl ? 'tab' : null);
        }
        return;
    }
    d.ghost.remove();
    d.slot.remove();
    currentGrid()?.classList.remove('dropping');
    const { c, r } = d.target;
    if (fits(currentDesk(), d.it, c, r)) { d.it.c = c; d.it.r = r; }
    else {
        const other = swapTarget(c, r);
        if (other) { other.c = d.it.c; other.r = d.it.r; d.it.c = c; d.it.r = r; }
        else toast('そこには置けません（ほかのものと重なります）');
    }
    save();
    render();
});

addEventListener('pointercancel', () => {
    if (!drag) return;
    drag.ghost?.remove();
    drag.slot?.remove();
    drag = null;
    render();
});

track.addEventListener('auxclick', e => {
    if (e.button !== 1) return;
    const node = e.target.closest('.item');
    if (!node) return;
    const it = itemOf(node);
    const url = it?.widget === 'link' ? it.data.url : it?.ref && mark(it.ref)?.url;
    if (url) { e.preventDefault(); openUrl(url, 'back'); }
});

track.addEventListener('contextmenu', e => {
    if (e.target.closest('textarea')) return;
    e.preventDefault();
    const node = e.target.closest('.item');
    if (node) { const it = itemOf(node); if (it) itemMenu(e.clientX, e.clientY, it); }
    else addMenu(e.clientX, e.clientY, cellAt(e.clientX, e.clientY));
});

const accepts = types => [...types].some(t => t === 'text/x-tabaq-ref' || t === 'text/uri-list' || t === 'text/x-moz-url');
pagesEl.addEventListener('dragover', e => {
    if (!accepts(e.dataTransfer.types)) return;
    e.preventDefault();
    currentGrid()?.classList.add('dropping');
});
pagesEl.addEventListener('dragleave', e => { if (!pagesEl.contains(e.relatedTarget)) currentGrid()?.classList.remove('dropping'); });
pagesEl.addEventListener('drop', e => {
    e.preventDefault();
    currentGrid()?.classList.remove('dropping');
    const at = cellAt(e.clientX, e.clientY);
    const ref = e.dataTransfer.getData('text/x-tabaq-ref');
    if (ref) { place(ref, at); return; }
    const moz = e.dataTransfer.getData('text/x-moz-url').split('\n');
    const url = (moz[0] || e.dataTransfer.getData('text/uri-list').split('\n').find(l => l && !l.startsWith('#')) || '').trim();
    if (/^https?:\/\//.test(url)) quickAdd(url, at, moz[1]?.trim());
});

addEventListener('paste', e => {
    if (e.target.closest?.('input, textarea')) return;
    const t = (e.clipboardData.getData('text') || '').trim();
    if (/^https?:\/\/\S+$/.test(t)) { e.preventDefault(); quickAdd(t); }
});

let wheelLock = 0;
pagesEl.addEventListener('wheel', e => {
    if (!store.settings.multi || e.target.closest('textarea, .drawer')) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (Math.abs(dx) < 20 || Date.now() < wheelLock) return;
    wheelLock = Date.now() + 500;
    goPage(store.page + (dx > 0 ? 1 : -1));
}, { passive: true });

addEventListener('keydown', e => {
    if (!store.settings.multi || e.target.closest('input, textarea, select') || document.querySelector('.overlay')) return;
    if (e.key === 'ArrowRight') goPage(store.page + 1);
    if (e.key === 'ArrowLeft') goPage(store.page - 1);
});

document.querySelector('.bar-add').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    addMenu(r.left, r.bottom + 6);
});
document.querySelector('.bar-drawer').addEventListener('click', openDrawer);
document.querySelector('.bar-settings').addEventListener('click', openSettings);

addEventListener('resize', render);
onMarksChange(render);
onStoreChange(render);

(async () => {
    await Promise.all([loadStore(), loadMarks(), loadFaviconCache()]);
    render();
})();
