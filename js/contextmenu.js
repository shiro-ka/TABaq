import { ICONS } from './constants.js';
import { state, getCurrentFolderId, savePositions, saveLocalBookmarks } from './state.js';
import { displayItems, reloadCurrentFolder } from './bookmarks.js';
import { openAddBookmarkModal, openImportModal } from './modal.js';

export function setupContextMenu() {
    // 右クリックでコンテキストメニューを表示（ページ全体で）
    document.addEventListener('contextmenu', (e) => {
        // アイテム上かどうかをチェック
        const target = e.target.closest('.icon-item');
        const isOnContainer = e.target.closest('.icons-container');

        // icons-container 内でのみカスタムメニューを表示
        if (isOnContainer) {
            e.preventDefault();
            state.contextMenuTarget = target;

            if (target) {
                // ブックマーク/フォルダ上で右クリック
                showBookmarkContextMenu(e.pageX, e.pageY, target);
            } else {
                // 空白部分で右クリック
                showEmptyContextMenu(e.pageX, e.pageY);
            }
        }
    });

    // 左クリックでメニューを閉じる
    document.addEventListener('click', () => {
        hideContextMenu();
    });

    // スクロールでメニューを閉じる
    document.addEventListener('scroll', () => {
        hideContextMenu();
    });
}

// 空白部分のコンテキストメニュー
function showEmptyContextMenu(x, y) {
    const menu = document.querySelector('.context-menu');
    menu.innerHTML = '';

    const items = [
        { icon: ICONS.add, label: '新しいブックマーク', action: () => openAddBookmarkModal() },
        { icon: ICONS.import, label: 'ブックマークをインポート', action: () => importBookmarks() },
        { icon: ICONS.folder, label: '新しいフォルダ', action: () => createNewFolder() },
        { icon: ICONS.add, label: 'ウィジェットを追加', action: () => alert('ウィジェット機能は開発中です') },
        { icon: ICONS.edit, label: 'トレイの編集', action: () => alert('トレイ編集機能は開発中です') },
        { separator: true },
        { icon: ICONS.settings, label: 'TABaqの設定', action: () => openSettings() }
    ];

    items.forEach(item => {
        if (item.separator) {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);
        } else {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `${item.icon}<span>${item.label}</span>`;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                hideContextMenu();
            });
            menu.appendChild(menuItem);
        }
    });

    showContextMenu(x, y);
}

// ブックマークのコンテキストメニュー
function showBookmarkContextMenu(x, y, target) {
    const menu = document.querySelector('.context-menu');
    menu.innerHTML = '';

    const bookmarkId = target.dataset.id;
    const isFolder = !target.querySelector('.icon-image.bookmark');

    const items = [];

    if (!isFolder) {
        // ブックマークの場合
        items.push(
            { icon: ICONS.newTab, label: '新しいタブで開く', action: () => openInNewTab(bookmarkId) },
            { icon: ICONS.newWindow, label: '新しいウィンドウで開く', action: () => openInNewWindow(bookmarkId) },
            { icon: ICONS.private, label: 'プライベートタブで開く', action: () => openInPrivateTab(bookmarkId) },
            { separator: true }
        );
    }

    items.push(
        { icon: ICONS.edit, label: '名前を変更', action: () => renameItem(bookmarkId) },
        { icon: ICONS.link, label: 'リンクを変更', action: () => editLink(bookmarkId), hide: isFolder },
        { icon: ICONS.delete, label: '削除', action: () => deleteItem(bookmarkId), danger: true },
        { separator: true },
        { icon: ICONS.settings, label: '設定', action: () => openSettings() }
    );

    items.forEach(item => {
        if (item.hide) return;

        if (item.separator) {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);
        } else {
            const menuItem = document.createElement('div');
            menuItem.className = `context-menu-item ${item.danger ? 'danger' : ''}`;
            menuItem.innerHTML = `${item.icon}<span>${item.label}</span>`;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                hideContextMenu();
            });
            menu.appendChild(menuItem);
        }
    });

    showContextMenu(x, y);
}

function showContextMenu(x, y) {
    const menu = document.querySelector('.context-menu');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('show');

    // 画面外にはみ出さないように調整
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    }, 0);
}

function hideContextMenu() {
    const menu = document.querySelector('.context-menu');
    menu.classList.remove('show');
    state.contextMenuTarget = null;
}

// === コンテキストメニューアクション ===

