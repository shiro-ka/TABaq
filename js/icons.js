import { el, button } from './ui.js';
import { mark, childrenOf, pathOf } from './marks.js';
import { fillFavicon } from './favicon.js';

export function iconNode(id) {
    const m = mark(id);
    const b = button('icon');
    const tile = el('span', 'tile' + (m.folder ? ' folder' : ''));
    if (m.folder) {
        for (const k of childrenOf(id).slice(0, 4)) {
            const s = el('span');
            if (k.folder) s.textContent = '…';
            else fillFavicon(s, k.url, k.title);
            tile.append(s);
        }
    } else {
        fillFavicon(tile, m.url, m.title);
    }
    b.append(tile, el('span', 'label', m.title || '（名前なし）'));
    const where = pathOf(id);
    b.title = m.folder ? `${m.title}\n${where}` : `${m.title}\n${m.url}${where ? '\n' + where : ''}`;
    return b;
}
