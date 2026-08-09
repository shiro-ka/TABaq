import { DEFAULT_BOOKMARKS } from './constants.js';

// --- 保存先について ---
// localStorage ではなく browser.storage.local を使う。
// localStorage は「Cookieとサイトデータを削除」や「終了時にCookieを消す」設定を使うと
// 拡張機能のデータごと消える(MDN も拡張機能での localStorage 利用を非推奨としている)。
// storage.local はこれらの操作では消えない。
// 代償として API が非同期になるので、load 系は await が要る。
const KEYS = {
    positions: 'tabaq-grid-positions',
    bookmarks: 'tabaq-local-bookmarks',
    widgets: 'tabaq-widgets'
};

// State variables
export const state = {
    currentPath: [],
    gridPositions: {},
    draggedElement: null,
    contextMenuTarget: null,
    localBookmarks: [],
    widgets: []
};

// 旧 localStorage から storage.local への引き継ぎ。
// storage.local がまだ空の時にだけ動く(= 実質1回きり)。load 系より先に呼ぶこと。
export async function migrateLegacyStorage() {
    try {
        const existing = await browser.storage.local.get(Object.values(KEYS));
        if (Object.keys(existing).length > 0) return false; // 移行済み

        const migrated = {};
        for (const key of Object.values(KEYS)) {
            const raw = localStorage.getItem(key);
            if (raw === null) continue;
            try {
                migrated[key] = JSON.parse(raw);
            } catch {
                console.warn('移行できない壊れたデータを飛ばしました:', key);
            }
        }
        if (Object.keys(migrated).length === 0) return false; // 旧データも無い = 新規インストール

        await browser.storage.local.set(migrated);
        // localStorage 側はあえて消さない。切り戻しの保険として当面残す。
        console.info('保存領域を storage.local へ移行しました:', Object.keys(migrated));
        return true;
    } catch (error) {
        console.error('保存領域の移行エラー:', error);
        return false;
    }
}

// Positions Management
export async function loadPositions() {
    try {
        const got = await browser.storage.local.get(KEYS.positions);
        state.gridPositions = got[KEYS.positions] || {};
    } catch (error) {
        console.error('位置情報の読み込みエラー:', error);
        state.gridPositions = {};
    }
}

// save 系は呼び出し側が await しない前提なので、内部でエラーを握って必ず解決する。
export async function savePositions() {
    try {
        await browser.storage.local.set({ [KEYS.positions]: state.gridPositions });
    } catch (error) {
        console.error('位置情報の保存エラー:', error);
    }
}

// Local Bookmarks Management
export async function loadLocalBookmarks() {
    try {
        const got = await browser.storage.local.get(KEYS.bookmarks);
        if (got[KEYS.bookmarks]) {
            state.localBookmarks = got[KEYS.bookmarks];
        } else {
            // キーが存在しない = 初回起動。ここでだけデフォルトを投入する。
            // 保存済みの空配列はユーザーが全部消した状態なので、この分岐に入らず復活しない。
            state.localBookmarks = DEFAULT_BOOKMARKS.map(b => ({
                ...b,
                parentId: 'root',
                dateAdded: Date.now(),
                type: 'local'
            }));
            await saveLocalBookmarks();
        }
    } catch (error) {
        console.error('ローカルブックマークの読み込みエラー:', error);
        state.localBookmarks = [];
    }
}

export async function saveLocalBookmarks() {
    try {
        await browser.storage.local.set({ [KEYS.bookmarks]: state.localBookmarks });
    } catch (error) {
        console.error('ローカルブックマークの保存エラー:', error);
    }
}

// Widgets Management
export async function loadWidgets() {
    try {
        const got = await browser.storage.local.get(KEYS.widgets);
        state.widgets = got[KEYS.widgets] || [];
    } catch (error) {
        console.error('ウィジェットの読み込みエラー:', error);
        state.widgets = [];
    }
}

export async function saveWidgets() {
    try {
        await browser.storage.local.set({ [KEYS.widgets]: state.widgets });
    } catch (error) {
        console.error('ウィジェットの保存エラー:', error);
    }
}

export function getCurrentFolderId() {
    if (state.currentPath.length === 0) return 'root';
    return state.currentPath[state.currentPath.length - 1].id;
}
