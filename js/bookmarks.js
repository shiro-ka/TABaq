import { ICONS } from './constants.js';
import { state, getCurrentFolderId, savePositions, saveLocalBookmarks } from './state.js';
import { getFaviconUrl } from './utils.js';
import { findEmptyPosition } from './grid.js';
import { handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave } from './dragdrop.js';

// Helper to get merged children
async function getMergedChildren(folderId) {
    // Only return local bookmarks by default (User request: default state is empty/local only)
    const local = state.localBookmarks.filter(b => b.parentId === folderId);
    return local;
}



// ブックマーク読み込み
export async function loadBookmarks() {
    const container = document.querySelector('.icons-container');
    container.innerHTML = '<div class="loading"></div>';

    try {
        const mergedChildren = await getMergedChildren('root');
        displayItems(mergedChildren);
    } catch (error) {
        console.error('ブックマーク読み込みエラー:', error);
        container.innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <p>ブックマークの読み込みに失敗しました</p>
      </div>
    `;
    }
}

// アイテム表示
export function displayItems(items) {
    const container = document.querySelector('.icons-container');
    container.innerHTML = '';

    // 表示するアイテムをフィルタリング（空でないもの）
    const displayableItems = items.filter(item => item.title || item.url);

    if (displayableItems.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <p>このフォルダにはブックマークがありません</p>
      </div>
    `;
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

        const element = createIconElement(item, index, position);
        container.appendChild(element);
    });

    savePositions();
}

// アイコン要素作成
export function createIconElement(item, index, position) {
    const isFolder = !item.url;
    const div = document.createElement('div');
    div.className = 'icon-item';
    div.style.animationDelay = `${index * 0.03}s`;
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
        iconImage.innerHTML = ICONS.folder;
    } else {
        // ファビコンを取得
        const favicon = getFaviconUrl(item.url);
        if (favicon) {
            const img = document.createElement('img');
            img.src = favicon;
            img.alt = '';
            img.onerror = () => {
                img.style.display = 'none';
                iconImage.innerHTML = ICONS.bookmark;
            };
            iconImage.appendChild(img);
        } else {
            iconImage.innerHTML = ICONS.bookmark;
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
        const mergedChildren = await getMergedChildren(folder.id);
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
        const mergedChildren = await getMergedChildren(currentFolderId);
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
