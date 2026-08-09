import { state, getCurrentFolderId, savePositions, saveLocalBookmarks } from './state.js';
import { getFaviconCandidates, createIcon } from './utils.js';
import { findEmptyPosition } from './grid.js';
import { handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave } from './dragdrop.js';
import { renderWidgets } from './widgets.js';

// 前回の描画で画面に出ていたアイテムID。今回だけ新しく現れたIDに登場アニメを付けるために使う。
let renderedIds = new Set();

// 指定フォルダ直下のアイテムを返す。
// TABaq は独立ランチャーなので、表示するのは localStorage 上のローカルアイテムのみ。
// (Firefox 本体のブックマークはインポート時にローカルへコピーされる)
function getFolderChildren(folderId) {
    return state.localBookmarks.filter(b => b.parentId === folderId);
}

// 「空です」「読み込み失敗」表示。メッセージは textContent で入れる。
function renderEmptyState(container, message) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.appendChild(createIcon('empty'));

    const p = document.createElement('p');
    p.textContent = message;
    wrap.appendChild(p);

    container.replaceChildren(wrap);
}



// ブックマーク読み込み
export async function loadBookmarks() {
    const container = document.querySelector('.icons-container');
    container.innerHTML = '<div class="loading"></div>';

    try {
        const mergedChildren = await getFolderChildren('root');
        displayItems(mergedChildren);
    } catch (error) {
        console.error('ブックマーク読み込みエラー:', error);
        renderEmptyState(container, 'ブックマークの読み込みに失敗しました');
    }
}

// パンくず（現在の階層）を描画。クリックでその階層まで戻れる。
function renderBreadcrumb() {
    const header = document.getElementById('app-header');
    const nav = document.querySelector('.breadcrumb');
    if (!header || !nav) return;

    // ルート直下ではヘッダーごと隠してデスクトップを広く使う
    header.style.display = state.currentPath.length === 0 ? 'none' : '';
    nav.innerHTML = '';

    // ホーム + 各フォルダ階層。index=-1 がホーム(ルート)。
    const crumbs = [{ title: 'ホーム', index: -1 }];
    state.currentPath.forEach((seg, i) => {
        crumbs.push({ title: seg.title || '無題', index: i });
    });

    crumbs.forEach(crumb => {
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        item.textContent = crumb.title;
        item.addEventListener('click', () => navigateToPath(crumb.index));
        nav.appendChild(item);
    });
}

// 指定した階層まで戻る（-1 でホーム）
export function navigateToPath(index) {
    state.currentPath = index < 0 ? [] : state.currentPath.slice(0, index + 1);
    reloadCurrentFolder();
}

// アイテム表示
export function displayItems(items) {
    renderBreadcrumb();

    const container = document.querySelector('.icons-container');
    container.innerHTML = '';

    // ウィジェットはホーム(ルート)にだけ置ける
    const isHome = state.currentPath.length === 0;

    // 表示するアイテムをフィルタリング（空でないもの）
    const displayableItems = items.filter(item => item.title || item.url);

    // アイテムもウィジェットも無い時だけ空表示を出す
    if (displayableItems.length === 0 && !(isHome && state.widgets.length > 0)) {
        renderEmptyState(container, 'このフォルダにはブックマークがありません');
        renderedIds = new Set();
        return;
    }

    // フォルダを先に、ブックマークを後に並べ替え
    const sorted = [...displayableItems].sort((a, b) => {
        const aIsFolder = !a.url;
        const bIsFolder = !b.url;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return 0;
    });

    // 現在のフォルダIDを取得
    const currentFolderId = getCurrentFolderId();

    // このフォルダの位置情報を取得または初期化
    if (!state.gridPositions[currentFolderId]) {
        state.gridPositions[currentFolderId] = {};
    }

    sorted.forEach((item, index) => {
        // 保存された位置を取得、なければ空いている位置を探す
        let position = state.gridPositions[currentFolderId][item.id];
        if (!position) {
            position = findEmptyPosition(currentFolderId);
            state.gridPositions[currentFolderId][item.id] = position;
        }

        // 前回いなかったアイテムだけ登場アニメを付ける
        const isNew = !renderedIds.has(item.id);
        const element = createIconElement(item, index, position, isNew);
        container.appendChild(element);
    });

    // 今回表示したIDを記録（次回の差分判定に使う）
    renderedIds = new Set(sorted.map(item => item.id));

    // ホームならウィジェットを重ねて描画
    if (isHome) renderWidgets(container);

    savePositions();
}

