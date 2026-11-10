import { el } from './ui.js';
import { allMarks, pathOf, onMarksChange } from './marks.js';
import { currentDesk } from './store.js';
import { fillFavicon } from './favicon.js';
import { place } from './actions.js';

const drawer = document.querySelector('.drawer');
const search = document.querySelector('.drawer-search');
const list = document.querySelector('.drawer-list');

export function openDrawer() {
    drawer.classList.add('open');
    renderDrawer();
    search.focus();
}

export function closeDrawer() { drawer.classList.remove('open'); }

export function renderDrawer() {
    if (!drawer.classList.contains('open')) return;
    const q = search.value.trim().toLowerCase();
    const on = new Set(currentDesk().map(o => o.ref));
    const rows = [];
    for (const m of allMarks()) {
        const where = pathOf(m.id);
        if (q && !((m.title || '').toLowerCase().includes(q) || (m.url || '').toLowerCase().includes(q) || where.toLowerCase().includes(q))) continue;
        const row = el('div', 'row');
        row.draggable = true;
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        const icon = el('span', 'row-icon');
        if (m.folder) icon.textContent = '▤';
        else fillFavicon(icon, m.url, m.title);
        const text = el('div', 'row-text');
        text.append(el('div', 'row-title', m.title || '（名前なし）'), el('div', 'row-path', where || 'いちばん上'));
        row.append(icon, text);
        if (on.has(m.id)) row.append(el('span', 'row-on', '置いてある'));
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-tabaq-ref', m.id); e.dataTransfer.effectAllowed = 'copy'; });
        row.addEventListener('click', () => place(m.id));
        row.addEventListener('keydown', e => { if (e.key === 'Enter') place(m.id); });
        rows.push(row);
        if (rows.length >= 300) break;
    }
    list.replaceChildren(...rows);
}

search.addEventListener('input', renderDrawer);
document.querySelector('.drawer-close').addEventListener('click', closeDrawer);
onMarksChange(renderDrawer);