async function createNewFolder() {
    const title = prompt('フォルダ名を入力してください:');
    if (!title) return;

    try {
        const folderId = getCurrentFolderId();
        const parentId = folderId === 'root' ? undefined : folderId;

        await browser.bookmarks.create({
            parentId: parentId,
            title: title
        });

        reloadCurrentFolder();
    } catch (error) {
        console.error('フォルダ作成エラー:', error);
        alert('フォルダの作成に失敗しました');
    }
}


function importBookmarks() {
    openImportModal();
}

function openSettings() {
    // 設定ページを新しいタブで開く（将来的に実装）
    alert('設定画面は開発中です。');
}

async function openInNewTab(bookmarkId) {
    try {
        let url;
        const local = state.localBookmarks.find(b => b.id === bookmarkId);
        if (local) {
            url = local.url;
        } else {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            url = bookmark.url;
        }

        if (url) {
            await browser.tabs.create({ url: url, active: false });
        }
    } catch (error) {
        console.error('タブを開くエラー:', error);
    }
}

async function openInNewWindow(bookmarkId) {
    try {
        let url;
        const local = state.localBookmarks.find(b => b.id === bookmarkId);
        if (local) {
            url = local.url;
        } else {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            url = bookmark.url;
        }

        if (url) {
            await browser.windows.create({ url: url });
        }
    } catch (error) {
        console.error('ウィンドウを開くエラー:', error);
    }
}

async function openInPrivateTab(bookmarkId) {
    try {
        let url;
        const local = state.localBookmarks.find(b => b.id === bookmarkId);
        if (local) {
            url = local.url;
        } else {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            url = bookmark.url;
        }

        if (url) {
            await browser.windows.create({ url: url, incognito: true });
        }
    } catch (error) {
        console.error('プライベートウィンドウを開くエラー:', error);
    }
}

async function renameItem(bookmarkId) {
    const local = state.localBookmarks.find(b => b.id === bookmarkId);

    if (local) {
        const newTitle = prompt('新しい名前を入力してください:', local.title);
        if (newTitle && newTitle !== local.title) {
            local.title = newTitle;
            saveLocalBookmarks();
            reloadCurrentFolder();
        }
    } else {
        try {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            const newTitle = prompt('新しい名前を入力してください:', bookmark.title);

            if (newTitle && newTitle !== bookmark.title) {
                await browser.bookmarks.update(bookmarkId, { title: newTitle });
                reloadCurrentFolder();
            }
        } catch (error) {
            console.error('名前変更エラー:', error);
            alert('名前の変更に失敗しました');
        }
    }
}

async function editLink(bookmarkId) {
    const local = state.localBookmarks.find(b => b.id === bookmarkId);

    if (local) {
        const newUrl = prompt('新しいURLを入力してください:', local.url);
        if (newUrl && newUrl !== local.url) {
            local.url = newUrl;
            saveLocalBookmarks();
            reloadCurrentFolder();
        }
    } else {
        try {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            const newUrl = prompt('新しいURLを入力してください:', bookmark.url);

            if (newUrl && newUrl !== bookmark.url) {
                await browser.bookmarks.update(bookmarkId, { url: newUrl });
                reloadCurrentFolder();
            }
        } catch (error) {
            console.error('リンク変更エラー:', error);
            alert('リンクの変更に失敗しました');
        }
    }
}

async function deleteItem(bookmarkId) {
    if (!confirm('本当に削除しますか？')) return;

    const localIndex = state.localBookmarks.findIndex(b => b.id === bookmarkId);

    if (localIndex !== -1) {
        state.localBookmarks.splice(localIndex, 1);
        saveLocalBookmarks();

        // 位置情報からも削除
        const folderId = getCurrentFolderId();
        if (state.gridPositions[folderId] && state.gridPositions[folderId][bookmarkId]) {
            delete state.gridPositions[folderId][bookmarkId];
            savePositions();
        }

        reloadCurrentFolder();
    } else {
        try {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];

            // フォルダの場合は removeTree を使用
            if (!bookmark.url) {
                await browser.bookmarks.removeTree(bookmarkId);
            } else {
                await browser.bookmarks.remove(bookmarkId);
            }

            // 位置情報からも削除
            const folderId = getCurrentFolderId();
            if (state.gridPositions[folderId] && state.gridPositions[folderId][bookmarkId]) {
                delete state.gridPositions[folderId][bookmarkId];
                savePositions();
            }

            reloadCurrentFolder();
        } catch (error) {
            console.error('削除エラー:', error);
            alert('削除に失敗しました');
        }
    }
}
