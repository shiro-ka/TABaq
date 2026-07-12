import { state, saveWidgets } from './state.js';
import { reloadCurrentFolder } from './bookmarks.js';

// ウィジェットの種類レジストリ。
// w / h = グリッドのマス数(横 96px / 縦 88px)。render(body) が中身を描く。
// 将来ここに calendar / todo / webframe などを追加していく想定。
const WIDGET_TYPES = {
    clock: { label: '時計', w: 3, h: 2, render: renderClock }
};

// 生きている setInterval を管理し、再描画時にまとめて止める（タイマーリーク防止）。
let timers = [];

// --- clock ウィジェット ---
function renderClock(body) {
    body.innerHTML = `
        <div class="widget-clock">
            <div class="widget-clock-time"></div>
            <div class="widget-clock-date"></div>
        </div>`;
    const timeEl = body.querySelector('.widget-clock-time');
    const dateEl = body.querySelector('.widget-clock-date');

    function update() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${hh}:${mm}`;
        dateEl.textContent = now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    }

    update();
    timers.push(setInterval(update, 1000));
}

// --- 配置探索 ---
// w×h マスぶんの空きブロックを、ブックマークと既存ウィジェットを避けて探す。
function findWidgetPosition(w, h) {
    const occupied = new Set();

    const bookmarks = state.gridPositions['root'] || {};
    Object.values(bookmarks).forEach(p => occupied.add(`${p.row},${p.col}`));

    state.widgets.forEach(wd => {
        const spec = WIDGET_TYPES[wd.type];
        if (!spec) return;
        for (let r = wd.pos.row; r < wd.pos.row + spec.h; r++) {
            for (let c = wd.pos.col; c < wd.pos.col + spec.w; c++) {
                occupied.add(`${r},${c}`);
            }
        }
    });

    const isFree = (row, col) => {
        for (let r = row; r < row + h; r++) {
            for (let c = col; c < col + w; c++) {
                if (occupied.has(`${r},${c}`)) return false;
            }
        }
        return true;
    };

    for (let row = 1; row <= 20; row++) {
        for (let col = 1; col <= 20; col++) {
            if (isFree(row, col)) return { row, col };
        }
    }
    return { row: 1, col: 1 };
}

// --- 描画/追加/削除 ---
// ウィジェットはホーム(ルート)デスクトップにのみ表示する。displayItems から呼ばれる。
export function renderWidgets(container) {
    // 前回の描画で作ったタイマーを止める
    timers.forEach(clearInterval);
    timers = [];

    state.widgets.forEach(wd => {
        const spec = WIDGET_TYPES[wd.type];
        if (!spec) return;

        const el = document.createElement('div');
        el.className = `widget widget-${wd.type}`;
        el.style.gridColumn = `${wd.pos.col} / span ${spec.w}`;
        el.style.gridRow = `${wd.pos.row} / span ${spec.h}`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'widget-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'ウィジェットを削除';
        removeBtn.addEventListener('click', () => removeWidget(wd.id));
        el.appendChild(removeBtn);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'widget-body';
        el.appendChild(bodyEl);
        spec.render(bodyEl);

        container.appendChild(el);
    });
}

export function addWidget(type) {
    const spec = WIDGET_TYPES[type];
    if (!spec) return;
    const pos = findWidgetPosition(spec.w, spec.h);
    state.widgets.push({ id: 'widget-' + Date.now(), type, pos });
    saveWidgets();
    reloadCurrentFolder();
}

export function removeWidget(id) {
    state.widgets = state.widgets.filter(w => w.id !== id);
    saveWidgets();
    reloadCurrentFolder();
}
