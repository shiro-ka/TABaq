import { createIcon } from './utils.js';
import { state, getCurrentFolderId, savePositions, saveLocalBookmarks } from './state.js';
import { displayItems, reloadCurrentFolder } from './bookmarks.js';
import { openAddBookmarkModal, openImportModal } from './modal.js';
import { exportBackup, importBackup } from './backup.js';
import { promptDialog, confirmDialog, alertDialog } from './dialog.js';
import { addWidget } from './widgets.js';

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
        { icon: 'add', label: '新しいブックマーク', action: () => openAddBookmarkModal() },
        { icon: 'import', label: 'ブックマークをインポート', action: () => importBookmarks() },
        { icon: 'folder', label: '新しいフォルダ', action: () => createNewFolder() },
        { icon: 'add', label: 'ウィジェットを追加（時計）', action: () => addWidget('clock') },
        { icon: 'edit', label: 'トレイの編集', action: () => alertDialog({ title: 'トレイの編集', message: 'この機能は開発中です' }) },
        { separator: true },
        { icon: 'import', label: 'バックアップを書き出す', action: () => exportBackup() },
        { icon: 'import', label: 'バックアップから復元', action: () => importBackup() },
        { separator: true },
        { icon: 'settings', label: 'TABaqの設定', action: () => openSettings() }
    ];

    renderMenuItems(menu, items);
    showContextMenu(x, y);
}

// メニュー項目を DOM として組み立てる。
// ラベルは textContent で入れるので、将来ブックマーク名など可変の文字列を
// 項目名に使っても HTML として解釈されない。
function renderMenuItems(menu, items) {
    items.forEach(item => {
        if (item.hide) return;

        if (item.separator) {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);
            return;
        }

        const menuItem = document.createElement('div');
        menuItem.className = `context-menu-item ${item.danger ? 'danger' : ''}`;
        menuItem.appendChild(createIcon(item.icon));

        const label = document.createElement('span');
        label.textContent = item.label;
        menuItem.appendChild(label);

        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.action();
            hideContextMenu();
        });
        menu.appendChild(menuItem);
    });
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
            { icon: 'newTab', label: '新しいタブで開く', action: () => openInNewTab(bookmarkId) },
            { icon: 'newWindow', label: '新しいウィンドウで開く', action: () => openInNewWindow(bookmarkId) },
            { icon: 'private', label: 'プライベートタブで開く', action: () => openInPrivateTab(bookmarkId) },
            { separator: true }
        );
    }

    items.push(
        { icon: 'edit', label: '名前を変更', action: () => renameItem(bookmarkId) },
        { icon: 'link', label: 'リンクを変更', action: () => editLink(bookmarkId), hide: isFolder },
        { icon: 'delete', label: '削除', action: () => deleteItem(bookmarkId), danger: true },
        { separator: true },
        { icon: 'settings', label: '設定', action: () => openSettings() }
    );

    renderMenuItems(menu, items);
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
    const title = await promptDialog({ title: '新しいフォルダ', label: 'フォルダ名', placeholder: 'フォルダ名を入力', okText: '作成' });
    if (!title) return;

    // 独立ランチャーとしてローカル(localStorage)にフォルダを作る。
    // url を持たない = フォルダ扱い（createIconElement の isFolder 判定）。
    const currentFolderId = getCurrentFolderId();
    const newFolder = {
        id: 'local-' + Date.now(),
        title: title,
        parentId: currentFolderId,
        dateAdded: Date.now(),
        type: 'local'
    };

    state.localBookmarks.push(newFolder);
    saveLocalBookmarks();
    reloadCurrentFolder();
}


function importBookmarks() {
    openImportModal();
}

function openSettings() {
    // 設定ページを新しいタブで開く（将来的に実装）
    alertDialog({ title: 'TABaqの設定', message: 'この機能は開発中です' });
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
        const newTitle = await promptDialog({ title: '名前を変更', label: '新しい名前', value: local.title, okText: '変更' });
        if (newTitle && newTitle !== local.title) {
            local.title = newTitle;
            saveLocalBookmarks();
            reloadCurrentFolder();
        }
    } else {
        try {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            const newTitle = await promptDialog({ title: '名前を変更', label: '新しい名前', value: bookmark.title, okText: '変更' });

            if (newTitle && newTitle !== bookmark.title) {
                await browser.bookmarks.update(bookmarkId, { title: newTitle });
                reloadCurrentFolder();
            }
        } catch (error) {
            console.error('名前変更エラー:', error);
            await alertDialog({ title: '変更に失敗しました', message: '名前を変更できませんでした' });
        }
    }
}

async function editLink(bookmarkId) {
    const local = state.localBookmarks.find(b => b.id === bookmarkId);

    if (local) {
        const newUrl = await promptDialog({ title: 'リンクを変更', label: '新しいURL', value: local.url, placeholder: 'https://...', okText: '変更' });
        if (newUrl && newUrl !== local.url) {
            local.url = newUrl;
            saveLocalBookmarks();
            reloadCurrentFolder();
        }
    } else {
        try {
            const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
            const newUrl = await promptDialog({ title: 'リンクを変更', label: '新しいURL', value: bookmark.url, placeholder: 'https://...', okText: '変更' });

            if (newUrl && newUrl !== bookmark.url) {
                await browser.bookmarks.update(bookmarkId, { url: newUrl });
                reloadCurrentFolder();
            }
        } catch (error) {
            console.error('リンク変更エラー:', error);
            await alertDialog({ title: '変更に失敗しました', message: 'リンクを変更できませんでした' });
        }
    }
}

async function deleteItem(bookmarkId) {
    const ok = await confirmDialog({ title: '削除の確認', message: '本当に削除しますか？', okText: '削除', danger: true });
    if (!ok) return;

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
            await alertDialog({ title: '削除に失敗しました', message: 'アイテムを削除できませんでした' });
        }
    }
}