// アイコン要素作成
export function createIconElement(item, index, position, isNew = true) {
    const isFolder = !item.url;
    const div = document.createElement('div');
    div.className = 'icon-item';
    // 新規アイテムのみ登場アニメ（インデックス順に少しずつ遅延させて“にゅっ”と出す）
    if (isNew) {
        div.classList.add('appear');
        div.style.animationDelay = `${index * 0.03}s`;
    }
    div.dataset.id = item.id;
    // Store type if local
    if (item.type === 'local') {
        div.dataset.type = 'local';
    }

    // グリッド位置を設定
    if (position) {
        div.style.gridRow = position.row;
        div.style.gridColumn = position.col;
        div.dataset.gridPos = `${position.row},${position.col}`;
    }

    // ドラッグ可能に設定
    div.draggable = true;
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    // swap highlight用
    div.addEventListener('dragenter', handleDragEnter);
    div.addEventListener('dragleave', handleDragLeave);

    // アイコン画像部分
    const iconImage = document.createElement('div');
    iconImage.className = `icon-image ${isFolder ? 'folder' : 'bookmark'}`;

    if (isFolder) {
        iconImage.appendChild(createIcon('folder'));
    } else {
        // ファビコンを候補順に試す（サイト自身 → DDG → SVG）
        const candidates = getFaviconCandidates(item.url);
        if (candidates.length > 0) {
            const img = document.createElement('img');
            img.alt = '';
            let idx = 0;
            img.src = candidates[idx];
            img.onerror = () => {
                idx++;
                if (idx < candidates.length) {
                    img.src = candidates[idx]; // 次の候補へ
                } else {
                    iconImage.replaceChildren(createIcon('bookmark')); // 全滅したら SVG
                }
            };
            iconImage.appendChild(img);
        } else {
            iconImage.appendChild(createIcon('bookmark'));
        }
    }

    // タイトル部分
    const title = document.createElement('span');
    title.className = 'icon-title';
    title.textContent = item.title || 'Untitled';
    title.title = item.title || 'Untitled';

    div.appendChild(iconImage);
    div.appendChild(title);

    // イベント設定
    if (isFolder) {
        div.addEventListener('dblclick', () => openFolder(item));
        div.addEventListener('click', (e) => {
            e.preventDefault();
            selectItem(div);
        });
    } else {
        div.addEventListener('click', () => openBookmark(item.url));
        div.addEventListener('auxclick', (e) => {
            if (e.button === 1) { // 中クリック
                e.preventDefault();
                browser.tabs.create({ url: item.url, active: false });
            }
        });
    }

    return div;
}

// フォルダを開く
export async function openFolder(folder) {
    state.currentPath.push({
        id: folder.id,
        title: folder.title || 'Untitled'
    });

    try {
        const mergedChildren = await getFolderChildren(folder.id);
        displayItems(mergedChildren);
    } catch (error) {
        console.error('フォルダ読み込みエラー:', error);
        state.currentPath.pop();
    }
}

// 現在のフォルダを再読み込み
export async function reloadCurrentFolder() {
    const currentFolderId = getCurrentFolderId();
    try {
        const mergedChildren = await getFolderChildren(currentFolderId);
        displayItems(mergedChildren);
    } catch (error) {
        console.error('再読み込みエラー:', error);
    }
}

// ブックマークを開く
export function openBookmark(url) {
    browser.tabs.update({ url: url });
}

// アイテム選択
export function selectItem(element) {
    document.querySelectorAll('.icon-item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    element.classList.add('selected');
}
