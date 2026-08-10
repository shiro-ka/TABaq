import { ICON_PATHS } from './constants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// アイコン名から <svg><path/></svg> を DOM として組み立てて返す。
// innerHTML に SVG 文字列を代入する方式をやめたのは、
// 同じ経路にユーザー入力(ブックマークのタイトル等)が混ざった時に XSS になるため。
export function createIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_PATHS[name] || '');
    svg.appendChild(path);

    return svg;
}
