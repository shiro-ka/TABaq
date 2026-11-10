import { el } from './ui.js';
import { fillFavicon } from './favicon.js';
import { save } from './store.js';

export const WIDGETS = {
    clock: { label: '時計', w: 3, h: 2 },
    memo: { label: 'メモ', w: 4, h: 2 },
    link: { label: 'リンク', w: 2, h: 1 }
};

function tick(box) {
    const d = new Date();
    box.querySelector('.clock-time').textContent = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    box.querySelector('.clock-date').textContent = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}
setInterval(() => document.querySelectorAll('.clock').forEach(tick), 5000);

function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function widgetNode(it) {
    if (it.widget === 'clock') {
        const w = el('div', 'widget clock');
        w.append(el('div', 'clock-time'), el('div', 'clock-date'));
        tick(w);
        return w;
    }
    if (it.widget === 'memo') {
        const w = el('div', 'widget memo');
        const ta = el('textarea');
        ta.value = it.data?.text || '';
        ta.placeholder = 'ここにメモ';
        ta.setAttribute('aria-label', 'メモ');
        ta.addEventListener('input', () => { it.data = { ...(it.data || {}), text: ta.value }; save(); });
        ta.addEventListener('pointerdown', e => e.stopPropagation());
        w.append(el('div', 'memo-head', 'メモ'), ta);
        return w;
    }
    if (it.widget === 'link') {
        const w = el('div', 'widget link');
        const icon = el('span', 'link-icon');
        fillFavicon(icon, it.data?.url, it.data?.title);
        const text = el('div', 'link-text');
        text.append(el('div', 'link-title', it.data?.title || host(it.data?.url)), el('div', 'link-host', host(it.data?.url)));
        w.append(icon, text);
        w.title = it.data?.url || '';
        return w;
    }
    return el('div', 'widget');
}
