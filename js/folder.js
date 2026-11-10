import { el, button, overlay, menu, closeOverlays } from './ui.js';
import { mark, childrenOf, pathOf } from './marks.js';
import { iconNode } from './icons.js';
import { place, deleteMark, rename, relink, openUrl } from './actions.js';
import { onMarksChange } from './marks.js';

let redraw = null;
onMarksChange(() => redraw?.());

export function openFolder(id) {
    const stack = [id];
    const panel = el('div', 'panel');
    panel.setAttribute('role', 'dialog');
    const o = overlay(panel);
    const observer = new MutationObserver(() => { if (!o.isConnected) { redraw = null; observer.disconnect(); } });
    observer.observe(document.body, { childList: true });

    function draw() {
        while (stack.length && !mark(stack[stack.length - 1])) stack.pop();
        if (!stack.length) { o.remove(); return; }
        const cur = stack[stack.length - 1];
        panel.replaceChildren();
        const head = el('div', 'panel-head');
        if (stack.length > 1) {
            const back = button('round', '‹', () => { stack.pop(); draw(); });
            back.setAttribute('aria-label', '戻る');
            head.append(back);
        }
        head.append(el('h2', null, mark(cur).title), el('small', null, pathOf(cur)));
        panel.append(head);
        const kids = childrenOf(cur);
        if (!kids.length) { panel.append(el('div', 'panel-empty', 'このフォルダは空です')); return; }
        const grid = el('div', 'panel-grid');
        for (const k of kids) {
            const ic = iconNode(k.id);
            ic.addEventListener('click', e => {
                if (k.folder) { stack.push(k.id); draw(); return; }
                openUrl(k.url, e.ctrlKey || e.metaKey ? 'tab' : null);
            });
            ic.addEventListener('auxclick', e => { if (e.button === 1 && k.url) { e.preventDefault(); openUrl(k.url, 'back'); } });
            ic.addEventListener('contextmenu', e => {
                e.preventDefault();
                e.stopPropagation();
                const entries = [{ head: k.folder ? 'フォルダ・' + (pathOf(k.id) || '') : pathOf(k.id) }];
                if (k.folder) entries.push({ label: '開く', run: () => { stack.push(k.id); draw(); } });
                else entries.push({ label: '開く', run: () => openUrl(k.url) }, { label: '新しいタブで開く', run: () => openUrl(k.url, 'tab') }, { label: '新しいウィンドウで開く', run: () => openUrl(k.url, 'window') });
                entries.push('-', { label: 'デスクトップに置く', run: () => { closeOverlays(); place(k.id); } }, { label: '名前を変える…', run: () => rename(k.id) });
                if (!k.folder) entries.push({ label: 'URL を変える…', run: () => relink(k.id) });
                entries.push('-', { label: 'ブックマークを削除…', danger: true, run: () => deleteMark(k.id) });
                menu(e.clientX, e.clientY, entries);
            });
            grid.append(ic);
        }
        panel.append(grid);
    }
    redraw = draw;
    draw();
    panel.querySelector('button')?.focus();
}
